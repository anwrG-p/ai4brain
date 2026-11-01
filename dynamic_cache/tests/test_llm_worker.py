"""BE-13 LLM pool worker, with Gemini mocked at the HTTP transport (the real GeminiRunner runs)."""

from __future__ import annotations

import copy
import json
import threading
from pathlib import Path

import httpx
import pytest

from ai_coach.llm_gemini import GeminiRunner
from dynamic_cache import api
from dynamic_cache import llm_worker as lw
from dynamic_cache.cache_dispatcher import Dispatcher, schema_of
from dynamic_cache.generators import TASK_ID_RE, generate, validate_payload
from dynamic_cache.llm_worker import LlmPoolWorker, VariantArchive

KEY = "test-key-NOT-REAL-be13"
T0 = 1_790_000_000.0  # 2026-09-21 UTC


class Clock:
    def __init__(self, t: float = T0) -> None:
        self.t = t

    def __call__(self) -> float:
        return self.t


def reply(variants) -> httpx.Response:
    text = variants if isinstance(variants, str) else json.dumps({"variants": variants})
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})


class FakeGemini:
    """The HTTP side of Gemini: records each request, answers from a queue (or a function)."""

    def __init__(self, *answers) -> None:
        self.answers = list(answers)
        self.requests: list[dict] = []
        self.headers: list[dict] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(json.loads(request.content))
        self.headers.append(dict(request.headers))
        answer = self.answers.pop(0) if len(self.answers) > 1 else self.answers[0]
        if isinstance(answer, Exception):
            raise answer
        return answer(request) if callable(answer) else answer


def params(schema: str, level: float, seed: int) -> dict:
    options = {"inks": "classic"} if schema == "stroop" else {}
    return generate(schema, level, seed, **options)["params"]


@pytest.fixture
def setup(tmp_path):
    made = []

    def _setup(*answers, schema="relational", level=0.5, clock=None, daily_cap=100, rpm=60.0, pool=True, **kw):
        clock = clock or Clock()
        d = Dispatcher(registry_dir=lambda: tmp_path / "registry", background=False, pool_size=8,
                       variants=VariantArchive(lambda: tmp_path / "variants").get, clock=clock)
        made.append(d)
        if pool:  # a request creates the pool (empty, by setdefault) and puts it in use
            d.next_task("warmup", schema_type=schema)
            assert ("neutral", schema, level) in d.pool_stock()
        fake = FakeGemini(*answers)
        runner = GeminiRunner(KEY, transport=httpx.MockTransport(fake), timeout_s=5)
        worker = LlmPoolWorker(runner, lambda: d, rpm=rpm, daily_cap=daily_cap,
                               archive=VariantArchive(lambda: tmp_path / "variants"), clock=clock, **kw)
        return d, worker, fake

    yield _setup
    for d in made:
        d.close()


def served(d: Dispatcher, user: str, schema: str, **kw) -> dict:
    return json.loads(d.next_task(user, schema_type=schema, **kw).body)


# --- valid variants are served ------------------------------------------------------------------


@pytest.mark.parametrize("schema", lw.SCHEMAS)
def test_valid_variants_enter_the_pool_and_are_served(setup, schema):
    count = lw.VARIANTS_PER_CALL[schema]
    variants = [params(schema, 0.5, 100 + k) for k in range(count)]
    d, worker, fake = setup(reply(variants), schema=schema)
    assert worker.run_once() == "ok"
    assert worker.stats["accepted"] == worker.stats["offered"] == count
    assert d.pool_stock()[("neutral", schema, 0.5)] == (count, count)

    task = served(d, "u1", schema)
    assert "-llm-" in task["task_id"]
    shown = [lw.rename_terms(v) for v in variants] if schema == "relational" else variants
    assert task["params"] in shown
    assert validate_payload(task) == []
    # the request: key in the header, strict JSON with a response schema, room for a whole block
    body = fake.requests[0]
    assert fake.headers[0]["x-goog-api-key"] == KEY and KEY not in json.dumps(body)
    config = body["generationConfig"]
    assert config["responseMimeType"] == "application/json"
    assert config["maxOutputTokens"] == lw.MAX_OUTPUT_TOKENS[schema]
    assert config["responseSchema"]["properties"]["variants"]["maxItems"] == count


def test_procedural_tasks_follow_once_the_llm_variants_are_used(setup):
    d, worker, _ = setup(reply([params("relational", 0.5, 7)]))
    worker.run_once()
    first, second = served(d, "u1", "relational"), served(d, "u2", "relational")
    assert "-llm-" in first["task_id"] and "-llm-" not in second["task_id"]


def test_source_is_recorded_and_ids_are_content_hashes(setup):
    d, worker, _ = setup(reply([params("matrix", 0.5, s) for s in range(1, 7)]), schema="matrix")
    worker.run_once()
    ids = []
    for k in range(6):
        d.next_task(f"u{k}", schema_type="matrix", session_id="s1", seq=0)
        rec = d.export(f"u{k}")["sessions"]["s1|0|matrix|"]
        assert rec["source"] == "llm"
        ids.append(rec["task_id"])
    # a procedural serve records its source too
    d.next_task("u9", schema_type="matrix", session_id="s1", seq=0)
    assert d.export("u9")["sessions"]["s1|0|matrix|"]["source"] == "procedural"

    assert len(set(ids)) == 6
    for task_id in ids:
        assert TASK_ID_RE.match(task_id) and len(task_id) <= 48
        assert schema_of(task_id) == "matrix"  # the staircase counts its trials
        assert task_id.startswith("matrix-llm-")  # never a procedural `{schema}-{digits}-` id
    p = params("matrix", 0.5, 1)
    assert lw.variant_id("matrix", p) == lw.variant_id("matrix", copy.deepcopy(p))
    longest = lw.variant_id("relational", params("relational", 0.5, 1))[0].replace("relational", "mental_rotation")
    assert len(longest) <= 48


def test_an_llm_session_replays_the_same_bytes_after_a_restart(setup, tmp_path):
    d, worker, _ = setup(reply([params("relational", 0.5, 3)]))
    worker.run_once()
    first = d.next_task("u1", schema_type="relational", session_id="s1", seq=0)
    assert "-llm-" in first.task_id
    d.flush()
    again = Dispatcher(registry_dir=lambda: tmp_path / "registry", background=False, clock=Clock(),
                       variants=VariantArchive(lambda: tmp_path / "variants").get)
    try:
        replay = again.next_task("u1", schema_type="relational", session_id="s1", seq=0)
    finally:
        again.close()
    assert replay.replay and replay.body == first.body


def test_a_tampered_archive_entry_is_not_replayed(tmp_path):
    archive = VariantArchive(lambda: tmp_path)
    p = params("stroop", 0.5, 1)
    task_id, seed = lw.variant_id("stroop", p)
    payload = {"task_id": task_id, "dimension": "executive_function", "schema_type": "stroop", "params": p, "surface_seed": seed}
    archive.put(payload, {"source": "llm"})
    assert archive.get(task_id) == lw.serialise(payload)
    doc = json.loads((tmp_path / f"{task_id}.json").read_text())
    doc["payload"]["params"]["time_limit_ms"] += 1
    (tmp_path / f"{task_id}.json").write_text(json.dumps(doc))
    assert archive.get(task_id) is None
    assert archive.get("stroop-llm-0000000000000000") is None


def test_old_archive_entries_are_purged(tmp_path):
    import os

    archive = VariantArchive(lambda: tmp_path)
    p = params("stroop", 0.5, 2)
    task_id, seed = lw.variant_id("stroop", p)
    archive.put({"task_id": task_id, "dimension": "executive_function", "schema_type": "stroop", "params": p, "surface_seed": seed}, {})
    old = T0 - (lw.ARCHIVE_DAYS + 1) * 86_400
    os.utime(tmp_path / f"{task_id}.json", (old, old))
    assert archive.purge(now=T0) == 1 and not archive.has(task_id)


# --- invalid variants are rejected ----------------------------------------------------------------


def flip_first_relational_answer(p: dict) -> dict:
    p = copy.deepcopy(p)
    p["levels"][0][0]["answer"] = not p["levels"][0][0]["answer"]
    return p


def test_invalid_variants_are_rejected_and_counted(setup):
    good = params("stroop", 0.5, 1)
    wrong_ink = copy.deepcopy(good)
    t = wrong_ink["trials"][0]
    t["answer"] = next(c for c in good["colors"] if c != t["ink"])  # the solver catches it
    missing = {k: v for k, v in good.items() if k != "time_limit_ms"}  # the schema catches it
    d, worker, _ = setup(reply([wrong_ink, missing]), schema="stroop")
    assert worker.run_once() == "ok"
    assert worker.stats["rejected"] == 2
    assert worker.stats["rejected_solver"] == 1 and worker.stats["rejected_schema"] == 1
    assert worker.stats["accepted"] == 0 and d.pool_stock()[("neutral", "stroop", 0.5)] == (0, 0)
    assert "-llm-" not in served(d, "u1", "stroop")["task_id"]


def test_a_wrong_relational_answer_is_caught_by_the_solver(setup):
    d, worker, _ = setup(reply([flip_first_relational_answer(params("relational", 0.5, 4))]))
    worker.run_once()
    assert worker.stats["rejected_solver"] == 1 and worker.stats["offered"] == 0


def test_a_wrong_matrix_answer_is_caught_by_the_solver(setup):
    variants = [params("matrix", 0.5, s) for s in range(1, 7)]
    variants[0]["answer"] = (variants[0]["answer"] + 1) % len(variants[0]["options"])
    d, worker, _ = setup(reply(variants), schema="matrix")
    worker.run_once()
    assert worker.stats["rejected_solver"] == 1 and worker.stats["offered"] == 5


def test_a_variant_of_the_wrong_shape_is_rejected(setup):
    short = params("stroop", 0.5, 1)
    short["trials"] = short["trials"][:20]  # valid Stroop, but not the level's 96 trials
    other_level = params("stroop", 0.9, 2)  # another time limit
    d, worker, _ = setup(reply([short, other_level]), schema="stroop")
    worker.run_once()
    assert worker.stats["rejected_shape"] == 2 and worker.stats["offered"] == 0


def test_garbage_replies_are_rejected_not_served(setup):
    p = params("stroop", 0.5, 1)
    for text in ("not json", '{"variants": [], "extra": 1}', '{"variants": [{"a": 1, "a": 2}]}', '{"variants": [NaN]}'):
        d, worker, _ = setup(reply(text), schema="stroop")
        assert worker.run_once() == "ok"
        assert worker.stats["rejected_parse"] == 1 and worker.stats["offered"] == 0
    d, worker, _ = setup(reply([p, p]), schema="stroop")  # the same variant twice
    worker.run_once()
    assert worker.stats["offered"] == 1 and worker.stats["rejected_duplicate"] == 1


# --- content safety ---------------------------------------------------------------------------------


def rename_term(p: dict, new: str) -> dict:
    """Rename the first term of the first item everywhere in that item (the answer still holds)."""
    p = copy.deepcopy(p)
    item = p["levels"][0][0]
    old = item["premises"][0]["a"]
    for s in item["premises"] + [item["question"]]:
        for k in ("a", "b"):
            if s[k] == old:
                s[k] = new
    return p


@pytest.mark.parametrize(
    "term, why",
    [
        ("patient", "banned terms: clinical_diagnostic"),  # the shared banned-terms lint
        ("iq", "banned terms: clinical_diagnostic"),
        ("killab", "profanity or harm list"),  # a harm stem inside a term
        ("sex", "profanity or harm list"),
        ("black", "profanity or harm list"),  # identity words never sit in a comparison
        ("bad", "a real or rude short word as a term"),  # the generator's own blocked words
    ],
)
def test_the_denylist_still_flags_bad_relational_terms(term, why):
    """Defence in depth: the lint and the harm list still read LLM terms (the renaming below means
    they are never shown anyway)."""
    variant = rename_term(params("relational", 0.5, 5), term)
    assert validate_payload({**generate("relational", 0.5, 5), "params": variant}) == []  # only content is wrong
    assert why in lw.content_problems("relational", variant)


def rename_items(p: dict, words: list[str]) -> dict:
    """Rename the first term of the first len(words) items of level 1, one word per item."""
    p = copy.deepcopy(p)
    for item, new in zip(p["levels"][0], words):
        old = item["premises"][0]["a"]
        for s in item["premises"] + [item["question"]]:
            for k in ("a", "b"):
                if s[k] == old:
                    s[k] = new
    return p


SLURS = ["kike", "spic", "coon", "chink", "gook", "wetback", "patient", "iq", "killab", "black"]


def test_relational_terms_are_always_procedural_tokens(setup):
    """Term safety is structural: whatever words the LLM writes, the served block shows only fresh
    procedural tokens, renamed consistently per item, and the solver's answers are unchanged."""
    from dynamic_cache.generators.relational import BLOCKED, CONSONANTS, VOWELS

    variant = rename_items(params("relational", 0.5, 5), SLURS)
    d, worker, _ = setup(reply([variant]))
    assert worker.run_once() == "ok" and worker.stats["offered"] == 1
    body = d.next_task("u1", schema_type="relational").body.decode()
    task = json.loads(body)
    assert "-llm-" in task["task_id"] and validate_payload(task) == []
    for word in SLURS:
        assert f'"{word}"' not in body
    terms = set(lw.visible_text("relational", task["params"]))
    assert all(len(t) == 3 and t[0] in CONSONANTS and t[1] in VOWELS and t[2] in CONSONANTS for t in terms)
    assert not terms & BLOCKED
    # same structure, same answers: only the names changed
    for lv_in, lv_out in zip(variant["levels"], task["params"]["levels"]):
        for a, b in zip(lv_in, lv_out):
            assert (a["answer"], a["inverted"], a["hops"]) == (b["answer"], b["inverted"], b["hops"])
            assert [s["rel"] for s in a["premises"]] == [s["rel"] for s in b["premises"]]
    # the id is the hash of what is served, and equal LLM output gives the equal variant
    assert task["task_id"] == lw.variant_id("relational", task["params"])[0]
    assert lw.rename_terms(variant) == lw.rename_terms(copy.deepcopy(variant))


def test_stroop_words_come_only_from_the_colour_set():
    p = params("stroop", 0.5, 1)
    assert lw.content_problems("stroop", p) == []
    p["trials"][0]["word"] = "PURPLE"
    assert "a Stroop word outside the colour set" in lw.content_problems("stroop", p)
    payload = {**generate("stroop", 0.5, 1, inks="classic"), "params": p}
    assert validate_payload(payload)  # and the solver refuses it before content is even read


def test_clean_variants_pass_the_content_check():
    for schema in lw.SCHEMAS:
        for seed in range(20):
            assert lw.content_problems(schema, params(schema, 0.3, seed)) == []


def test_procedural_terms_meet_the_same_bar():
    """Every term the relational generator can spell passes the LLM content check (BE-13 added 39
    slurs, rude words and insults to relational.BLOCKED; all of them were spellable)."""
    from dynamic_cache.generators.relational import BLOCKED, CONSONANTS, VOWELS

    terms = {a + b + c for a in CONSONANTS for b in VOWELS for c in CONSONANTS} - BLOCKED
    hit = sorted(t for t in terms if t in lw.HARM_WORDS or any(s in t for s in lw.HARM_STEMS))
    assert hit == []
    added = set("fag jew tit fap vag vaj zeb fak fok git fek nit dum nul jip neg kut lul kuk pik kus".split())
    assert lw.HARM_WORDS >= added and BLOCKED >= added


# --- off, failures, budget -------------------------------------------------------------------------


@pytest.mark.parametrize(
    "env",
    [
        {},
        {"GEMINI_API_KEY": "  "},
        {"GEMINI_API_KEY": KEY, "LLM_POOL_RPM": "0"},
        {"GEMINI_API_KEY": KEY, "LLM_POOL_DAILY_CAP": "0"},
        {"GEMINI_API_KEY": KEY, "LLM_POOL_RPM": "fast"},
        {"GEMINI_API_KEY": KEY, "LLM_POOL_RPM": "nan"},
    ],
)
def test_without_a_key_or_with_the_pool_switched_off_there_is_no_worker(env):
    assert lw.pool_config(env) is None
    assert LlmPoolWorker.from_env(lambda: None, env) is None


def test_with_a_key_the_defaults_are_bounded():
    assert lw.pool_config({"GEMINI_API_KEY": KEY}) == (lw.DEFAULT_RPM, lw.DEFAULT_DAILY_CAP)
    assert lw.pool_config({"GEMINI_API_KEY": KEY, "LLM_POOL_RPM": "1000", "LLM_POOL_DAILY_CAP": "5"}) == (lw.MAX_RPM, 5)
    worker = LlmPoolWorker.from_env(lambda: None, {"GEMINI_API_KEY": KEY})
    assert worker is not None and worker.runner.timeout_s == lw.CALL_TIMEOUT_S
    assert KEY not in repr(worker.runner)
    worker.runner.close()


def test_no_key_means_no_call_from_the_server(monkeypatch):
    calls = []
    monkeypatch.setattr(GeminiRunner, "generate", lambda *a, **k: calls.append(1))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("LLM_POOL_RPM", raising=False)
    api.start_llm_pool()
    try:
        assert api._llm_worker is None
    finally:
        api.stop_llm_pool()
    assert calls == []


def test_the_server_starts_and_stops_the_worker_with_a_key(monkeypatch, tmp_path):
    called = threading.Event()

    def fake_generate(self, *a, **k):
        called.set()
        raise lw.GeminiError("HTTP 503")

    monkeypatch.setattr(GeminiRunner, "generate", fake_generate)
    monkeypatch.setenv("GEMINI_API_KEY", KEY)
    monkeypatch.setenv("LLM_POOL_RPM", "60")
    api.get_dispatcher().next_task("warmup", schema_type="stroop")  # a pool in use
    api.start_llm_pool()
    try:
        assert api._llm_worker is not None
        assert called.wait(5)
    finally:
        api.stop_llm_pool()
    assert api._llm_worker is None


@pytest.mark.parametrize(
    "answer, stat",
    [
        (httpx.Response(500), "errors"),
        (httpx.Response(429), "rate_limited"),
        (httpx.ConnectError("offline"), "errors"),
        (httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}}), "errors"),
    ],
)
def test_errors_fail_safe_and_back_off(setup, answer, stat):
    clock = Clock()
    d, worker, fake = setup(answer, clock=clock)
    assert worker.run_once() == "error"
    assert worker.stats[stat] == 1 and worker.stats["offered"] == 0
    # nothing entered the pools, and tasks are still served procedurally
    assert d.pool_stock()[("neutral", "relational", 0.5)] == (0, 0)
    assert "-llm-" not in served(d, "u1", "relational")["task_id"]
    # backing off: no new call until the pause is over, and a longer pause after a 429
    base = lw.RATE_LIMIT_BACKOFF_S if stat == "rate_limited" else lw.ERROR_BACKOFF_S
    clock.t += base - 1
    assert worker.run_once() == "paused" and len(fake.requests) == 1
    clock.t += 1
    assert worker.run_once() == "error" and len(fake.requests) == 2
    clock.t += 2 * base - 1
    assert worker.run_once() == "paused"  # the pause doubled
    clock.t += 1
    assert worker.run_once() == "error" and len(fake.requests) == 3


def test_a_worker_error_never_reaches_the_request_path(setup):
    d, worker, _ = setup(httpx.ConnectError("offline"))
    worker.run_once()
    for k in range(5):
        assert validate_payload(served(d, f"u{k}", "relational")) == []


def test_the_rate_is_respected(setup):
    clock = Clock()
    d, worker, fake = setup(reply([params("relational", 0.5, 1)]), clock=clock, rpm=2)
    assert worker.run_once() == "ok"
    clock.t += 29
    assert worker.run_once() == "rate"
    clock.t += 1
    assert worker.run_once() == "ok"
    assert len(fake.requests) == 2


def test_the_daily_budget_is_respected_and_survives_a_restart(setup, tmp_path):
    clock = Clock()
    seeds = iter(range(1, 100))

    def answer(request):
        return reply([params("matrix", 0.5, next(seeds))])

    d, worker, fake = setup(answer, schema="matrix", clock=clock, daily_cap=3, rpm=60)
    outcomes = []
    for _ in range(6):
        outcomes.append(worker.run_once())
        clock.t += 1
    assert outcomes[:3] == ["ok"] * 3 and outcomes[3:] == ["budget"] * 3
    assert len(fake.requests) == 3 and worker.stats["budget_skips"] == 3 and worker.stats["offered"] == 3
    # a restart the same UTC day: still spent
    _, again, fake2 = setup(answer, schema="matrix", clock=clock, daily_cap=3, rpm=60)
    assert again.run_once() == "budget" and fake2.requests == []
    # the next UTC day: room again
    clock.t += 86_400
    assert again.run_once() == "ok" and len(fake2.requests) == 1


def test_variants_the_dispatcher_refuses_cool_the_pool(setup, monkeypatch):
    """Accepted but not stocked (no room): a miss, so the pool cools down instead of being asked
    again at once."""
    clock = Clock()
    seeds = iter(range(1, 100))
    d, worker, fake = setup(lambda request: reply([params("matrix", 0.5, next(seeds))]), schema="matrix", clock=clock)
    monkeypatch.setattr(d, "offer", lambda *a, **k: 0)
    assert worker.run_once() == "ok"
    assert worker.stats["accepted"] == 1 and worker.stats["offered"] == 0
    clock.t += 60
    assert worker.run_once() == "no_target" and len(fake.requests) == 1  # cooling
    clock.t += lw.POOL_COOL_FIRST_S
    assert worker.run_once() == "ok" and len(fake.requests) == 2


def test_an_unreadable_budget_is_spent_today_and_rewritten(setup, tmp_path, caplog):
    clock = Clock()
    d, worker, fake = setup(reply([params("relational", 0.5, 1)]), clock=clock)
    (tmp_path / "variants").mkdir(exist_ok=True)
    (tmp_path / "variants" / "budget.json").write_text("{torn")
    assert worker.run_once() == "budget" and fake.requests == []
    doc = json.loads((tmp_path / "variants" / "budget.json").read_text())
    assert doc == {"day": lw.Budget.day(clock.t), "calls": 100}
    assert sum("budget unreadable" in r.message for r in caplog.records) == 1
    assert worker.run_once() == "budget"  # no second warning: the file reads again
    assert sum("budget unreadable" in r.message for r in caplog.records) == 1
    clock.t += 86_400
    assert worker.run_once() == "ok" and len(fake.requests) == 1  # not off for good


def test_writes_use_a_per_process_tmp_name(setup, tmp_path, monkeypatch):
    names = []
    real = lw.os.replace
    monkeypatch.setattr(lw.os, "replace", lambda a, b: (names.append(Path(a).name), real(a, b)))
    d, worker, _ = setup(reply([params("relational", 0.5, 1)]))
    worker.run_once()
    pid = str(lw.os.getpid())
    assert len(names) == 2 and all(n.endswith(f".{pid}.tmp") for n in names)  # budget + archive
    assert not list((tmp_path / "variants").glob("*.tmp"))


def test_a_replay_runs_the_content_gate_again(tmp_path):
    archive = VariantArchive(lambda: tmp_path)
    bad = lw._envelope("relational", rename_items(params("relational", 0.5, 5), ["coon"]))  # an older, laxer build
    archive.put(bad, {"source": "llm"})
    assert archive.get(bad["task_id"]) is None
    ok = lw._envelope("relational", params("relational", 0.5, 5))
    archive.put(ok, {"source": "llm"})
    assert archive.get(ok["task_id"]) == lw.serialise(ok)


def test_the_purge_removes_stale_tmp_files(tmp_path):
    import os

    archive = VariantArchive(lambda: tmp_path)
    stale, fresh = tmp_path / "stroop-llm-00.json.123.tmp", tmp_path / "budget.json.456.tmp"
    stale.write_text("x")
    fresh.write_text("x")
    old = T0 - 2 * lw.STALE_TMP_S
    os.utime(stale, (old, old))
    os.utime(fresh, (T0, T0))
    archive.purge(now=T0)
    assert not stale.exists() and fresh.exists()


def test_an_unwritable_budget_means_no_call(setup, tmp_path, monkeypatch):
    d, worker, fake = setup(reply([params("relational", 0.5, 1)]))
    monkeypatch.setattr(lw.os, "replace", lambda *a: (_ for _ in ()).throw(PermissionError()))
    assert worker.run_once() == "budget" and fake.requests == []


def test_no_pool_in_use_means_no_call(setup):
    d, worker, fake = setup(reply([params("relational", 0.5, 1)]), pool=False)
    assert worker.run_once() == "no_target" and fake.requests == []
    d2, worker2, fake2 = setup(reply([]), schema="n_back")  # a schema the LLM does not write
    assert worker2.run_once() == "no_target" and fake2.requests == []


def test_a_full_llm_share_stops_the_calls(setup):
    variants = [params("matrix", 0.5, s) for s in range(1, 13)]
    answers = [reply(variants[:6]), reply(variants[6:])]
    d, worker, fake = setup(*answers, schema="matrix", per_pool=6)
    assert worker.run_once() == "ok"
    worker._next_call = 0
    assert worker.run_once() == "no_target" and len(fake.requests) == 1


# --- the dispatcher hook on hot pools (offer / pool_stock) ---------------------------------------


class Mono:
    def __init__(self, t: float = 1000.0) -> None:
        self.t = t

    def __call__(self) -> float:
        return self.t


def llm_entries(n: int, size: int = 0, start: int = 500) -> list:
    """Real stroop variants as LLM entries (bodies padded to `size` when given)."""
    out = []
    for k in range(n):
        payload = lw._envelope("stroop", params("stroop", 0.5, start + k))
        body = lw.serialise(payload)
        out.append(lw.Entry(payload["task_id"], body + b" " * max(0, size - len(body)), 0, "llm"))
    return out


def bytes_consistent(d: Dispatcher) -> None:
    assert d._pool_bytes == sum(len(e.body) for pool in d._pools.values() for e in pool)
    for key, pool in d._pools.items():
        assert d._key_bytes.get(key, 0) == sum(len(e.body) for e in pool)


@pytest.fixture
def disp(tmp_path):
    made = []

    def _make(**kw):
        mono = Mono()
        d = Dispatcher(registry_dir=lambda: tmp_path / "registry", background=False, pool_size=8, **kw)
        d._mono = mono
        made.append(d)
        return d, mono

    yield _make
    for d in made:
        d.close()


KEY_S = ("neutral", "stroop", 0.5)


def test_offer_needs_a_pool_in_use(disp):
    d, mono = disp()
    assert d.offer("neutral", "stroop", 0.5, llm_entries(2)) == 0  # no such pool: never created
    assert KEY_S not in d._pools and d.pool_stock() == {}
    d.warm(schema_types=("stroop",), at=0.5)
    assert d.pool_stock() == {KEY_S: (8, 0)}
    mono.t += d.pool_idle_s + 1  # idle: floor 0
    assert d.offer("neutral", "stroop", 0.5, llm_entries(2)) == 0
    assert d.pool_stock() == {}  # only pools in use are listed
    d.close()
    assert d.offer("neutral", "stroop", 0.5, llm_entries(2)) == 0


def test_offer_to_a_pool_created_by_a_request_does_not_raise(disp):
    """A request's setdefault makes an empty pool with no _key_bytes entry; offers and pops after
    it must keep the tallies (this was a KeyError in _take)."""
    d, _ = disp()
    d.next_task("u0", schema_type="stroop")
    assert KEY_S in d._pools and KEY_S not in d._key_bytes
    assert d.offer("neutral", "stroop", 0.5, llm_entries(3)) == 3
    for k in range(5):
        d.next_task(f"u{k + 1}", schema_type="stroop")
        bytes_consistent(d)


def test_pool_bytes_stay_exact_through_offers_and_pops(disp):
    d, _ = disp()
    d.warm(schema_types=("stroop",), at=0.5)
    before = list(d._pools[KEY_S])
    assert d.offer("neutral", "stroop", 0.5, llm_entries(3)) == 3
    pool = list(d._pools[KEY_S])
    assert len(pool) == 8  # within the target: three procedural entries made room
    assert [e.source for e in pool[:3]] == ["llm"] * 3  # served first
    assert pool[3:] == before[:5]
    bytes_consistent(d)
    served_ids = [d.next_task(f"u{k}", schema_type="stroop").task_id for k in range(4)]
    assert all("-llm-" in t for t in served_ids[:3]) and "-llm-" not in served_ids[3]
    bytes_consistent(d)
    assert d.offer("neutral", "stroop", 0.5, [lw.Entry("stroop-1-x", b"{}", 1)]) == 0  # never procedural


def test_a_full_pool_of_paid_entries_takes_no_more(disp):
    d, _ = disp()
    d.next_task("u0", schema_type="stroop")
    assert d.offer("neutral", "stroop", 0.5, llm_entries(12)) == 8  # the target: floor 8 at low demand
    assert d.offer("neutral", "stroop", 0.5, llm_entries(1, start=900)) == 0
    bytes_consistent(d)


def test_an_offer_stops_at_pool_bytes_max(disp):
    # The growth share below the cap, as in test_dispatcher (else the floors' share is negative and
    # the pool loses its floor); the floors' share still covers 8 entries at the 16 KB size guess.
    d, _ = disp(pool_bytes_max=300_000)
    d.pool_growth_bytes = 1_000
    d.next_task("u0", schema_type="stroop")
    assert d.offer("neutral", "stroop", 0.5, llm_entries(5, size=100_000)) == 2
    assert d._pool_bytes == 200_000 <= d.pool_bytes_max
    bytes_consistent(d)


def test_an_offer_keeps_the_floor_share_tally(disp):
    """Entries landing within the floor count into _floor_bytes and stop at floor_bytes_max, as in
    _refilled; an evicted procedural entry within the floor is taken off it. The tally after an
    offer matches the sweep's own recount."""
    d, mono = disp()
    d.pool_growth_bytes = d.pool_bytes_max - 150_000  # floors' share: 150 000 bytes
    d.next_task("u0", schema_type="stroop")
    assert d.offer("neutral", "stroop", 0.5, llm_entries(3, size=100_000)) == 1  # the 2nd passes it
    assert d._floor_bytes == 100_000 <= d.floor_bytes_max

    d2, mono2 = disp()
    d2.warm(schema_types=("stroop",), at=0.5)  # 8 procedural entries, all within the floor
    with d2._lock:
        d2._swept_at = 0.0
        d2._sweep(mono2.t)
        tallied = d2._floor_bytes
    out = len(d2._pools[KEY_S][-1].body)
    new = llm_entries(1)
    assert d2.offer("neutral", "stroop", 0.5, new) == 1  # full: the rightmost procedural one makes way
    assert d2._floor_bytes == tallied - out + len(new[0].body)
    with d2._lock:
        d2._swept_at = 0.0
        d2._sweep(mono2.t)
    assert d2._floor_bytes == tallied - out + len(new[0].body)  # the sweep agrees
    bytes_consistent(d2)


def test_offered_entries_survive_a_sweep_at_low_demand(disp):
    d, mono = disp()
    d.warm(schema_types=("stroop",), at=0.5)
    with d._lock:
        d._demand[KEY_S] = (10.0, mono.t)  # a wave: target 20
        assert d._want(KEY_S, mono.t) == 20
        while len(d._pools[KEY_S]) < 20:
            assert d._add(KEY_S, lw.Entry(f"stroop-{len(d._pools[KEY_S])}-pad", b"x" * 100, 1))
    assert d.offer("neutral", "stroop", 0.5, llm_entries(3)) == 3
    ids = [e.task_id for e in list(d._pools[KEY_S])[:3]]
    mono.t += 60  # the wave is over (demand decays), the pool still in use
    with d._lock:
        d._swept_at = 0.0
        d._sweep(mono.t)
    pool = list(d._pools[KEY_S])
    assert len(pool) == 8 and [e.task_id for e in pool[:3]] == ids  # the paid ones stayed
    bytes_consistent(d)


def test_an_offer_is_not_demand(disp):
    d, mono = disp()
    d.warm(schema_types=("stroop",), at=0.5)
    snapshot = (dict(d._active_at), dict(d._demand), dict(d._inflight))
    mono.t += 5
    d.offer("neutral", "stroop", 0.5, llm_entries(2))
    assert (dict(d._active_at), dict(d._demand), dict(d._inflight)) == snapshot


# --- one failing pool cannot take the budget --------------------------------------------------


def test_a_pool_that_is_always_rejected_does_not_starve_the_others(setup):
    seeds = iter(range(1000, 2000))
    calls = {"relational": 0, "stroop": 0}

    def answer(request):
        text = json.loads(request.content)["contents"][0]["parts"][0]["text"]
        if "one relational task" in text:
            calls["relational"] += 1
            return reply([flip_first_relational_answer(params("relational", 0.5, 4))])  # always wrong
        calls["stroop"] += 1
        return reply([params("stroop", 0.5, next(seeds)) for _ in range(2)])

    clock = Clock()
    d, worker, _ = setup(answer, clock=clock, rpm=60, per_pool=100)
    d.next_task("warm2", schema_type="stroop")  # a second pool in use
    for k in range(12):  # t = 0, 30, ..., 330 s
        worker.run_once()
        for u in range(2):  # stroop is played, so its pool keeps room for the 2 new variants
            d.next_task(f"player{k}-{u}", schema_type="stroop")
        clock.t += 30
    # relational: at 0 s, then when its first cool-down (300 s) ended; the next one is 600 s
    assert calls["relational"] == 2 and worker.stats["rejected_solver"] == 2
    assert calls["stroop"] == 10 and worker.stats["accepted"] == 20


# --- no user data -------------------------------------------------------------------------------------


def test_the_prompt_carries_no_user_data(setup):
    d, worker, fake = setup(reply([params("relational", 0.5, 1)]))
    d.next_task("someone-private-42", schema_type="relational", session_id="sess-secret", seq=0)
    worker._next_call = 0
    worker.run_once()
    sent = json.dumps(fake.requests)
    assert "someone-private-42" not in sent and "sess-secret" not in sent


def test_the_variant_archive_holds_no_user_data(setup, tmp_path):
    d, worker, _ = setup(reply([params("relational", 0.5, 9)]))
    worker.run_once()
    d.next_task("someone-private-42", schema_type="relational")
    for f in (tmp_path / "variants").iterdir():
        assert "someone-private-42" not in f.read_text()


def test_the_response_schema_is_what_gemini_accepts():
    banned = {"$ref", "pattern", "additionalProperties", "uniqueItems", "anyOf", "contains", "$comment", "additionalItems"}

    def walk(node):
        if isinstance(node, dict):
            assert not banned & set(node), banned & set(node)
            if "enum" in node:
                assert node["type"] == "string"
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    for schema in lw.SCHEMAS:
        walk(lw.response_schema(schema, 2))
    cells = lw.response_schema("matrix", 1)["properties"]["variants"]["items"]["properties"]["cells"]
    assert cells["items"]["nullable"] is True
