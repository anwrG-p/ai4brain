"""BE-08: the synthetic telemetry generator (data/synthetic/generate.py)."""

import json
import statistics
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import dataclasses
from datetime import date

# The server model, through the generator's single import of it (a move is a one-line change there).
from data.synthetic.generate import Params, TelemetryEvent, generate, simulate_user

ROOT = Path(__file__).resolve().parents[1]

# Clean signal: no low-effort sessions, no time-of-day swing, so the statistical tests are about the
# one effect they check.
QUIET = Params(low_effort_rate=0.0, tod_amplitude=0.0)


def lines(path: Path) -> list[dict]:
    return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines()]


def stripped(line: dict) -> dict:
    return {k: v for k, v in line.items() if k != "received_at"}


@pytest.fixture(scope="module")
def small(tmp_path_factory):
    out = tmp_path_factory.mktemp("synthetic")
    generate(users=4, sessions=5, seed=7, out=out)
    return out


def test_every_line_validates_against_the_server_model(small):
    files = sorted(small.glob("*.jsonl"))
    assert len(files) == 4
    n = 0
    for f in files:
        for line in lines(f):
            assert "received_at" in line
            event = TelemetryEvent.model_validate(stripped(line))
            # The stored line is exactly what the model dumps: the ingest route's layout.
            assert event.model_dump(mode="json") == stripped(line)
            assert f.stem == line["user_id"]
            n += 1
    assert n > 4 * 5 * 50


def test_lines_survive_the_real_ingest_route(small, tmp_path, monkeypatch):
    from app.main import app  # the one API server (backend/app)

    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path))
    f = sorted(small.glob("*.jsonl"))[0]
    ours = [stripped(x) for x in lines(f)]
    client = TestClient(app)
    for i in range(0, len(ours), 100):
        r = client.post("/v1/telemetry/event", json=ours[i : i + 100])
        assert r.status_code == 202, r.text
    theirs = [stripped(x) for x in lines(tmp_path / f.name)]
    assert theirs == ours


def test_every_exercise_is_present_with_its_trial_meta_signature(small):
    events = lines(sorted(small.glob("*.jsonl"))[0])
    keys = {}
    for e in events:
        schema = e["task_id"].split("-")[1]
        keys.setdefault(schema, set()).update(e["trial_meta"])
    assert keys["nback"] >= {"stream", "rule", "trial_type"}
    assert keys["stroop"] >= {"congruent"}
    assert keys["rotation"] >= {"angle_deg", "mirrored"}
    assert keys["relational"] >= {"hops", "inverted", "level"}
    assert keys["tower"] >= {"l_min", "l_user", "planning_time_ms", "solved"}
    assert keys["ufov"] >= {"shown_ms", "peripheral_ok", "quest_threshold_ms"}
    assert keys["mst"] >= {"kind", "delta", "response"}
    assert keys["matrix"] == {"item_id"}
    # F-B's exercises, with the signatures taskScores.ts schemaOf() reads first
    assert keys["stop"] == {"item_id", "stop_trial", "dir", "response", "ssd_ms"}
    assert keys["flanker"] == {"item_id", "flanker", "dir", "response"}
    assert keys["pal"] == {"item_id", "pal_level", "attempt", "pattern", "box", "chosen", "pal_total", "boxes"}


def test_the_scorers_see_every_input_the_exercises_feed(small):
    """Twin and clustering read features.session_features: every sourced input shows up, and the
    new exercises replace the Stroop stand-ins."""
    from brain_twin_jepa.features import INPUT_IDS, UNSOURCED_INPUTS, session_features
    from brain_twin_jepa.telemetry_io import dedupe, group_sessions

    seen, proxies = set(), set()
    for f in sorted(small.glob("*.jsonl")):
        for session in group_sessions(dedupe(lines(f))):
            inputs = session_features(session.events)["inputs"]
            seen |= set(inputs)
            proxies |= {k for k, v in inputs.items() if v.get("proxy")}
    assert seen == set(INPUT_IDS) - set(UNSOURCED_INPUTS)
    assert proxies == set()  # SSRT from Stop Light, ANT_Conflict from Arrow Focus


def test_nback_follows_r16_with_off_rule_lures_and_presses():
    events, _ = simulate_user(seed=4, index=0, sessions=6, params=QUIET)
    nb = [e for e in events if e["task_id"].startswith("syn-nback")]
    by_trial: dict = {}
    for e in nb:
        by_trial.setdefault((e["session_id"], e["trial_index"]), []).append(e)
    assert all([x["trial_meta"]["stream"] for x in es] == ["position", "symbol"] for es in by_trial.values())
    rules = {e["trial_meta"]["rule"] for e in nb}
    assert rules == {"position", "symbol"}  # switch trials flip the hint
    off = [e for e in nb if e["trial_meta"]["stream"] != e["trial_meta"]["rule"]]
    assert {e["trial_meta"]["trial_type"] for e in off} == {"lure_stream", "standard"}
    pressed = [e for e in off if e["error_flag"]]
    assert pressed, "some off-rule presses"
    lure_rate = statistics.fmean(e["error_flag"] for e in off if e["trial_meta"]["trial_type"] == "lure_stream")
    plain_rate = statistics.fmean(e["error_flag"] for e in off if e["trial_meta"]["trial_type"] == "standard")
    assert lure_rate > plain_rate  # a match on the other stream pulls the off-rule key
    for es in by_trial.values():
        rule_e = next(x for x in es if x["trial_meta"]["stream"] == x["trial_meta"]["rule"])
        off_e = next(x for x in es if x is not rule_e)
        if off_e["error_flag"]:  # an off-rule press makes the trial's verdict wrong (R16)
            assert rule_e["error_flag"]
        assert rule_e["trial_meta"]["item_id"] == off_e["trial_meta"]["item_id"]


def test_ssrt_and_flanker_cost_are_recovered_from_the_emitted_events():
    """The integration SSRT tracks the user's true SSRT, and the flanker RT cost the true cost."""
    from brain_twin_jepa.features import ssrt

    est, true, cost, true_cost = [], [], [], []
    for i in range(80):
        events, truth = simulate_user(seed=21, index=i, sessions=2, params=QUIET)
        for t in truth["sessions"]:
            es = [e for e in events if e["session_id"] == t["session_id"]]
            value = ssrt([e for e in es if "stop_trial" in e["trial_meta"]])
            if value is not None:
                est.append(value)
                true.append(t["ssrt_ms"])
            fl = [e for e in es if "flanker" in e["trial_meta"] and not e["error_flag"]]
            inc = [e["response_time_ms"] for e in fl if e["trial_meta"]["flanker"] == "incongruent"]
            con = [e["response_time_ms"] for e in fl if e["trial_meta"]["flanker"] == "congruent"]
            cost.append(statistics.fmean(inc) - statistics.fmean(con))
            true_cost.append(t["flanker_cost_ms"])
    assert len(est) >= 150  # the staircase keeps P(respond | signal) inside the guide's range
    assert statistics.correlation(est, true) > 0.4
    assert abs(statistics.fmean(est) - statistics.fmean(true)) < 25
    assert statistics.correlation(cost, true_cost) > 0.3
    assert abs(statistics.fmean(cost) - statistics.fmean(true_cost)) < 15


def test_pal_stops_at_the_first_stage_failed_three_times():
    events, _ = simulate_user(seed=8, index=3, sessions=8, params=QUIET)
    pal = [e for e in events if e["task_id"].startswith("syn-pal")]
    for sid in {e["session_id"] for e in pal}:
        es = [e for e in pal if e["session_id"] == sid]
        stages = [e["trial_meta"]["pal_level"] for e in es]
        assert stages == sorted(stages) and stages[0] == 2
        for level in set(stages):
            attempts = [e for e in es if e["trial_meta"]["pal_level"] == level]
            last = max(e["trial_meta"]["attempt"] for e in attempts)
            failed_last = any(e["error_flag"] for e in attempts if e["trial_meta"]["attempt"] == last)
            if failed_last:  # a stage failed on its 3rd attempt ends the task
                assert last == 3 and level == max(stages)
        assert all(e["trial_meta"]["pal_total"] == 20 and e["trial_meta"]["boxes"] == 8 for e in es)


def test_ground_truth_sidecar_stays_out_of_the_ingest_glob(small):
    truth = sorted((small / "_truth").glob("*.json"))
    assert [t.stem for t in truth] == sorted(f.stem for f in small.glob("*.jsonl"))
    t = json.loads(truth[0].read_text(encoding="utf-8"))
    assert set(t["ability"]) == {"focus", "agility", "impulse", "memory", "visual"}
    assert len(t["sessions"]) == 5


def test_seeded_output_is_byte_identical(tmp_path):
    a, b, c = tmp_path / "a", tmp_path / "b", tmp_path / "c"
    generate(users=3, sessions=3, seed=42, out=a)
    generate(users=3, sessions=3, seed=42, out=b)
    generate(users=3, sessions=3, seed=43, out=c)
    files = sorted(p.relative_to(a) for p in a.rglob("*") if p.is_file())
    assert files == sorted(p.relative_to(b) for p in b.rglob("*") if p.is_file())
    for rel in files:
        assert (a / rel).read_bytes() == (b / rel).read_bytes()
    first_a, first_c = sorted(a.glob("*.jsonl"))[0], sorted(c.glob("*.jsonl"))[0]
    assert first_a.read_bytes() != first_c.read_bytes()


def test_a_user_does_not_depend_on_how_many_users_are_generated(tmp_path):
    generate(users=1, sessions=2, seed=5, out=tmp_path / "one")
    generate(users=3, sessions=2, seed=5, out=tmp_path / "three")
    [only] = list((tmp_path / "one").glob("*.jsonl"))
    assert (tmp_path / "three" / only.name).read_bytes() == only.read_bytes()


def test_cli_writes_the_same_files(tmp_path):
    out = tmp_path / "cli"
    cmd = [sys.executable, "-m", "data.synthetic.generate", "--users", "2", "--sessions", "2", "--seed", "9", "--out", str(out)]
    done = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=120)
    assert done.returncode == 0, done.stderr
    ref = tmp_path / "ref"
    generate(users=2, sessions=2, seed=9, out=ref)
    for f in sorted(ref.glob("*.jsonl")):
        assert (out / f.name).read_bytes() == f.read_bytes()


def session_accuracy(events: list[dict]) -> dict[str, float]:
    """Emitted accuracy (share of events without error_flag) per session_id, in session order."""
    by: dict[str, list[float]] = {}
    for e in events:
        by.setdefault(e["session_id"], []).append(0.0 if e["error_flag"] else 1.0)
    return {sid: statistics.fmean(v) for sid, v in by.items()}


def accuracy_by_session(users: int, sessions: int, params: Params) -> list[float]:
    acc = [[] for _ in range(sessions)]
    for i in range(users):
        events, _ = simulate_user(seed=11, index=i, sessions=sessions, params=params)
        for k, a in enumerate(session_accuracy(events).values()):
            acc[k].append(a)
    return [statistics.fmean(a) for a in acc]


def test_practice_gain_plateaus_around_session_3():
    acc = accuracy_by_session(users=120, sessions=8, params=QUIET)
    early = acc[2] - acc[0]  # sessions 1 -> 3
    late = acc[7] - acc[2]  # sessions 3 -> 8
    assert early > 0.02, acc
    assert abs(late) < 0.25 * early, acc


def test_practice_curve_shape_in_the_ground_truth():
    _, truth = simulate_user(seed=1, index=0, sessions=6, params=QUIET)
    level = [s["practice_level"] for s in truth["sessions"]]
    assert level[0] == 0.0
    assert level[2] >= 0.9  # ~95% of the asymptotic gain by the 3rd session
    assert level[5] - level[2] < 0.06
    assert all(b >= a for a, b in zip(level, level[1:]))


def test_forgetting_defaults_to_zero_and_only_shrinks_the_practice_gain():
    assert Params().forgetting_per_day == 0.0
    _, keep = simulate_user(seed=3, index=0, sessions=6, params=QUIET)
    _, fade = simulate_user(seed=3, index=0, sessions=6, params=Params(low_effort_rate=0.0, tod_amplitude=0.0, forgetting_per_day=0.2))
    assert keep["ability"] == fade["ability"]
    assert [s["day"] for s in keep["sessions"]] == [s["day"] for s in fade["sessions"]]
    later = zip(keep["sessions"][1:], fade["sessions"][1:])
    assert all(f["practice_level"] < k["practice_level"] for k, f in later)


def test_forgetting_lowers_emitted_accuracy_after_the_first_sessions():
    keep = accuracy_by_session(users=60, sessions=8, params=QUIET)
    fade = accuracy_by_session(users=60, sessions=8, params=dataclasses.replace(QUIET, forgetting_per_day=0.2))
    assert keep[0] == fade[0]  # no practice yet, so nothing to forget
    assert statistics.fmean(keep[3:]) - statistics.fmean(fade[3:]) > 0.005, (keep, fade)


def test_low_effort_fraction_matches_its_parameter():
    rate = 0.15
    params = Params(low_effort_rate=rate)
    flags, fast_low, fast_ok = [], [], []
    for i in range(300):
        events, truth = simulate_user(seed=21, index=i, sessions=10, params=params)
        low = {s["session_id"]: s["low_effort"] for s in truth["sessions"]}
        flags += low.values()
        stroop = {}
        for e in events:
            if e["task_id"].startswith("syn-stroop") and e["keystroke_latency_ms"] is not None:
                stroop.setdefault(e["session_id"], []).append(e["response_time_ms"])
        for sid, rts in stroop.items():
            (fast_low if low[sid] else fast_ok).append(statistics.median(rts))
    assert abs(statistics.fmean(flags) - rate) < 0.03
    # The flag is visible in the telemetry itself: low-effort sessions answer far faster.
    assert statistics.median(fast_low) < 400 < statistics.median(fast_ok)


def test_low_effort_sessions_answer_at_chance_with_timeouts():
    params = Params(low_effort_rate=1.0)
    events, _ = simulate_user(seed=2, index=0, sessions=8, params=params)
    stroop = [e for e in events if e["task_id"].startswith("syn-stroop")]
    acc = statistics.fmean(0.0 if e["error_flag"] else 1.0 for e in stroop)
    assert 0.12 < acc < 0.38  # 4 inks: chance is 0.25
    timeouts = [e for e in stroop if e["keystroke_latency_ms"] is None]
    assert timeouts and all(e["response_time_ms"] == 3000.0 for e in timeouts)


def stroop_cost(events: list[dict], session_id: str) -> float:
    con, inc = [], []
    for e in events:
        if e["session_id"] == session_id and e["task_id"].startswith("syn-stroop") and not e["error_flag"]:
            (con if e["trial_meta"]["congruent"] else inc).append(e["response_time_ms"])
    return statistics.fmean(inc) - statistics.fmean(con)


def test_stroop_cost_retest_reliability_is_about_0_6():
    a, b = [], []
    for i in range(300):
        events, truth = simulate_user(seed=31, index=i, sessions=5, params=QUIET)
        s4, s5 = truth["sessions"][3]["session_id"], truth["sessions"][4]["session_id"]
        a.append(stroop_cost(events, s4))
        b.append(stroop_cost(events, s5))
    r = statistics.correlation(a, b)
    assert 0.48 < r < 0.72, r


def test_time_of_day_lowers_emitted_accuracy_off_peak():
    # Same users, seed and trial streams; only the amplitude differs. No state or low-effort noise.
    flat = Params(low_effort_rate=0.0, state_sd=0.0, tod_amplitude=0.0)
    swing = dataclasses.replace(flat, tod_amplitude=2.0)
    off_peak, near_peak = [], []
    for i in range(100):
        ev_flat, _ = simulate_user(seed=41, index=i, sessions=4, params=flat)
        ev_swing, truth = simulate_user(seed=41, index=i, sessions=4, params=swing)
        a_flat, a_swing = session_accuracy(ev_flat), session_accuracy(ev_swing)
        for s in truth["sessions"]:
            drop = a_flat[s["session_id"]] - a_swing[s["session_id"]]
            if s["tod_shift"] < -1:
                off_peak.append(drop)
            elif s["tod_shift"] > -0.2:
                near_peak.append(drop)
    assert len(off_peak) > 20 and len(near_peak) > 20
    assert statistics.fmean(off_peak) > 0.04, statistics.fmean(off_peak)
    assert statistics.fmean(off_peak) > 3 * abs(statistics.fmean(near_peak))


def test_schedule_skips_days_and_trains_at_most_once_a_day():
    gaps = []
    for i in range(50):
        events, _ = simulate_user(seed=8, index=i, sessions=10)
        first: dict[str, str] = {}
        for e in events:  # events are in time order, so this is each session's first client_ts
            first.setdefault(e["session_id"], e["client_ts"])
        days = [date.fromisoformat(ts[:10]) for _, ts in sorted(first.items())]
        assert len(days) == 10
        gaps += [(b - a).days for a, b in zip(days, days[1:])]
    assert min(gaps) >= 1  # at most one session a day
    assert max(gaps) > 1  # days get skipped
    # About 3 sessions a week (Lampit 2014: more than 3/week was not more effective in healthy older adults).
    assert 1.8 < statistics.fmean(gaps) < 3.2
