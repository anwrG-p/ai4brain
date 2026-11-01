import json
import os
import queue
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.privacy import retention, telemetry_store
from app.privacy.telemetry_store import telemetry_lock

# The CLI and the import check run from the repo root, the way the docs say to run them.
REPO_ROOT = Path(__file__).resolve().parents[2]
CLI = [sys.executable, "-m", "backend.app.privacy.retention"]
NOW = datetime(2026, 10, 31, 12, 0, tzinfo=timezone.utc)
EVENT = {
    "user_id": "u1",
    "session_id": "s1",
    "task_id": "t1",
    "trial_index": 0,
    "dimension": "working_memory",
    "score_norm": 0.5,
    "response_time_ms": 500.0,
    "error_flag": False,
    "error_burst": 0,
    "hesitation_jitter": 1.0,
    "client_ts": "2026-10-23T12:00:00Z",
}


def line(age_days, user="u1", **extra):
    received = (NOW - timedelta(days=age_days)).isoformat()
    return json.dumps({"user_id": user, "received_at": received, **extra})


def line_from_now(age_days):
    """For the CLI, which dates against the real clock, not NOW."""
    return json.dumps({"received_at": (datetime.now(timezone.utc) - timedelta(days=age_days)).isoformat()})


def write(path, lines):
    path.write_text("".join(l + "\n" for l in lines), encoding="utf-8")


def read(path):
    return path.read_text(encoding="utf-8").splitlines()


def test_keeps_fresh_lines_and_drops_expired(tmp_path):
    fresh = [line(0, n=1), line(29.9, n=2)]
    write(tmp_path / "u1.jsonl", [line(31, n=0), fresh[0], line(400), fresh[1]])
    report = retention.purge_expired(tmp_path, days=30, now=NOW)
    assert read(tmp_path / "u1.jsonl") == fresh
    assert report == {"files": 1, "kept": 2, "dropped": 2, "undated": 0, "removed_files": 0}


def test_file_with_only_expired_lines_is_removed(tmp_path):
    write(tmp_path / "old.jsonl", [line(31), line(60)])
    write(tmp_path / "u1.jsonl", [line(1)])
    report = retention.purge_expired(tmp_path, days=30, now=NOW)
    assert not (tmp_path / "old.jsonl").exists()
    assert len(read(tmp_path / "u1.jsonl")) == 1
    assert report == {"files": 2, "kept": 1, "dropped": 2, "undated": 0, "removed_files": 1}


def test_undated_or_corrupt_lines_are_dropped(tmp_path):
    # Retention must not keep forever what it cannot date (GDPR Art 5(1)(e)).
    write(tmp_path / "u1.jsonl", [line(1), "{not json", json.dumps({"user_id": "u1"}),
                                  json.dumps({"received_at": "yesterday"})])
    report = retention.purge_expired(tmp_path, days=30, now=NOW)
    assert read(tmp_path / "u1.jsonl") == [line(1)]
    assert report["undated"] == 3 and report["dropped"] == 0


def test_ignores_non_jsonl_files(tmp_path):
    (tmp_path / "notes.txt").write_text("keep me")
    assert retention.purge_expired(tmp_path, days=30, now=NOW)["files"] == 0
    assert (tmp_path / "notes.txt").read_text() == "keep me"


def test_missing_dir_is_a_no_op(tmp_path):
    report = retention.purge_expired(tmp_path / "absent", days=30, now=NOW)
    assert report == {"files": 0, "kept": 0, "dropped": 0, "undated": 0, "removed_files": 0}


def test_concurrent_append_during_retention_loses_nothing(client, tmp_path, monkeypatch):
    now = datetime.now(timezone.utc)
    old = json.dumps({"received_at": (now - timedelta(days=40)).isoformat()})
    fresh = json.dumps({"received_at": now.isoformat()})
    write(tmp_path / "u1.jsonl", [old, fresh, old, fresh])

    # Hold retention between its read and its rewrite, then append from ingest.
    inside = threading.Event()
    real_keep = retention._keep

    def slow_keep(lines, cutoff):
        inside.set()
        time.sleep(0.4)
        return real_keep(lines, cutoff)

    monkeypatch.setattr(retention, "_keep", slow_keep)
    job = threading.Thread(target=retention.purge_expired, args=(tmp_path, 30))
    job.start()
    assert inside.wait(5)
    batch = [{**EVENT, "trial_index": i} for i in range(3)]
    assert client.post("/v1/telemetry/event", json=batch).status_code == 202
    job.join(5)

    lines = read(tmp_path / "u1.jsonl")
    assert lines[:2] == [fresh, fresh]
    assert [json.loads(l)["trial_index"] for l in lines[2:]] == [0, 1, 2]


def test_cli_waits_for_the_ingest_lock(tmp_path):
    write(tmp_path / "u1.jsonl", [line_from_now(400), line_from_now(0)])
    env = {**os.environ, "TELEMETRY_DIR": str(tmp_path)}
    with telemetry_lock(tmp_path):
        proc = subprocess.Popen(
            [*CLI, "--days", "30"],
            cwd=REPO_ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        # Ready signal: the job says on stderr that it found the lock busy.
        lines = queue.Queue()
        threading.Thread(target=lambda: lines.put(proc.stderr.readline()), daemon=True).start()
        assert "waiting for the telemetry lock" in lines.get(timeout=30)
        assert proc.poll() is None
        assert len(read(tmp_path / "u1.jsonl")) == 2
    out, _ = proc.communicate(timeout=30)
    assert proc.returncode == 0
    assert json.loads(out)["dropped"] == 1
    assert len(read(tmp_path / "u1.jsonl")) == 1


def test_cli_gives_up_when_the_lock_stays_busy(tmp_path, monkeypatch, capsys):
    # Also shows the lock is not re-entrant: a second hold in the same thread times out.
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path))
    monkeypatch.setattr(telemetry_store, "LOCK_TIMEOUT_S", 0.1)
    write(tmp_path / "u1.jsonl", [line(400)])
    with telemetry_lock(tmp_path):
        assert retention.main([]) == 1
    assert "run again later" in capsys.readouterr().err
    assert len(read(tmp_path / "u1.jsonl")) == 1


def test_store_and_retention_do_not_import_fastapi():
    code = (
        "import sys, backend.app.privacy.telemetry_store, backend.app.privacy.retention; "
        "assert 'fastapi' not in sys.modules and 'pydantic' not in sys.modules"
    )
    subprocess.run([sys.executable, "-c", code], cwd=REPO_ROOT, check=True, timeout=30)


def test_cli_runs_from_the_repo_root(tmp_path):
    write(tmp_path / "u1.jsonl", [line_from_now(400), line_from_now(0)])
    env = {**os.environ, "TELEMETRY_DIR": str(tmp_path)}
    out = subprocess.run(
        [*CLI, "--days", "30"], cwd=REPO_ROOT, env=env, capture_output=True, text=True, timeout=30
    )
    assert out.returncode == 0, out.stderr
    empty = {"files": 0, "kept": 0, "dropped": 0, "undated": 0, "removed_files": 0}
    assert json.loads(out.stdout) == {
        "files": 1, "kept": 1, "dropped": 1, "undated": 0, "removed_files": 0, "coach": empty,
        "registries_removed": 0,
    }


@pytest.mark.parametrize("days", ["0", "-1", "x"])
def test_cli_rejects_bad_days(days, capsys):
    with pytest.raises(SystemExit) as exc:
        retention.main(["--days", days])
    assert exc.value.code == 2


def test_cli_defaults_to_30_days(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path))
    now = datetime.now(timezone.utc)
    write(tmp_path / "u1.jsonl", [
        json.dumps({"received_at": (now - timedelta(days=31)).isoformat()}),
        json.dumps({"received_at": (now - timedelta(days=29)).isoformat()}),
    ])
    assert retention.main([]) == 0
    assert json.loads(capsys.readouterr().out)["kept"] == 1
