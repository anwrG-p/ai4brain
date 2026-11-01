"""BE-04 dispatcher: filters, idempotency, no repeats within 14 days, difficulty, registry, latency."""

from __future__ import annotations

import heapq
import itertools
import json
import math
import os
import random
import statistics
import subprocess
import sys
import threading
import time
from collections import deque
from concurrent.futures.process import BrokenProcessPool
from pathlib import Path

import pytest

from app.tools.exercise_generator import ExerciseGenerator
from dynamic_cache import cache_dispatcher as cd
from dynamic_cache.bloom import DAY_S
from dynamic_cache.cache_dispatcher import Dispatcher, NoFreshTask, TelemetryTrials
from dynamic_cache.generators import DIMENSION_OF, SCHEMA_TYPES
from dynamic_cache.generators.stroop import INK_PRESETS
from dynamic_cache.parameter_projector import START_THETA

T0 = 1_790_000_000.0
REPO_ROOT = Path(__file__).resolve().parents[2]


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


def telemetry(tmp_path, *batches):
    tdir = tmp_path / "telemetry"
    tdir.mkdir(exist_ok=True)
    with open(tdir / "u1.jsonl", "a", encoding="utf-8") as f:
        for batch in batches:
            f.write("\n".join(batch) + "\n")
    return TelemetryTrials(lambda: tdir)


@pytest.mark.parametrize(
    "errors,direction",
    [([False] * 20, +1), ([False, True] * 10, -1), ([False] * 17 + [True] * 3, 0)],
)
def test_85_percent_rule_moves_theta_from_recent_accuracy(make, tmp_path, errors, direction):
    d = make(trials=telemetry(tmp_path, events("n_back", errors)))
    d.next_task("u1", schema_type="n_back")
    theta = d._users["u1"].schemas["n_back"]["theta"]
    acc = 1 - sum(errors) / len(errors)
    b = ExerciseGenerator.apply_85_percent_rule(acc, 5 * START_THETA["n_back"] - 2.5, step_size=cd.RULE_STEP)
    assert theta == pytest.approx((b + 2.5) / 5)
    assert (theta > START_THETA["n_back"]) - (theta < START_THETA["n_back"]) == direction


def test_the_rule_steps_only_on_trials_it_has_not_counted(make, tmp_path):
    later = "2026-10-31T11:00:00+00:00"
    source = telemetry(tmp_path, events("stroop", [False] * 20))
    d = make(trials=source)
    d.next_task("u1", schema_type="stroop")
    once = d._users["u1"].schemas["stroop"]["theta"]
    d.next_task("u1", schema_type="stroop")  # fetched, never played: no new trials, no step
    assert d._users["u1"].schemas["stroop"]["theta"] == once
    telemetry(tmp_path, events("stroop", [True] * 9, session="s2", received_at=later))
    d.next_task("u1", schema_type="stroop")  # 9 new trials: fewer than MIN_TRIALS, no step
    assert d._users["u1"].schemas["stroop"]["theta"] == once
    telemetry(tmp_path, events("stroop", [True], session="s3", received_at=later))
    d.next_task("u1", schema_type="stroop")  # the 10th: one step on those 10 (all wrong) only
    b = ExerciseGenerator.apply_85_percent_rule(0.0, 5 * once - 2.5, step_size=cd.RULE_STEP)
    assert d._users["u1"].schemas["stroop"]["theta"] == pytest.approx((b + 2.5) / 5)


def test_perfect_play_walks_up_to_harder_levels_and_stays_bounded(make, tmp_path):
    d = make(trials=telemetry(tmp_path))
    levels = []
    for k in range(30):
        telemetry(tmp_path, events("ufov", [False] * 12, session=f"s{k}"))
        levels.append(d.next_task("u1", schema_type="ufov").theta)
    assert levels == sorted(levels) and levels[-1] == 1.0


@pytest.mark.parametrize("ability", [0.7, 1.0])
def test_single_trial_tasks_do_not_wind_the_staircase_up(make, ability):
    """matrix and tower: one trial per task. Re-reading a 60-trial window after every task made
    theta swing 0..1 (SD ~0.37 in review; ~0.05 now); stepping once per 10 new trials keeps it near the 85%
    point. Simulated learner: P(correct) = logistic(8 * (ability - served level))."""
    rng = random.Random(1)
    log: list[cd.Trial] = []
    d = make(trials=lambda key, schema: log)
    thetas = []
    for k in range(600):
        served = d.next_task("u1", schema_type="matrix")
        p = 1 / (1 + math.exp(-8 * (ability - served.theta)))
        log.append(cd.Trial(rng.random() < p, f"2026-10-31T00:00:00+00:00|s|{served.task_id}|{k}"))
        thetas.append(d._users["u1"].schemas["matrix"]["theta"])
    late = thetas[300:]
    target = ability - math.log(0.85 / 0.15) / 8  # where P(correct) = 0.85
    assert statistics.pstdev(late) < 0.1, statistics.pstdev(late)  # ~0.05 over 10 learners
    assert abs(statistics.mean(late) - target) < 0.1
    assert all(0.0 <= t <= 1.0 for t in thetas)


def test_trials_since_a_marker():
    trials = [cd.Trial(True, f"2026-10-3{d}T00:00:00+00:00|s|t|{d}") for d in range(5)]
    assert cd.trials_since(trials, None) == trials
    assert cd.trials_since(trials, trials[2].marker) == trials[3:]
    assert cd.trials_since(trials, trials[4].marker) == []
    # The marked trial left the window (retention): only trials received after it count.
    gone = "2026-10-31T12:00:00+00:00|s|t|1"
    assert cd.trials_since(trials, gone) == trials[2:]


@pytest.mark.parametrize("stamp", ["", "2026-10-31T00:00:00+00:00"])
def test_trials_since_without_a_received_at_takes_the_newest_window(stamp):
    """The marked trial is gone and there is no received_at to compare: step on the newest
    ACCURACY_WINDOW trials instead of freezing for good."""
    trials = [cd.Trial(k % 2 == 0, f"|s|t|{k}") for k in range(100)]  # no received_at anywhere
    assert cd.trials_since(trials, f"{stamp}|gone|t|0") == trials[-cd.ACCURACY_WINDOW:]


def test_a_staircase_whose_marker_vanished_steps_then_reanchors(make):
    log = [cd.Trial(True, f"|s|t|{k}") for k in range(30)]  # rows without received_at
    d = make(trials=lambda key, schema: log)
    d.next_task("u1", schema_type="mst")  # not mst-specific: MST is pinned, so use the stored theta
    d._users["u1"].schemas["tower"] = {"theta": 0.5, "marker": "|lost|t|999", "served_at": 0.0}
    d.next_task("u1", schema_type="tower")
    rec = d._users["u1"].schemas["tower"]
    assert rec["theta"] > 0.5 and rec["marker"] == log[-1].marker  # stepped, and re-anchored
    d.next_task("u1", schema_type="tower")
    assert d._users["u1"].schemas["tower"]["theta"] == rec["theta"]  # no new trials: no step


def test_trials_dedupe_and_skip_fixtures_and_torn_lines():
    lines = events("mst", [False] * 5) * 4  # 5 distinct trials, resent 4 times
    lines += [json.dumps({"session_id": "s", "task_id": "mock-mst-1", "trial_index": i, "error_flag": True}) for i in range(50)]
    lines += ["{torn"]
    got = cd.trials_by_schema(lines)
    assert list(got) == ["mst"] and len(got["mst"]) == 5 and all(t.correct for t in got["mst"])


def test_one_step_counts_at_most_the_newest_window(make):
    log = [cd.Trial(False, f"m|s|t|{k}") for k in range(100)] + [cd.Trial(True, f"m|s|t|{100 + k}") for k in range(cd.ACCURACY_WINDOW)]
    d = make(trials=lambda key, schema: log)
    d.next_task("u1", schema_type="tower")
    b = ExerciseGenerator.apply_85_percent_rule(1.0, 5 * START_THETA["tower"] - 2.5, step_size=cd.RULE_STEP)
    assert d._users["u1"].schemas["tower"]["theta"] == pytest.approx((b + 2.5) / 5)


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


def wait_for(check, timeout=60.0):
    deadline = time.monotonic() + timeout
    while not check():
        assert time.monotonic() < deadline, "timed out"
        time.sleep(0.01)


def test_background_refill_keeps_the_pool_warm(make):
    d = make(background=True, pool_size=4)
    d.warm(schema_types=("matrix",), at=0.5)
    for _ in range(3):
        d.next_task("u1", schema_type="matrix")
    # At half its target (2 of 4) the pool was queued for a top-up, run in a worker process.
    wait_for(lambda: len(d._pools[("neutral", "matrix", 0.5)]) >= 4 and d._busy == 0)
    assert d._cost["matrix"] > 0  # build cost learned from the worker's timing


# --- pool sizing and refill priority ----------------------------------------------------------------


class Recorder:
    """A stand-in process pool that records refill jobs and never runs them."""

    def __init__(self):
        self.jobs = []

    def submit(self, fn, *args):
        from concurrent.futures import Future

        self.jobs.append(args)
        return Future()

    def shutdown(self, *a, **k):
        pass


def recording(make, **kw):
    d = make(background=True, **kw)
    real, d._workers = d._workers, Recorder()
    real.shutdown()
    return d


def test_a_hot_pool_grows_with_demand_and_shrinks_back(make):
    d = recording(make)
    key = ("neutral", "mst", 0.5)
    with d._lock:
        assert d._target(key, 0.0) == cd.POOL_SIZE  # no demand: the floor
        for k in range(100):  # 100 pops/s: after one time constant (2 s) the estimate is at ~63%
            d._note_pop(key, k * 0.01)
        assert d._rate(key, 1.0) > 30 and d._target(key, 1.0) > cd.POOL_SIZE  # grows within 1 s
        for k in range(100, 600):  # 6 s = 3 time constants: ~95%
            d._note_pop(key, k * 0.01)
        rate = d._rate(key, 6.0)
        assert 90 < rate < 105  # the estimate tracks the pop rate
        assert d._target(key, 6.0) == min(cd.POOL_MAX, math.ceil(rate * cd.POOL_HORIZON_S))
        assert d._target(key, 40.0) == cd.POOL_SIZE  # the wave passed: back to the floor
        assert d._target(("neutral", "tower", 0.5), 6.0) == cd.POOL_SIZE  # other pools unaffected


def test_pool_growth_is_capped_per_pool_and_in_bytes(make):
    d = recording(make, pool_max=40, pool_bytes_max=1000)
    key = ("neutral", "mst", 0.5)
    with d._lock:
        for k in range(1000):
            d._note_pop(key, k * 0.001)  # 1000 pops/s
        assert d._target(key, 1.0) == 40  # the per-pool cap
        d._pool_bytes = 1000
        assert d._target(key, 1.0) == d.pool_size  # the byte budget: no growth above the floor


def test_refill_starts_at_the_low_water_mark(make):
    d = recording(make, pool_size=16, workers=1)
    d.warm(schema_types=("tower",), at=0.5)
    for _ in range(7):  # 16 -> 9: above half the target
        d.next_task(f"u{_}", schema_type="tower")
    assert d._workers.jobs == []
    d.next_task("u7", schema_type="tower")  # 8 = half: topped up
    (job,) = d._workers.jobs
    assert job[:3] == ("neutral", "tower", 0.5) and len(job[3]) == 16 - 8  # up to the target


def test_a_slow_schema_is_refilled_before_a_cheap_one(make):
    """Same stock, same demand: the free worker takes MST first (it takes longer to build)."""
    d = recording(make, workers=1)
    mst, tower = ("neutral", "mst", 0.5), ("neutral", "tower", 0.5)
    with d._lock:
        now = time.monotonic()
        for key in (tower, mst):
            d._pools[key] = deque()
            for k in range(20):
                d._note_pop(key, now - 1 + k * 0.05)
            d._topping.add(key)
    d._pump()
    assert [job[1] for job in d._workers.jobs] == ["mst"]
    assert len(d._workers.jobs[0][3]) == math.ceil(cd.BATCH_S / cd.BUILD_COST_S["mst"])  # a small batch


def test_the_pool_that_runs_dry_first_is_refilled_first(make):
    d = recording(make, workers=1)
    full, starving = ("neutral", "mst", 0.5), ("neutral", "tower", 0.5)
    with d._lock:
        now = time.monotonic()
        d._pools[full] = deque([cd.Entry(f"x{k}", b"{}", k) for k in range(7)])
        d._pools[starving] = deque()
        for key in (full, starving):
            for k in range(40):
                d._note_pop(key, now - 2 + k * 0.05)
            d._topping.add(key)
    d._pump()
    assert [job[1] for job in d._workers.jobs] == ["tower"]  # empty beats 7 left, cheap or not


def test_both_workers_can_serve_one_hot_pool(make):
    d = recording(make, workers=2)
    key = ("neutral", "mst", 0.5)
    with d._lock:
        now = time.monotonic()
        d._pools[key] = deque()
        for k in range(200):
            d._note_pop(key, now - 2 + k * 0.01)
        d._topping.add(key)
    d._pump()
    assert [job[1] for job in d._workers.jobs] == ["mst", "mst"] and d._busy == 2


# --- registry: persistence, delete, export ------------------------------------------------------------


def test_registry_is_written_behind_and_holds_no_task_list(make, tmp_path):
    d = make(background=True)
    d.next_task("u1", session_id="s1")
    d.close()
    doc = json.loads((tmp_path / "registry" / "u1.json").read_text())
    assert set(doc) == {"v", "seen", "sessions", "schemas", "last"}
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


def test_forget_and_export_with_a_directory_touch_only_that_directory(make, tmp_path):
    d = make()
    d.next_task("u1", session_id="s1")
    d.flush()
    own = tmp_path / "registry" / "u1.json"
    before = own.read_bytes()
    other = tmp_path / "elsewhere"
    other.mkdir()
    assert d.export("u1", other) is None and d.forget("u1", other) == 0
    (other / "u1.json").write_text('{"v": 1}')
    assert d.export("u1", other) == {"v": 1}
    assert d.forget("u1", other) == 1 and not (other / "u1.json").exists()
    assert own.read_bytes() == before and "u1" in d._users


def test_a_corrupt_registry_is_exported_raw(make, tmp_path):
    d = make()
    (tmp_path / "registry").mkdir()
    (tmp_path / "registry" / "u1.json").write_text("{not json")
    assert d.export("u1") == {"unreadable": "{not json"}
    d.next_task("u1")  # serving treats it as empty


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
    assert make()._users == {}


def test_a_failed_registry_write_is_logged_and_retried(make, tmp_path, caplog):
    blocker = tmp_path / "not_a_dir"
    blocker.write_text("x")
    d = make(registry_dir=lambda: blocker)  # mkdir under a file fails
    d.next_task("u1", session_id="s1")
    assert d.flush() == 0
    assert "task registry write failed" in caplog.text
    assert "u1" not in caplog.text  # no user id in the logs
    assert d.next_task("u1", session_id="s1").replay  # serving goes on from memory
    assert set(d._dirty) == {"u1"}


# --- memory bounds and retention ---------------------------------------------------------------------


def test_memory_keeps_at_most_max_users_evicting_clean_ones(make, tmp_path):
    d = make(max_users=3, seed_source=lambda: 7)
    for k in range(5):
        d.next_task(f"u{k}", schema_type="matrix")
    # Unwritten users are never evicted: the file would not have them yet.
    assert len(d._users) == 5
    d.flush()
    assert list(d._users) == ["u2", "u3", "u4"]  # least recently used went first
    assert d._user_locks == {} and d._pins == {}  # nothing in flight, nothing kept
    # u0 comes back from its file, seen filter included: seed 7's task stays refused.
    with pytest.raises(NoFreshTask):
        d.next_task("u0", schema_type="matrix")
    assert "u0" in d._users and len(d._users) == 3


def test_a_change_made_during_a_write_keeps_the_user_dirty(make, monkeypatch):
    """Eviction skips dirty users, so a user is never dropped (and re-read) mid-write."""
    d = make(max_users=1)
    d.next_task("u1")
    real = os.replace

    def replace_while_u1_changes(src, dst):
        d._mark_dirty("u1")  # a serve landing while the file is written
        real(src, dst)

    monkeypatch.setattr(cd.os, "replace", replace_while_u1_changes)
    assert d.flush() == 1
    assert "u1" in d._dirty  # the newer generation still has to be written
    monkeypatch.setattr(cd.os, "replace", real)
    assert d.flush() == 1 and d._dirty == {}


def test_serving_and_flushing_at_once_never_breaks_a_dump(make):
    """next_task mutates a user's dicts under the user's lock; flush serialises under that lock
    too, so 'dictionary changed size during iteration' cannot happen."""
    d = make()
    errors, stop = [], threading.Event()

    def serve(worker):
        try:
            for k in range(300):  # a new session answer each call: the sessions dict keeps changing
                d.next_task("u1", session_id=f"s{worker}-{k}", schema_type="tower")
        except Exception as e:  # noqa: BLE001 - the test reports any failure
            errors.append(e)

    def flush():
        try:
            while not stop.is_set():
                d.flush()
        except Exception as e:  # noqa: BLE001
            errors.append(e)

    flusher = threading.Thread(target=flush)
    flusher.start()
    servers = [threading.Thread(target=serve, args=(w,)) for w in range(3)]
    for t in servers:
        t.start()
    for t in servers:
        t.join()
    stop.set()
    flusher.join()
    assert errors == []
    d.flush()
    on_disk = json.loads((Path(d.registry_dir()) / "u1.json").read_text())
    assert on_disk == json.loads(json.dumps(d._users["u1"].to_json()))  # the last state landed


def test_a_user_with_a_call_in_flight_is_not_evicted(make):
    d = make(max_users=1)
    d.next_task("u0")
    d.flush()
    d._pins["u0"] = 1  # as if u0's call were running
    d.next_task("u1")
    d.flush()
    assert "u0" in d._users
    d._pins.clear()
    d.next_task("u2")
    d.flush()
    assert list(d._users) == ["u2"]


def test_telemetry_trials_cache_is_bounded(tmp_path):
    for k in range(5):
        (tmp_path / f"u{k}.jsonl").write_text("\n".join(events("mst", [False] * 3)) + "\n")
    source = TelemetryTrials(lambda: tmp_path, max_users=2)
    for k in range(5):
        assert len(source(f"u{k}", "mst")) == 3
    assert list(source._cache) == ["u3", "u4"]


def test_a_registry_idle_past_retention_starts_afresh(make):
    clock = Clock()
    d = make(clock=clock, seed_source=lambda: 7)
    d.next_task("u1", schema_type="matrix", session_id="s1")
    clock.t = T0 + (cd.RETENTION_DAYS + 1) * DAY_S
    st = d._state("u1", clock.t)
    assert st.sessions == {} and st.schemas == {} and st.seen.slices == {}


def test_the_idle_reset_uses_the_configured_retention_days(make):
    clock = Clock()
    d = make(clock=clock, retention_days=7)
    d.next_task("u1", schema_type="tower", session_id="s1")
    clock.t = T0 + 6 * DAY_S
    assert d._state("u1", clock.t).sessions != {}  # within 7 days: kept
    clock.t = T0 + 8 * DAY_S
    assert d._state("u1", clock.t).sessions == {}  # past 7 days: afresh


def test_the_retention_cli_default_is_the_same_setting(tmp_path, monkeypatch, capsys):
    from app.privacy import retention

    registry = Path(os.environ["TASK_REGISTRY_DIR"])
    stale = registry / "u1.json"
    stale.write_text("{}")
    os.utime(stale, (time.time() - 10 * DAY_S,) * 2)
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path / "telemetry"))
    monkeypatch.setenv("RETENTION_DAYS", "30")
    assert retention.main([]) == 0 and stale.exists()  # 10 days idle < 30
    monkeypatch.setenv("RETENTION_DAYS", "7")
    assert retention.main([]) == 0 and not stale.exists()  # the same file under 7 days
    assert json.loads(capsys.readouterr().out.splitlines()[-1])["registries_removed"] == 1


@pytest.mark.parametrize("bad", ["0", "-3", "x", "1.5"])
def test_a_bad_retention_setting_is_refused(bad, monkeypatch, capsys):
    from app.privacy import retention

    monkeypatch.setenv("RETENTION_DAYS", bad)
    with pytest.raises(ValueError):
        retention.configured_days()
    assert retention.main([]) == 2 and "RETENTION_DAYS" in capsys.readouterr().err


def test_purge_idle_removes_registry_files_untouched_for_30_days(tmp_path):
    now = time.time()
    old, fresh, other = tmp_path / "old.json", tmp_path / "fresh.json", tmp_path / "notes.txt"
    for p in (old, fresh, other):
        p.write_text("{}")
    os.utime(old, (now - 31 * DAY_S, now - 31 * DAY_S))
    os.utime(other, (now - 90 * DAY_S, now - 90 * DAY_S))
    assert cd.purge_idle(tmp_path, 30, now) == 1
    assert not old.exists() and fresh.exists() and other.exists()
    assert cd.purge_idle(tmp_path / "missing", 30, now) == 0


def test_the_retention_cli_purges_idle_registries(tmp_path, monkeypatch, capsys):
    from app.privacy import retention

    registry = Path(os.environ["TASK_REGISTRY_DIR"])  # the autouse fixture's temporary registry
    stale = registry / "u1.json"
    stale.write_text("{}")
    os.utime(stale, (time.time() - 40 * DAY_S,) * 2)
    (registry / "u2.json").write_text("{}")
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path / "telemetry"))
    assert retention.main([]) == 0
    assert json.loads(capsys.readouterr().out)["registries_removed"] == 1
    assert not stale.exists() and (registry / "u2.json").exists()


# --- worker process -----------------------------------------------------------------------------------


def test_the_first_submit_runs_outside_the_dispatcher_lock(make):
    d = make(background=True, pool_size=2)
    held = []

    class Probe:
        def submit(self, *args):
            # Another thread can take the lock only if this one does not hold it.
            t = threading.Thread(target=lambda: held.append(d._lock.acquire(timeout=1) and d._lock.release() is None))
            t.start()
            t.join()
            raise BrokenProcessPool("probe")  # the worker died: a new one is made, no fallback

    real = d._workers
    d._workers = Probe()
    d.next_task("u1", schema_type="tower")
    assert held == [True]
    real.shutdown()


def pid_alive(pid: int) -> bool:
    if os.name == "nt":
        import ctypes

        k32 = ctypes.windll.kernel32
        handle = k32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return False
        code = ctypes.c_ulong()
        k32.GetExitCodeProcess(handle, ctypes.byref(code))
        k32.CloseHandle(handle)
        return code.value == 259  # STILL_ACTIVE
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    return True


PARENT = """
import sys, time
from dynamic_cache.cache_dispatcher import worker_pid, worker_pool
if __name__ == "__main__":
    pool = worker_pool()
    print(pool.submit(worker_pid).result(), flush=True)
    time.sleep(120)
"""


def test_the_worker_exits_when_its_parent_is_killed(tmp_path):
    script = tmp_path / "parent.py"
    script.write_text(PARENT)
    env = {**os.environ, "PYTHONPATH": str(REPO_ROOT)}
    parent = subprocess.Popen([sys.executable, str(script)], stdout=subprocess.PIPE, text=True, env=env, cwd=REPO_ROOT)
    try:
        worker = int(parent.stdout.readline())
        assert pid_alive(worker)
    finally:
        parent.kill()  # a hard kill: no shutdown hook runs
        parent.wait(timeout=30)
        parent.stdout.close()
    deadline = time.monotonic() + 20
    while pid_alive(worker) and time.monotonic() < deadline:
        time.sleep(0.1)
    assert not pid_alive(worker)


def test_start_does_not_wait_for_the_worker(make):
    d = make(background=True)
    t = time.perf_counter()
    future = d.start()
    assert time.perf_counter() - t < 0.5  # a spawn takes far longer on Windows; start only queues it
    assert future.result(timeout=60) != os.getpid()


def test_a_worker_that_dies_at_spawn_falls_back_to_inline(make, caplog):
    from concurrent.futures import Future

    class DeadOnArrival:
        def submit(self, *a, **k):
            f = Future()
            f.set_exception(OSError("spawn failed"))
            return f

        def shutdown(self, *a, **k):
            pass

    d = make(background=True)
    real, d._workers = d._workers, DeadOnArrival()
    d.start()
    assert d._workers is None and "task worker process unavailable (OSError)" in caplog.text
    assert json.loads(d.next_task("u1", schema_type="mst").body)["schema_type"] == "mst"
    real.shutdown()


def test_close_stops_the_worker_and_is_idempotent(make):
    d = make(background=True)
    d.start()
    d.close()
    d.close()
    d.next_task("u1")  # still serves inline after close, without starting a new worker
    assert d._busy == 0 and d._inflight == {}


# --- latency -----------------------------------------------------------------------------------------


def percentile(timings: list[float], q: float) -> float:
    timings = sorted(timings)
    return timings[math.ceil(q * len(timings)) - 1]  # nearest rank


def test_p99_under_10_ms_with_warm_pools(make):
    """AC: p99 < 10 ms. Warm deep pools at the level new users start on; refills stay on."""
    d = make(background=True, pool_size=48)
    for s in SCHEMA_TYPES:
        d.warm(schema_types=(s,), at=START_THETA[s])
    d.start().result(timeout=60)  # warm: the worker is up
    d.next_task("warmup")  # first-call imports and allocations
    timings = []
    for k in range(320):  # 40 users x 8 schemas, some calls replaying a session
        t = time.perf_counter()
        d.next_task(f"bench{k % 40}", session_id="s1" if k % 5 == 0 else None, seq=k // 40)
        timings.append(time.perf_counter() - t)
    p99 = percentile(timings, 0.99)
    print(f"\nwarm 48-deep pools: next_task p50 {percentile(timings, 0.5) * 1e3:.3f} ms, p99 {p99 * 1e3:.3f} ms")
    assert p99 < 0.010


def test_p99_under_10_ms_at_production_pool_size_paced(make):
    """Mixed traffic at the production defaults: 100 calls/s, 40 users at different points of
    their battery (user u has already played u % 8 tasks), so consecutive calls ask for different
    schemas, about 12 calls/s per pool. Concentrated traffic is covered by the two tests below
    (a baseline wave, users in step)."""
    d = make(background=True)
    assert d.pool_size == cd.POOL_SIZE == 16
    for s in SCHEMA_TYPES:
        d.warm(schema_types=(s,), at=START_THETA[s])
    d.start().result(timeout=60)  # warm: the worker is up
    for u in range(40):  # stagger the users across the battery (untimed)
        for _ in range(u % 8):
            d.next_task(f"paced{u}")
    for s in SCHEMA_TYPES:  # and let the pools fill again before timing
        d.warm(schema_types=(s,), at=START_THETA[s])
    timings = []
    for k in range(320):
        t = time.perf_counter()
        d.next_task(f"paced{k % 40}")
        timings.append(time.perf_counter() - t)
        time.sleep(0.01)
    p99 = percentile(timings, 0.99)
    print(f"\n16-deep pools, 100 calls/s: next_task p50 {percentile(timings, 0.5) * 1e3:.3f} ms, p99 {p99 * 1e3:.3f} ms")
    assert p99 < 0.010


# The baseline every new user plays first, in this order (frontend baseline runner).
BASELINE = ("relational", "n_back", "stroop", "tower", "ufov", "mst")


def run_wave(d, users: int, arrivals_per_s: float, play_s: tuple[float, float], seed: int = 0) -> list[float]:
    """A wave of sign-ups: `users` new users arrive at `arrivals_per_s`, each walks BASELINE,
    fetching the next task `play_s` (uniform) after the previous one. Time is compressed (real
    tasks take minutes), which makes the load on each pool far denser than real. One thread
    replays the schedule in real time and times every call."""
    rng = random.Random(seed)
    start = time.monotonic()
    events = [(u / arrivals_per_s, u, 0) for u in range(users)]  # (due, user, baseline step)
    heapq.heapify(events)
    timings = []
    while events:
        due, u, step = heapq.heappop(events)
        wait = start + due - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        t = time.perf_counter()
        d.next_task(f"wave{u}", schema_type=BASELINE[step], session_id="baseline", seq=step)
        timings.append(time.perf_counter() - t)
        if step + 1 < len(BASELINE):
            heapq.heappush(events, (max(due, time.monotonic() - start) + rng.uniform(*play_s), u, step + 1))
    return timings


def production_dispatcher(make):
    d = make(background=True)  # production POOL_SIZE, POOL_MAX, WORKERS
    assert (d.pool_size, d.pool_max, d.workers) == (cd.POOL_SIZE, cd.POOL_MAX, cd.WORKERS)
    for s in SCHEMA_TYPES:
        d.warm(schema_types=(s,), at=START_THETA[s])  # what a running server holds when idle
    d.start().result(timeout=60)
    return d


def test_p99_under_10_ms_for_a_baseline_wave(make):
    """AC p99 < 10 ms for the case real traffic concentrates on: a wave of sign-ups. 150 new
    users arrive at 50 a second, all on the same baseline task first, then each moves on 0.3 to
    0.8 s later (compressed play time), so each baseline pool takes a burst of up to ~50 calls/s
    while the next pool's burst builds. Covered by: pools sized to their demand (POOL_HORIZON_S),
    refills started at the low-water mark, the slowest-to-build and soonest-dry pool refilled
    first, two workers."""
    d = production_dispatcher(make)
    timings = run_wave(d, users=150, arrivals_per_s=50, play_s=(0.3, 0.8))
    p99 = percentile(timings, 0.99)
    grown = max(len(p) for p in d._pools.values())
    print(f"\nbaseline wave, {len(timings)} calls: p50 {percentile(timings, 0.5) * 1e3:.3f} ms, "
          f"p99 {p99 * 1e3:.3f} ms, largest pool {grown}")
    assert p99 < 0.010


def test_p99_under_10_ms_with_users_in_step(make):
    """The harsher case round 2 failed (p99 20-25 ms with one fixed-size pool and one worker):
    40 users in step at 100 calls/s, so calls come in blocks of 40 for one schema, the last block
    being 40 MST calls in 0.4 s."""
    d = production_dispatcher(make)
    timings = []
    for k in range(320):
        t = time.perf_counter()
        d.next_task(f"step{k % 40}")
        timings.append(time.perf_counter() - t)
        time.sleep(0.01)
    p99 = percentile(timings, 0.99)
    print(f"\nusers in step, 100 calls/s: p50 {percentile(timings, 0.5) * 1e3:.3f} ms, p99 {p99 * 1e3:.3f} ms")
    assert p99 < 0.010
