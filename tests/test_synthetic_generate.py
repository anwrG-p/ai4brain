"""BE-08: the synthetic telemetry generator (data/synthetic/generate.py)."""

import json
import statistics
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from assessment_engine.api.routes.telemetry import TelemetryEvent
from data.synthetic.generate import Params, generate, simulate_user

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
    from main import app

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


def accuracy_by_session(users: int, sessions: int, params: Params) -> list[float]:
    acc = [[] for _ in range(sessions)]
    for i in range(users):
        events, truth = simulate_user(seed=11, index=i, sessions=sessions, params=params)
        index = {s["session_id"]: k for k, s in enumerate(truth["sessions"])}
        by = [[] for _ in range(sessions)]
        for e in events:
            by[index[e["session_id"]]].append(0.0 if e["error_flag"] else 1.0)
        for k in range(sessions):
            acc[k].append(statistics.fmean(by[k]))
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


def test_time_of_day_shifts_performance():
    _, truth = simulate_user(seed=4, index=0, sessions=10)
    shifts = [s["tod_shift"] for s in truth["sessions"]]
    assert all(-Params().tod_amplitude <= x <= 0 for x in shifts)
    _, flat = simulate_user(seed=4, index=0, sessions=10, params=QUIET)
    assert all(s["tod_shift"] == 0 for s in flat["sessions"])


def test_schedule_skips_days_and_trains_at_most_once_a_day():
    gaps = []
    for i in range(50):
        _, truth = simulate_user(seed=8, index=i, sessions=10)
        days = [s["day"] for s in truth["sessions"]]
        assert all(b > a for a, b in zip(days, days[1:]))
        gaps += [b - a for a, b in zip(days, days[1:])]
    assert max(gaps) > 1
    # About 3 sessions a week on average (Lampit 2014: > 3/week added nothing).
    assert 1.8 < statistics.fmean(gaps) < 3.2
