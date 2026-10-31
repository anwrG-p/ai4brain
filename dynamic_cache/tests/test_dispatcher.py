"""BE-04 dispatcher: filters, idempotency, no repeats within 14 days, difficulty, registry, latency."""

from __future__ import annotations

import itertools
import json
import math
import threading
import time

import pytest

from app.tools.exercise_generator import ExerciseGenerator
from dynamic_cache import cache_dispatcher as cd
from dynamic_cache.bloom import DAY_S
from dynamic_cache.cache_dispatcher import Dispatcher, NoFreshTask, TelemetryAccuracy, accuracy_by_schema
from dynamic_cache.generators import DIMENSION_OF, SCHEMA_TYPES
from dynamic_cache.generators.stroop import INK_PRESETS
from dynamic_cache.parameter_projector import START_THETA

T0 = 1_790_000_000.0


class Clock:
    def __init__(self, t: float = T0) -> None:
        self.t = t

    def __call__(self) -> float:
        return self.t


@pytest.fixture
def make(tmp_path):
    made = []

    def _make(**kw):
        kw.setdefault("registry_dir", lambda: tmp_path / "registry")
        kw.setdefault("background", False)
        kw.setdefault("difficulty_rule", ExerciseGenerator.apply_85_percent_rule)
        d = Dispatcher(**kw)
        made.append(d)
        return d

    yield _make
    for d in made:
        d.close()


def task(served) -> dict:
    return json.loads(served.body)


def events(schema: str, errors: list[bool], session: str = "s1", received_at: str = "2026-10-31T10:00:00+00:00"):
    return [
        json.dumps(
            {
                "user_id": "u1",
                "session_id": session,
                "task_id": f"{schema}-7-abcdef0123",
                "trial_index": i,
                "error_flag": err,
                "received_at": received_at,
            }
        )
        for i, err in enumerate(errors)
    ]


# --- filters ---------------------------------------------------------------------------------------


@pytest.mark.parametrize("schema_type", SCHEMA_TYPES)
def test_schema_filter(make, schema_type):
    d = make()
    for _ in range(3):
        t = task(d.next_task("u1", schema_type=schema_type))
        assert t["schema_type"] == schema_type and t["dimension"] == DIMENSION_OF[schema_type]


@pytest.mark.parametrize("dimension", sorted(set(DIMENSION_OF.values())))
def test_dimension_filter_cycles_its_schemas(make, dimension):
    d = make()
    allowed = {s for s, dim in DIMENSION_OF.items() if dim == dimension}
    got = {task(d.next_task("u1", dimension=dimension))["schema_type"] for _ in range(2 * len(allowed))}
    assert got == allowed


def test_filters_that_disagree_raise(make):
    with pytest.raises(ValueError):
        make().next_task("u1", schema_type="stroop", dimension="working_memory")


def test_no_filter_cycles_through_all_eight_schemas(make):
    d = make()
    first = [task(d.next_task("u1"))["schema_type"] for _ in range(8)]
    assert first == list(SCHEMA_TYPES)
    assert task(d.next_task("u1"))["schema_type"] == SCHEMA_TYPES[0]


# --- idempotency -----------------------------------------------------------------------------------


def test_same_session_and_seq_returns_the_same_task(make):
    d = make()
    a = d.next_task("u1", session_id="s1", seq=0)
    b = d.next_task("u1", session_id="s1", seq=0)
    assert a.body == b.body and b.replay
    c = d.next_task("u1", session_id="s1", seq=1)
    assert c.task_id != a.task_id
    assert d.next_task("u1", session_id="s2", seq=0).task_id != a.task_id
    assert d.next_task("u2", session_id="s1", seq=0).task_id != a.task_id  # per user


def test_filter_is_part_of_the_idempotency_key(make):
    d = make()
    a = d.next_task("u1", session_id="s1", schema_type="stroop")
    b = d.next_task("u1", session_id="s1", schema_type="mst")
    assert task(a)["schema_type"] == "stroop" and task(b)["schema_type"] == "mst"
    assert d.next_task("u1", session_id="s1", schema_type="stroop").body == a.body


def test_without_a_session_every_call_is_a_new_task(make):
    d = make()
    ids = {d.next_task("u1", schema_type="tower").task_id for _ in range(5)}
    assert len(ids) == 5


def test_idempotent_across_a_restart(make):
    a = make()
    first = a.next_task("u1", session_id="s1", seq=3, schema_type="relational")
    a.flush()
    b = make()  # a new process: empty pools and replay cache, the registry from disk
    again = b.next_task("u1", session_id="s1", seq=3, schema_type="relational")
    assert again.body == first.body and again.replay


def test_a_double_get_in_flight_gets_one_task(make):
    """StrictMode's double effect: two concurrent GETs for the same (user, session, seq)."""
    d = make()
    out = []
    barrier = threading.Barrier(8)

    def call():
        barrier.wait()
        out.append(d.next_task("u1", session_id="strict", seq=0).body)

    threads = [threading.Thread(target=call) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(set(out)) == 1


# --- no repeat within 14 days ----------------------------------------------------------------------


def test_no_repeat_within_14_days_simulated_clock(make):
    clock = Clock()
    # Every build uses seed 7, so the only task there is to serve is the same one.
    d = make(clock=clock, seed_source=lambda: 7)
    first = d.next_task("u1", schema_type="matrix")
    for day in (0, 1, 7, 13, 14):
        clock.t = T0 + day * DAY_S
        with pytest.raises(NoFreshTask):
            d.next_task("u1", schema_type="matrix")
    clock.t = T0 + 16 * DAY_S
    assert d.next_task("u1", schema_type="matrix").task_id == first.task_id
    # Another user was never served it.
    clock.t = T0
    assert d.next_task("u2", schema_type="matrix").task_id == first.task_id


def test_a_seen_task_is_skipped_for_a_fresh_one(make):
    seeds = itertools.chain([7, 7, 7], itertools.count(8))
    d = make(seed_source=lambda: next(seeds))
    a = d.next_task("u1", schema_type="tower")
    b = d.next_task("u1", schema_type="tower")
    assert a.task_id != b.task_id and b.task_id.startswith("tower-8-")


def test_pool_entries_a_user_saw_stay_for_others(make):
    seeds = itertools.cycle([7, 8])
    d = make(seed_source=lambda: next(seeds), pool_size=2)
    d.warm(schema_types=("tower",), at=START_THETA["tower"])
    a = d.next_task("u1", schema_type="tower")  # takes seed 7 from the pool
    d._fill(("neutral", "tower", 0.5))  # refills seeds 7 and 8 again
    assert d.next_task("u1", schema_type="tower").task_id != a.task_id
    assert d.next_task("u2", schema_type="tower").task_id == a.task_id


def test_a_retake_never_gets_a_task_id_already_served(make):
    """BE-07 dedupes events on (session_id, task_id:trial_index, stream): a second run of the same
    task_id in one session would have its trials dropped. Only a replay of the SAME run (same
    session_id, seq and filter) returns a served task_id again; any other call gets a new one."""
    d = make()
    ids = [d.next_task("u1", session_id="s1", seq=k, schema_type="tower").task_id for k in range(20)]
    ids += [d.next_task("u1", session_id="s1", schema_type=None, seq=k).task_id for k in range(20, 40)]
    ids += [d.next_task("u1").task_id for _ in range(20)]  # no session at all
    assert len(set(ids)) == len(ids)
    # The same run asked twice (StrictMode) is the only repeat.
    assert d.next_task("u1", session_id="s1", seq=0, schema_type="tower").task_id == ids[0]


def test_a_retake_when_only_the_old_task_is_buildable_is_refused_not_repeated(make):
    d = make(seed_source=lambda: 7)
    d.next_task("u1", session_id="s1", seq=0, schema_type="matrix")
    with pytest.raises(NoFreshTask):
        d.next_task("u1", session_id="s1", seq=1, schema_type="matrix")


def test_seen_filter_survives_a_restart(make):
    clock = Clock()
    a = make(clock=clock, seed_source=lambda: 7)
    a.next_task("u1", schema_type="ufov")
    a.flush()
    b = make(clock=clock, seed_source=lambda: 7)
    with pytest.raises(NoFreshTask):
        b.next_task("u1", schema_type="ufov")


# --- difficulty: projector seed, 85% rule step -------------------------------------------------------


def test_a_new_user_starts_at_the_prior(make):
    d = make()
    for s in SCHEMA_TYPES:
        assert d.next_task("u1", schema_type=s).theta == cd.theta_level(s, START_THETA[s])


def test_projector_seeds_the_staircase(make):
    d = make(pillars=lambda key: {"focus": 100, "agility": 100} if key == "strong" else {"focus": 0, "agility": 0})
    assert d.next_task("strong", schema_type="n_back").theta == 1.0
    assert d.next_task("weak", schema_type="n_back").theta == 0.0


@pytest.mark.parametrize(
    "errors,direction",
    [([False] * 20, +1), ([False, True] * 10, -1), ([False] * 17 + [True] * 3, 0)],
)
def test_85_percent_rule_moves_theta_from_recent_accuracy(make, tmp_path, errors, direction):
    tdir = tmp_path / "telemetry"
    tdir.mkdir()
    (tdir / "u1.jsonl").write_text("\n".join(events("n_back", errors)) + "\n", encoding="utf-8")
    d = make(accuracy=TelemetryAccuracy(lambda: tdir))
    d.next_task("u1", schema_type="n_back")
    theta = d._users["u1"].schemas["n_back"]["theta"]
    acc = 1 - sum(errors) / len(errors)
    b = ExerciseGenerator.apply_85_percent_rule(acc, 5 * START_THETA["n_back"] - 2.5, step_size=cd.RULE_STEP)
    assert theta == pytest.approx((b + 2.5) / 5)
    assert (theta > START_THETA["n_back"]) - (theta < START_THETA["n_back"]) == direction


def test_the_rule_steps_once_per_batch_of_new_trials(make, tmp_path):
    tdir = tmp_path / "telemetry"
    tdir.mkdir()
    log = tdir / "u1.jsonl"
    log.write_text("\n".join(events("stroop", [False] * 20)) + "\n", encoding="utf-8")
    d = make(accuracy=TelemetryAccuracy(lambda: tdir))
    d.next_task("u1", schema_type="stroop")
    once = d._users["u1"].schemas["stroop"]["theta"]
    d.next_task("u1", schema_type="stroop")  # fetched, never played: no new trials
    assert d._users["u1"].schemas["stroop"]["theta"] == once
    with open(log, "a", encoding="utf-8") as f:
        f.write("\n".join(events("stroop", [False] * 20, session="s2", received_at="2026-10-31T11:00:00+00:00")) + "\n")
    d.next_task("u1", schema_type="stroop")
    assert d._users["u1"].schemas["stroop"]["theta"] > once


def test_perfect_play_walks_up_to_harder_levels_and_stays_bounded(make, tmp_path):
    tdir = tmp_path / "telemetry"
    tdir.mkdir()
    log = tdir / "u1.jsonl"
    d = make(accuracy=TelemetryAccuracy(lambda: tdir))
    levels = []
    for k in range(30):
        with open(log, "a", encoding="utf-8") as f:
            f.write("\n".join(events("ufov", [False] * 12, session=f"s{k}")) + "\n")
        levels.append(d.next_task("u1", schema_type="ufov").theta)
    assert levels == sorted(levels) and levels[-1] == 1.0


def test_accuracy_needs_enough_trials_and_ignores_duplicates_and_fixtures():
    lines = events("mst", [False] * 5)
    assert accuracy_by_schema(lines * 4) == {}  # 5 distinct trials, resent 4 times
    lines += [json.dumps({"session_id": "s", "task_id": "mock-mst-1", "trial_index": i, "error_flag": True}) for i in range(50)]
    lines += ["{torn"]
    assert accuracy_by_schema(lines) == {}
    acc = accuracy_by_schema(events("mst", [False] * 9 + [True]))["mst"]
    assert acc.accuracy == 0.9 and acc.trials == 10


def test_accuracy_window_is_the_most_recent_trials():
    acc = accuracy_by_schema(events("tower", [True] * 100 + [False] * cd.ACCURACY_WINDOW))["tower"]
    assert acc.accuracy == 1.0 and acc.trials == cd.ACCURACY_WINDOW


# --- what is served --------------------------------------------------------------------------------


def test_stroop_is_served_with_the_classic_inks_only(make):
    d = make()
    classic = set(INK_PRESETS["classic"])
    for _ in range(10):
        p = task(d.next_task("u1", schema_type="stroop"))["params"]
        assert set(p["colors"]) <= classic
        assert {t["ink"] for t in p["trials"]} <= classic and "black" not in json.dumps(p)


def test_pools_are_per_archetype(make):
    d = make(archetype=lambda key: "a" if key == "u1" else "b", background=True)
    d.next_task("u1", schema_type="mst")
    d.next_task("u2", schema_type="mst")
    d.close()
    assert {k[0] for k in d._pools} == {"a", "b"}


def test_background_refill_keeps_the_pool_warm(make):
    d = make(background=True, pool_size=4)
    d.warm(schema_types=("matrix",), at=0.5)
    for _ in range(3):
        d.next_task("u1", schema_type="matrix")
    d._workers.shutdown(wait=True)  # the refill ran in the worker process
    # One left after 3 pops; the refill queued at half full added what was missing then (2).
    assert len(d._pools[("neutral", "matrix", 0.5)]) == 3


# --- registry: persistence, delete, export ------------------------------------------------------------


def test_registry_is_written_behind_and_holds_no_task_list(make, tmp_path):
    d = make(background=True)
    d.next_task("u1", session_id="s1")
    d.close()
    doc = json.loads((tmp_path / "registry" / "u1.json").read_text())
    assert set(doc) == {"v", "seen", "sessions", "schemas"}
    assert all(len(v) < 1000 for v in doc["seen"].values())  # base64 bits, not ids


def test_forget_drops_memory_and_file(make, tmp_path):
    clock = Clock()
    d = make(clock=clock, seed_source=lambda: 7)
    d.next_task("u1", schema_type="matrix", session_id="s1")
    d.flush()
    assert (tmp_path / "registry" / "u1.json").exists()
    assert d.forget("u1") == 1
    assert not (tmp_path / "registry" / "u1.json").exists()
    assert d.export("u1") is None
    assert d.forget("u1") == 0
    d.next_task("u1", schema_type="matrix")  # a fresh user: the seen filter is gone too


def test_a_pending_write_cannot_undo_a_delete(make, tmp_path):
    d = make()
    d.next_task("u1")
    d.forget("u1")
    assert d.flush() == 0
    assert not (tmp_path / "registry" / "u1.json").exists()


def test_session_answers_expire_with_the_ttl(make):
    clock = Clock()
    d = make(clock=clock)
    d.next_task("u1", session_id="old")
    clock.t = T0 + 15 * DAY_S
    d.next_task("u1", session_id="new")
    assert [k.split("|")[0] for k in d._users["u1"].sessions] == ["new"]


def test_registry_rejects_keys_that_are_not_user_keys(make):
    with pytest.raises(ValueError):
        make().next_task("../U1")


# --- latency -----------------------------------------------------------------------------------------


def test_p99_under_10_ms_with_warm_pools(make):
    """AC: p99 < 10 ms. Warm pools at the level new users start on; background refills stay on."""
    d = make(background=True, pool_size=48)
    for s in SCHEMA_TYPES:
        d.warm(schema_types=(s,), at=START_THETA[s])
    d.next_task("warmup")  # first-call imports and allocations
    timings = []
    for k in range(320):  # 40 users x 8 schemas, some calls replaying a session
        user = f"bench{k % 40}"
        session = "s1" if k % 5 == 0 else None
        t = time.perf_counter()
        d.next_task(user, session_id=session, seq=k // 40)
        timings.append(time.perf_counter() - t)
    timings.sort()
    p99 = timings[math.ceil(0.99 * len(timings)) - 1]  # nearest rank
    print(f"\nnext_task p50 {timings[len(timings) // 2] * 1e3:.3f} ms, p99 {p99 * 1e3:.3f} ms")
    assert p99 < 0.010


def test_a_failed_registry_write_is_logged_and_retried(make, tmp_path, caplog):
    blocker = tmp_path / "not_a_dir"
    blocker.write_text("x")
    d = make(registry_dir=lambda: blocker)  # mkdir under a file fails
    d.next_task("u1", session_id="s1")
    assert d.flush() == 0
    assert "task registry write failed" in caplog.text
    assert "u1" not in caplog.text  # no user id in the logs
    assert d.next_task("u1", session_id="s1").replay  # serving goes on from memory
    assert d._dirty == {"u1"}
