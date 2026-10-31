"""BE-07: reading stored telemetry, dedupe and session grouping."""

import json
import math
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.privacy import telemetry_store
from app.privacy.telemetry_store import EXPORT_MAX_BYTES, LockTimeout, append_events, telemetry_lock
from brain_twin_jepa.features import session_features
from brain_twin_jepa.telemetry_io import (
    READ_MAX_BYTES,
    EventsTooLarge,
    group_sessions,
    read_events,
    read_sessions,
)

GOLDEN = Path(__file__).resolve().parents[2] / "data" / "fixtures" / "golden_sessions.json"
CASES = {c["name"]: c for c in json.loads(GOLDEN.read_text(encoding="utf-8"))["cases"]}


def ev(session, task, i, ts, **meta):
    return {
        "user_id": "U1",
        "session_id": session,
        "task_id": task,
        "trial_index": i,
        "dimension": "pattern_induction",
        "score_norm": 1.0,
        "response_time_ms": 500.0,
        "error_flag": False,
        "error_burst": 0,
        "hesitation_jitter": 0.0,
        "trial_meta": {"item_id": f"{task}:{i}", **meta},
        "client_ts": ts,
    }


def test_missing_user_reads_empty(tmp_path):
    assert read_events("nobody", tmp_path) == []
    assert read_sessions("nobody", tmp_path / "absent") == []


def test_bad_id_is_rejected(tmp_path):
    with pytest.raises(ValueError):
        read_events("../etc", tmp_path)


def test_retried_batch_is_read_once(tmp_path):
    batch = [ev("s1", "t1", i, f"2026-10-30T09:00:0{i}Z") for i in range(3)]
    append_events(batch, tmp_path)
    append_events(batch[1:], tmp_path)  # the client retried part of the batch
    events = read_events("u1", tmp_path)  # ids are case-insensitive (R13)
    assert [e["trial_index"] for e in events] == [0, 1, 2]
    assert all(e["user_id"] == "u1" for e in events)


def test_torn_line_is_skipped(tmp_path):
    append_events([ev("s1", "t1", 0, "2026-10-30T09:00:00Z")], tmp_path)
    with open(tmp_path / "u1.jsonl", "a", encoding="utf-8") as f:
        f.write('{"user_id": "u1", "sess\n')
    append_events([ev("s1", "t1", 1, "2026-10-30T09:00:01Z")], tmp_path)
    assert [e["trial_index"] for e in read_events("u1", tmp_path)] == [0, 1]


def test_sessions_are_grouped_by_session_id_and_ordered_by_start(tmp_path):
    rows = [
        ev("late", "a", 0, "2026-10-30T10:00:00Z"),
        ev("early", "b", 0, "2026-10-30T09:00:00+00:00"),
        ev("late", "a", 1, "2026-10-30T10:00:05Z"),
        ev("early", "c", 0, "2026-10-30T09:30:00"),  # no offset: UTC
        ev("early", "b", 1, "2026-10-30T11:00:00+02:00"),  # 09:00 UTC
    ]
    append_events(rows, tmp_path)
    sessions = read_sessions("u1", tmp_path)
    assert [s.session_id for s in sessions] == ["early", "late"]
    early, late = sessions
    assert [(e["task_id"], e["trial_index"]) for e in early.events] == [("b", 0), ("c", 0), ("b", 1)]
    assert early.task_ids == ["b", "c"]
    assert early.started_at.isoformat() == "2026-10-30T09:00:00+00:00"
    assert early.ended_at.isoformat() == "2026-10-30T09:30:00+00:00"
    assert len(late.events) == 2


def test_same_item_in_two_sessions_is_not_a_duplicate():
    a = ev("s1", "t1", 0, "2026-10-30T09:00:00Z")
    b = ev("s2", "t1", 0, "2026-10-30T09:00:00Z")
    assert [s.session_id for s in group_sessions([a, b])] == ["s1", "s2"]


def test_ingest_to_features_round_trip_matches_golden(monkeypatch, tmp_path):
    """Golden events through the real HTTP ingest, read back and scored: same values as the TS."""
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path))
    client = TestClient(app)
    case = CASES["duplicates"]
    events = case["events"]
    for k in range(0, len(events), 100):
        assert client.post("/v1/telemetry/event", json=events[k : k + 100]).status_code == 202
    sessions = read_sessions("golden_user")
    assert len(sessions) == 1
    assert len(sessions[0].events) == case["expected"]["unique_events"]
    got = session_features(sessions[0].events)
    for input_id, want in case["expected"]["inputs"].items():
        assert math.isclose(got["inputs"][input_id]["score"], want["score"], abs_tol=1e-6)
        assert got["inputs"][input_id]["trials"] == want["trials"]
    assert math.isclose(got["unified"], case["expected"]["unified"], abs_tol=1e-6)


def test_oversized_file_raises_a_clear_error(tmp_path):
    assert READ_MAX_BYTES == EXPORT_MAX_BYTES
    append_events([ev("s1", "t1", i, "2026-10-30T09:00:00Z") for i in range(3)], tmp_path)
    size = (tmp_path / "u1.jsonl").stat().st_size
    assert len(read_events("u1", tmp_path, max_bytes=size)) == 3  # at the limit is fine
    with pytest.raises(EventsTooLarge, match="read limit"):
        read_events("u1", tmp_path, max_bytes=size - 1)


def test_busy_lock_raises_lock_timeout(monkeypatch, tmp_path):
    append_events([ev("s1", "t1", 0, "2026-10-30T09:00:00Z")], tmp_path)
    monkeypatch.setattr(telemetry_store, "LOCK_TIMEOUT_S", 0.05)
    with telemetry_lock(tmp_path):
        with pytest.raises(LockTimeout):
            read_events("u1", tmp_path)
    assert len(read_events("u1", tmp_path)) == 1  # free again once released
