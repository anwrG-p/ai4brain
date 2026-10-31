import json

import pytest

import telemetry_store
from telemetry_store import delete_user, export_user, telemetry_lock

URL = "/v1/telemetry/event"
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

DELETE = "/v1/user/telemetry"
EXPORT = "/v1/user/export"


def ingest(client, n=1, **overrides):
    batch = [{**EVENT, **overrides, "trial_index": i} for i in range(n)]
    assert client.post(URL, json=batch).status_code == 202


def test_delete_removes_events_and_state_files(client, tmp_path):
    ingest(client, 3)
    (tmp_path / "u1.profile.json").write_text("{}")
    (tmp_path / "u10.jsonl").write_text("{}\n")  # another user sharing the prefix
    r = client.delete(DELETE, params={"user_id": "u1"})
    assert r.status_code == 200
    assert r.json() == {"deleted_events": 3, "deleted_files": 2}
    assert not (tmp_path / "u1.jsonl").exists()
    assert not (tmp_path / "u1.profile.json").exists()
    assert (tmp_path / "u10.jsonl").exists()


def test_delete_is_idempotent_and_honest(client, tmp_path):
    ingest(client, 2)
    client.delete(DELETE, params={"user_id": "u1"})
    r = client.delete(DELETE, params={"user_id": "u1"})
    assert r.status_code == 200 and r.json() == {"deleted_events": 0, "deleted_files": 0}


def test_delete_unknown_user_claims_nothing(client, tmp_path):
    r = client.delete(DELETE, params={"user_id": "nobody"})
    assert r.json() == {"deleted_events": 0, "deleted_files": 0}


def test_delete_then_ingest_starts_fresh(client, tmp_path):
    ingest(client, 3)
    client.delete(DELETE, params={"user_id": "u1"})
    ingest(client, 1, session_id="s2")
    lines = (tmp_path / "u1.jsonl").read_text().splitlines()
    assert len(lines) == 1 and json.loads(lines[0])["session_id"] == "s2"


@pytest.mark.parametrize("bad", ["../x", "u1.jsonl", "a/b", "", "x" * 65, "u 1"])
@pytest.mark.parametrize("method,url", [("delete", DELETE), ("get", EXPORT)])
def test_bad_id_rejected(client, tmp_path, method, url, bad):
    (tmp_path / "x.jsonl").write_text("{}\n")
    r = getattr(client, method)(url, params={"user_id": bad})
    assert r.status_code == 422
    assert (tmp_path / "x.jsonl").exists()


@pytest.mark.parametrize("method,url", [("delete", DELETE), ("get", EXPORT)])
def test_missing_id_rejected(client, method, url):
    assert getattr(client, method)(url).status_code == 422


def test_export_streams_the_users_jsonl(client, tmp_path):
    ingest(client, 2)
    ingest(client, 1, user_id="other")
    r = client.get(EXPORT, params={"user_id": "u1"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/x-ndjson")
    assert "u1-telemetry.jsonl" in r.headers["content-disposition"]
    assert r.content == (tmp_path / "u1.jsonl").read_bytes()
    rows = [json.loads(line) for line in r.text.splitlines()]
    assert [row["trial_index"] for row in rows] == [0, 1]
    assert {row["user_id"] for row in rows} == {"u1"}


def test_export_with_no_data_is_404(client):
    assert client.get(EXPORT, params={"user_id": "nobody"}).status_code == 404


def test_export_leaves_no_temp_files(client, tmp_path):
    ingest(client, 1)
    client.get(EXPORT, params={"user_id": "u1"})
    assert sorted(p.name for p in tmp_path.iterdir()) == [".lock", "u1.jsonl"]


def test_routes_in_openapi(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert "delete" in paths[DELETE] and "get" in paths[EXPORT]


def test_delete_counts_are_honest_whatever_the_case(client, tmp_path):
    # u1 and U1 are one file on a case-insensitive disk (Windows, macOS), two on Linux.
    ingest(client, 3)
    before = (tmp_path / "u1.jsonl").exists()
    r = client.delete(DELETE, params={"user_id": "U1"})
    removed = before and not (tmp_path / "u1.jsonl").exists()
    expected = {"deleted_events": 3, "deleted_files": 1} if removed else {
        "deleted_events": 0, "deleted_files": 0}
    assert r.status_code == 200 and r.json() == expected


def test_delete_user_counts_jsonl_found_under_another_case(tmp_path):
    (tmp_path / "u1.jsonl").write_text("{}\n{}\n")
    if not (tmp_path / "U1.jsonl").exists():
        pytest.skip("case-sensitive filesystem")
    assert delete_user("U1", tmp_path) == {"deleted_events": 2, "deleted_files": 1}


def test_export_over_the_ceiling_is_413(client, tmp_path, monkeypatch):
    ingest(client, 2)
    monkeypatch.setattr(telemetry_store, "EXPORT_MAX_BYTES", 10)
    r = client.get(EXPORT, params={"user_id": "u1"})
    assert r.status_code == 413
    assert (tmp_path / "u1.jsonl").exists()


def test_export_ceiling_default_is_50_mb():
    assert telemetry_store.EXPORT_MAX_BYTES == 50 * 1024 * 1024


@pytest.mark.parametrize(
    "method,url,kwargs",
    [
        ("delete", DELETE, {"params": {"user_id": "u1"}}),
        ("get", EXPORT, {"params": {"user_id": "u1"}}),
        ("post", URL, {"json": EVENT}),
    ],
)
def test_busy_lock_is_503(client, tmp_path, monkeypatch, method, url, kwargs):
    ingest(client, 1)
    monkeypatch.setattr(telemetry_store, "LOCK_TIMEOUT_S", 0.1)
    with telemetry_lock(tmp_path):
        r = getattr(client, method)(url, **kwargs)
    assert r.status_code == 503 and r.headers["retry-after"] == "1"
    assert len((tmp_path / "u1.jsonl").read_text().splitlines()) == 1


@pytest.mark.parametrize("fn", [delete_user, export_user])
def test_store_functions_check_the_id_themselves(tmp_path, fn):
    (tmp_path / "x.jsonl").write_text("{}\n")
    for bad in ["../x", "x.jsonl", "u1\n", ""]:
        with pytest.raises(ValueError):
            fn(bad, tmp_path)
    assert (tmp_path / "x.jsonl").exists()


def test_export_user_returns_none_when_nothing_is_stored(tmp_path):
    assert export_user("nobody", tmp_path) is None
