import json

import pytest

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
