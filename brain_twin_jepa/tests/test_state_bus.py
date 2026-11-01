"""BE-11: the state bus (Member 3 -> Members 5 and 2), unit level.

Frames are fed as session summaries, so each test controls the pillar vector behind every frame.
The cluster model is a planted two-cluster fit (all-low vs all-high pillars) saved where the server
reads it (CLUSTER_MODEL_PATH), so the loader is exercised too.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

from brain_twin_jepa import profile, state_bus
from brain_twin_jepa.bootstrap import save_cluster_model
from brain_twin_jepa.profile import PILLARS, SessionSummary
from clustering_engine.clustering_gmm import fit_gmm

T0 = datetime(2026, 10, 1, 9, tzinfo=timezone.utc)
NOW = T0 + timedelta(days=60)  # every summary below is long idle, so closed
LOW, HIGH = [25.0] * 5, [75.0] * 5


def planted(path, seed=0, low=25.0, k=2):
    rng = np.random.default_rng(seed)
    centres = [low, 75.0, 50.0][:k]
    X = np.vstack([rng.normal(c, 4, (60, 5)) for c in centres])
    model = fit_gmm(X, k=k, seed=seed, features=list(PILLARS))
    save_cluster_model(model, path)
    return model


@pytest.fixture(autouse=True)
def telemetry(tmp_path, monkeypatch):
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path / "telemetry"))


@pytest.fixture
def model(tmp_path, monkeypatch):
    path = tmp_path / "gmm.json"
    monkeypatch.setenv("CLUSTER_MODEL_PATH", str(path))
    return planted(path)


def summary(i, vec, *, received=None):
    at = T0 + timedelta(days=i)
    return SessionSummary(
        session_id=f"s{i}",
        started_at=at,
        last_received=received or at + timedelta(minutes=10),
        pillars=dict(zip(PILLARS, vec)),
        uncertainty={p: 12.0 for p in PILLARS},
    )


def history(*vecs):
    return [summary(i, v) for i, v in enumerate(vecs)]


@pytest.fixture
def events():
    got = {"tasks": [], "coach": []}
    unsubs = [state_bus.bus.subscribe(t, got[t].append) for t in got]
    yield got
    for u in unsubs:
        u()


def component_near(model, vec):
    return int(np.argmax(model.posteriors(np.array(vec))))


def test_transition_emits_exactly_once(model, events):
    frames = [LOW, LOW, HIGH, HIGH, HIGH, HIGH]
    for n in range(1, len(frames) + 1):
        state_bus.refresh("u1", history(*frames[:n]), now=NOW)
        state_bus.refresh("u1", history(*frames[:n]), now=NOW)  # nothing new: publishes nothing
    transitions = [e for e in events["coach"] if e.transition_occurred]
    assert len(transitions) == 1
    # One event pair per new frame, none for the repeated refreshes.
    assert len(events["coach"]) == len(events["tasks"]) == len(frames)
    # The switch needs 3 confirming frames (N_confirm = 3): it lands on the 5th frame.
    assert events["coach"].index(transitions[0]) == 4
    assert events["tasks"][-1].active_cluster_id == component_near(model, HIGH)


def test_boundary_frames_never_switch(model, events):
    mid = [50.0] * 5
    frames = [LOW, mid, LOW, mid, LOW, mid]
    for n in range(1, len(frames) + 1):
        state_bus.refresh("u1", history(*frames[:n]), now=NOW)
    assert not any(e.transition_occurred for e in events["coach"])


def test_events_carry_the_readme_contracts(model, events):
    state_bus.refresh("u1", history(LOW), now=NOW)
    task, coach = events["tasks"][0], events["coach"][0]
    # Member 3 -> Member 5: { user_id, active_cluster_id, centroid_vector, confidence }
    assert task.user_id == "u1"
    assert task.active_cluster_id == component_near(model, LOW)
    assert set(task.centroid_vector) == set(PILLARS)
    assert task.centroid_vector["focus"] == pytest.approx(model.means[task.active_cluster_id][0])
    assert 0.5 < task.confidence <= 1.0
    assert task.model_id == model.model_id
    assert task.archetype == model.name(task.active_cluster_id)
    # Member 3 -> Member 2: { user_id, transition_occurred, delta_vector, uncertainty }
    assert coach.user_id == "u1" and coach.transition_occurred is False
    target = 1 - task.active_cluster_id
    expected = model.means[target] - model.means[task.active_cluster_id]
    assert [coach.delta_vector[p] for p in PILLARS] == pytest.approx(expected.tolist())
    assert coach.uncertainty == pytest.approx(1 - task.confidence)


def test_the_newest_session_is_a_frame_only_once_closed(model, events):
    now = T0 + timedelta(days=1, minutes=20)
    open_ = summary(1, HIGH, received=now - timedelta(minutes=5))
    state_bus.refresh("u1", [summary(0, LOW), open_], now=now)
    assert len(events["tasks"]) == 1  # s0 only: s1 is still being played
    state_bus.refresh("u1", [summary(0, LOW), open_], now=now + timedelta(minutes=31))
    assert len(events["tasks"]) == 2  # idle for 30 minutes: closed
    assert state_bus.load("u1").frames == ["s0", "s1"]


def test_old_frames_are_never_stepped_again(model, events, monkeypatch):
    monkeypatch.setattr(state_bus, "FRAMES_KEPT", 2)  # far fewer ids kept than sessions played
    frames = [LOW] * 6
    for n in range(1, len(frames) + 1):
        state_bus.refresh("u1", history(*frames[:n]), now=NOW)
    state_bus.refresh("u1", history(*frames), now=NOW)
    assert len(events["tasks"]) == len(frames)  # one step per new session, none repeated
    assert state_bus.load("u1").frames == ["s4", "s5"]


def test_a_session_missing_a_pillar_is_no_frame_but_later_ones_use_the_latest_scores(model, events):
    partial = [None, None, 75.0, 75.0, 75.0]
    state_bus.refresh("u1", history(partial), now=NOW)
    assert events["tasks"] == []  # focus and agility never measured: no vector, no frame (R15)
    state_bus.refresh("u1", history(partial, [75.0, 75.0, None, None, None]), now=NOW)
    assert len(events["tasks"]) == 1  # the rolling latest score per pillar now covers all five
    assert events["tasks"][0].active_cluster_id == component_near(model, HIGH)


def test_a_new_users_gate_starts_from_the_latest_finished_session(model, events):
    state_bus.refresh("u1", history(LOW, LOW, HIGH), now=NOW)
    st = state_bus.load("u1")
    assert st.gate["active"] == component_near(model, HIGH) and st.gate["switches"] == 0
    assert st.frames == ["s0", "s1", "s2"]  # all counted as seen; only the latest was stepped
    assert len(events["tasks"]) == 1 and not events["coach"][0].transition_occurred


def test_a_model_swap_resets_the_gate(model, events, tmp_path):
    for n in (1, 2, 3):
        state_bus.refresh("u1", history(LOW, HIGH, HIGH)[:n], now=NOW)
    before = state_bus.load("u1")
    assert before.gate["active"] == component_near(model, LOW)
    assert before.gate["count"] == 2  # one more HIGH frame would switch under this model

    swapped = planted(tmp_path / "gmm.json", seed=1, low=20.0)  # same path: the server's model changes
    assert swapped.model_id != model.model_id
    state_bus.refresh("u1", history(LOW, HIGH, HIGH), now=NOW)
    after = state_bus.load("u1")
    assert after.model_id == swapped.model_id
    # A fresh gate: it adopts the latest frame, with no pending challenger and no switch counted.
    assert after.gate["active"] == component_near(swapped, HIGH)
    assert after.gate["count"] == 0 and after.gate["switches"] == 0
    # Indices from the old model mean nothing now, so the swap itself is never a "transition".
    assert not any(e.transition_occurred for e in events["coach"])
    assert events["tasks"][-1].model_id == swapped.model_id


def test_gate_state_is_kept_per_user_with_the_model_id(model):
    state_bus.refresh("u1", history(LOW), now=NOW)
    state_bus.refresh("u1", history(LOW, HIGH), now=NOW)
    state_bus.refresh("u2", history(HIGH), now=NOW)
    u1, u2 = state_bus.load("u1"), state_bus.load("u2")
    assert u1.model_id == u2.model_id == model.model_id
    assert u1.gate["challenger"] == component_near(model, HIGH) and u1.gate["count"] == 1
    assert u2.gate["count"] == 0
    # The gate round-trips as a dataclass (BE-09: asdict / HysteresisGate(**d)).
    raw = json.loads((state_bus.state_dir() / "u1.json").read_text(encoding="utf-8"))
    assert raw["gate"] == u1.gate and raw["model_id"] == model.model_id


def test_no_model_means_no_cluster_and_no_events(tmp_path, monkeypatch, events):
    monkeypatch.setenv("CLUSTER_MODEL_PATH", str(tmp_path / "missing.json"))
    st = state_bus.refresh("u1", history(LOW, HIGH), now=NOW)
    assert st.model_id is None and st.tasks is None and st.coach is None
    assert events == {"tasks": [], "coach": []}
    assert profile.cluster_model()[1] == "no_model"


def test_an_invalid_model_is_no_model(tmp_path, monkeypatch, events):
    path = tmp_path / "gmm.json"
    path.write_text('{"k": 2}', encoding="utf-8")
    monkeypatch.setenv("CLUSTER_MODEL_PATH", str(path))
    st = state_bus.refresh("u1", history(LOW), now=NOW)
    assert st.tasks is None
    assert profile.cluster_model()[1] == "invalid_model"


def test_a_failing_subscriber_does_not_stop_the_others(model, events, caplog):
    def boom(event):
        raise RuntimeError("subscriber bug")

    unsubscribe = state_bus.bus.subscribe("tasks", boom)
    try:
        state_bus.refresh("u1", history(LOW), now=NOW)
    finally:
        unsubscribe()
    assert len(events["tasks"]) == 1 and len(events["coach"]) == 1
    assert "RuntimeError" in caplog.text and "u1" not in caplog.text


def test_every_cluster_is_served_from_the_neutral_pool_until_styles_have_options(model):
    # Per-style pools would hold the same tasks (ARCHETYPE_OPTIONS has NEUTRAL only) and split the
    # hit rate; the cluster is still known and retained.
    assert state_bus.pool_key("u1") == state_bus.NEUTRAL
    state_bus.refresh("u1", history(HIGH), now=NOW)
    st = state_bus.load("u1")
    assert st.tasks["active_cluster_id"] == component_near(model, HIGH)
    assert st.tasks["pool"] == state_bus.pool_key("u1") == state_bus.NEUTRAL
    from dynamic_cache.cache_dispatcher import ARCHETYPE_OPTIONS

    assert set(ARCHETYPE_OPTIONS) == {state_bus.NEUTRAL}  # when this grows, pool_name must too


def test_a_stale_refresh_never_moves_the_gate_back(model, events):
    """refresh(new) -> refresh(stale) -> refresh(new): no frame is stepped twice and no extra
    event is published (the seen frames are merged, never replaced by an older list)."""
    frames = [LOW, LOW, HIGH]
    for n in (1, 2, 3):
        state_bus.refresh("u1", history(*frames[:n]), now=NOW)
    gate = state_bus.load("u1").gate
    published = len(events["coach"])
    state_bus.refresh("u1", history(*frames[:1]), now=NOW)  # a slower reader's older view
    state_bus.refresh("u1", history(*frames), now=NOW)
    assert state_bus.load("u1").gate == gate
    assert len(events["coach"]) == published
    assert state_bus.load("u1").frames == ["s0", "s1", "s2"]


def test_an_untagged_clustering_model_is_refused(tmp_path, monkeypatch):
    path = tmp_path / "plain.json"
    fit_gmm(np.random.default_rng(0).normal(50, 10, (40, 5)), k=2, features=list(PILLARS)).save(path)
    monkeypatch.setenv("CLUSTER_MODEL_PATH", str(path))
    assert profile.cluster_model() == (None, "invalid_model")  # features of unknown origin


def test_staircase_steps_join_the_trail_as_plain_reasons(model):
    append("play1")  # a step means trials were stored; with no telemetry nothing is kept
    state_bus.record_step("u1", "n_back", 0.5, 0.6)
    state_bus.record_step("u1", "stroop", 0.5, 0.4)
    state_bus.refresh("u1", history(HIGH), now=NOW)
    trail = profile.why_this(state_bus.load("u1").trail)
    kinds = [t["kind"] for t in trail]
    assert kinds == ["style", "easier", "harder"]  # newest first
    assert trail[1]["reason"] == "Color Clash got a little easier because your recent rounds were tough."
    assert trail[2]["reason"] == "Memory Gauntlet got a little harder because your recent rounds went well."
    assert trail[0]["reason"] == f"Your practice style reads as {model.name(component_near(model, HIGH))}."
    assert not any(ch.isdigit() for t in trail for ch in t["reason"])


def append(session_id, n=3):
    from app.privacy.telemetry_store import append_events

    append.counter = getattr(append, "counter", 0) + n
    base = {"user_id": "u1", "task_id": "t1", "dimension": "working_memory", "score_norm": 1.0,
            "response_time_ms": 500.0, "error_flag": False, "error_burst": 0, "hesitation_jitter": 0.0,
            "client_ts": T0.isoformat()}
    start = append.counter - n  # unique trial indexes, so every line differs
    append_events([{**base, "session_id": session_id, "trial_index": start + i} for i in range(n)])


@pytest.fixture
def reads(monkeypatch):
    count = {"n": 0}
    real = state_bus.read_sessions

    def counting(*a, **k):
        count["n"] += 1
        return real(*a, **k)

    monkeypatch.setattr(state_bus, "read_sessions", counting)
    return count


def test_light_refresh_reads_only_the_tail_while_a_session_goes_on(model, reads):
    append("play1")
    state_bus.refresh_light("u1")
    assert reads["n"] == 1  # a new user: one full read
    for _ in range(5):
        append("play1")  # the same session keeps posting
        state_bus.refresh_light("u1")
    assert reads["n"] == 1  # only the appended bytes were read, never the whole file
    state_bus.refresh_light("u1")
    assert reads["n"] == 1  # nothing new: a stat, no read
    append("play2")  # a new session starts: play1 is finished, so a frame may be due
    state_bus.refresh_light("u1")
    assert reads["n"] == 2
    assert state_bus.load("u1").open_session["id"] == "play2"


def test_light_refresh_reads_in_full_after_a_model_change_or_a_rewrite(model, reads, tmp_path):
    append("play1")
    state_bus.refresh_light("u1")
    planted(tmp_path / "gmm.json", seed=3)  # the served model changes
    state_bus.refresh_light("u1")
    assert reads["n"] == 2
    from app.privacy.telemetry_store import telemetry_dir

    (telemetry_dir() / "u1.jsonl").write_text("", encoding="utf-8")  # retention rewrote the file
    state_bus.refresh_light("u1")
    assert reads["n"] == 3


def test_light_refresh_reads_in_full_after_a_rewrite_that_grew_again(model, reads):
    """Retention drops the oldest lines, then new appends make the file longer than the saved
    offset: the tail would start mid-history, so the changed first line forces a full read."""
    from app.privacy.telemetry_store import telemetry_dir

    append("old", n=2)
    append("play1")
    state_bus.refresh_light("u1")
    path = telemetry_dir() / "u1.jsonl"
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    path.write_text("".join(lines[2:]), encoding="utf-8")  # the two "old" lines expired
    append("play1", n=6)  # longer than before, all in the open session
    state_bus.refresh_light("u1")
    assert reads["n"] == 2


def test_light_refresh_closes_an_idle_session(model, reads):
    append("play1")
    state_bus.refresh_light("u1")
    state_bus.refresh_light("u1", now=datetime.now(timezone.utc) + timedelta(minutes=31))
    assert reads["n"] == 2  # idle for 30 minutes: a full refresh makes it a frame
    assert state_bus.load("u1").open_session is None


def test_a_delete_lands_after_a_refresh_in_flight(model, monkeypatch):
    import threading

    from app.privacy.telemetry_store import delete_user

    append("play1")
    append("play2")
    real, read_done, go = state_bus.read_sessions, threading.Event(), threading.Event()

    def slow_read(*a, **k):
        sessions = real(*a, **k)
        read_done.set()
        go.wait(5)  # the refresh holds the user's lock here, with the old data in hand
        return sessions

    monkeypatch.setattr(state_bus, "read_sessions", slow_read)
    refresher = threading.Thread(target=lambda: state_bus.refresh_full("u1"))  # the profile route's path
    refresher.start()
    assert read_done.wait(5)
    deleter = threading.Thread(target=lambda: delete_user("u1"))
    deleter.start()
    deleter.join(0.3)
    assert deleter.is_alive()  # the bus delete waits for the refresh in flight
    go.set()
    refresher.join(5)
    deleter.join(5)
    assert not (state_bus.state_dir() / "u1.json").exists()


def test_after_a_delete_new_telemetry_starts_from_nothing(model):
    from app.privacy.telemetry_store import delete_user

    append("play1")
    state_bus.refresh("u1")
    state_bus.record_step("u1", "n_back", 0.5, 0.6)
    assert state_bus.load("u1").trail
    delete_user("u1")
    state_bus.record_step("u1", "stroop", 0.5, 0.6)  # a serve racing the delete keeps nothing
    assert state_bus.load("u1") is None
    append("play9")
    st = state_bus.refresh("u1")
    assert st.trail == [] and st.frames == [] and st.open_session["id"] == "play9"


def test_a_refresh_with_no_telemetry_drops_the_whole_state(model):
    append("play1")
    state_bus.refresh("u1")
    state_bus.record_step("u1", "n_back", 0.5, 0.6)
    from app.privacy.telemetry_store import telemetry_dir

    (telemetry_dir() / "u1.jsonl").unlink()  # every line expired (retention)
    state_bus.refresh("u1")
    assert not (state_bus.state_dir() / "u1.json").exists()  # the trail too


def test_trail_entries_older_than_retention_are_pruned(model, monkeypatch):
    monkeypatch.setenv("RETENTION_DAYS", "7")
    append("play1")
    state_bus.refresh("u1")
    old = datetime.now(timezone.utc) - timedelta(days=8)
    st = state_bus.load("u1")
    st.trail = [{"at": old.isoformat(), "kind": "harder", "schema": "mst"}]
    state_bus._save("u1", st)
    state_bus.record_step("u1", "n_back", 0.5, 0.6)
    assert [t["schema"] for t in state_bus.load("u1").trail] == ["n_back"]


def test_delete_and_export_cover_the_bus_state(model):
    from app.privacy.telemetry_store import delete_user, export_user

    state_bus.refresh("u1", history(LOW, HIGH), now=NOW)
    state_bus.record_step("u1", "mst", 0.5, 0.6)
    lines = [json.loads(x) for x in export_user("u1").splitlines()]
    rec = next(x for x in lines if x.get("record") == "state_bus")
    assert rec["data"]["model_id"] == model.model_id and rec["data"]["trail"]
    assert delete_user("u1")["deleted_files"] >= 1
    assert not (state_bus.state_dir() / "u1.json").exists()
    assert state_bus.load("u1") is None
    assert export_user("u1") is None


def test_the_retention_cli_drops_idle_bus_files(model, capsys):
    import os
    import time

    from app.privacy import retention

    state_bus.refresh("u1", history(LOW), now=NOW)
    state_bus.refresh("u2", history(LOW), now=NOW)
    stale = state_bus.state_dir() / "u1.json"
    os.utime(stale, (time.time() - 40 * 86400,) * 2)
    assert retention.main(["--days", "30"]) == 0
    assert json.loads(capsys.readouterr().out)["state_bus_removed"] == 1
    assert not stale.exists() and (state_bus.state_dir() / "u2.json").exists()


def test_delete_with_an_explicit_directory_keeps_to_it(model, tmp_path):
    from app.privacy.telemetry_store import delete_user

    state_bus.refresh("u1", history(LOW), now=NOW)
    tool_dir = tmp_path / "tool"
    (tool_dir / "state_bus").mkdir(parents=True)
    (tool_dir / "state_bus" / "u1.json").write_text("{}", encoding="utf-8")
    delete_user("u1", tool_dir)
    assert not (tool_dir / "state_bus" / "u1.json").exists()
    assert (state_bus.state_dir() / "u1.json").exists()  # the server's own store is untouched
