"""BE-13 LLM pool worker, with Gemini mocked at the HTTP transport (the real GeminiRunner runs)."""

from __future__ import annotations

import copy
import json
import threading

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
        d = Dispatcher(registry_dir=lambda: tmp_path / "registry", background=False, pool_size=4,
                       variants=VariantArchive(lambda: tmp_path / "variants").get, clock=clock)
        made.append(d)
        if pool:  # a pool exists once it was asked for (here: created empty)
            d.offer("neutral", schema, level, [])
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
    assert task["params"] in variants
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
def test_the_lint_blocks_bad_words_in_relational_terms(setup, term, why):
    variant = rename_term(params("relational", 0.5, 5), term)
    assert validate_payload({**generate("relational", 0.5, 5), "params": variant}) == []  # only content is wrong
    assert why in lw.content_problems("relational", variant)
    d, worker, _ = setup(reply([variant]))
    worker.run_once()
    assert worker.stats["rejected_content"] == 1 and worker.stats["offered"] == 0


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
    """Every term the relational generator can spell passes the LLM content check. (Before BE-13
    it could spell four slurs or rude words; relational.BLOCKED now has them.)"""
    from dynamic_cache.generators.relational import BLOCKED, CONSONANTS, VOWELS

    terms = {a + b + c for a in CONSONANTS for b in VOWELS for c in CONSONANTS} - BLOCKED
    hit = sorted(t for t in terms if t in lw.HARM_WORDS or any(s in t for s in lw.HARM_STEMS))
    assert hit == []
    assert lw.HARM_WORDS >= {"fag", "jew", "tit", "fap"} and BLOCKED >= {"fag", "jew", "tit", "fap"}


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
    api.get_dispatcher().offer("neutral", "stroop", 0.5, [])  # a pool in use
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


def test_the_offer_hook_is_bounded(tmp_path):
    d = Dispatcher(registry_dir=lambda: tmp_path, background=False, pool_size=2)
    entries = [lw.Entry(f"stroop-llm-{k:016x}", b"{}", 0, "llm") for k in range(10)]
    assert d.offer("neutral", "stroop", 0.5, entries) == 4  # at most 2 x pool_size
    assert d.offer("neutral", "stroop", 0.5, [lw.Entry("x", b"{}", 1)]) == 0  # never a procedural entry
    d.close()
    assert d.offer("neutral", "stroop", 0.5, entries) == 0


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
