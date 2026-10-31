"""GET /v1/tasks/next over HTTP: the frontend contract, filters, idempotency, privacy delete/export."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from dynamic_cache import api
from dynamic_cache.generators import DIMENSION_OF, SCHEMA_TYPES

URL = "/v1/tasks/next"
TASK_SOURCE = Path(__file__).resolve().parents[2] / "frontend" / "src" / "features" / "assessment" / "tasks" / "taskSource.ts"
UUID = "3f2a9c1e-8b7d-4e6f-a5c4-1d2e3f4a5b6c"  # what getUserId() stores (crypto.randomUUID)


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path / "telemetry"))
    d = api.make_dispatcher(registry_dir=lambda: tmp_path / "registry", background=False)
    previous = api.set_dispatcher(d)
    yield TestClient(app)
    api.set_dispatcher(previous)
    d.close()


# A port of taskSource.ts validTask(): the frontend drops anything this rejects.
FE_SCHEMA_TYPES = ["n_back", "stroop", "matrix", "mental_rotation", "relational", "tower", "ufov", "mst"]
FE_DIMENSIONS = [
    "working_memory",
    "pattern_induction",
    "executive_function",
    "spatial_orientation",
    "processing_speed",
    "episodic_memory",
]
FE_TASK_ID = re.compile(r"^[\w:.-]{1,48}$", re.ASCII)


def valid_task(t) -> bool:
    return (
        isinstance(t, dict)
        and t.get("schema_type") in FE_SCHEMA_TYPES
        and t.get("dimension") in FE_DIMENSIONS
        and isinstance(t.get("task_id"), str)
        and bool(FE_TASK_ID.match(t["task_id"]))
        and isinstance(t.get("params"), dict)
    )


@pytest.mark.skipif(not TASK_SOURCE.is_file(), reason="frontend/ is not present")
def test_the_port_matches_task_source_ts():
    src = TASK_SOURCE.read_text(encoding="utf-8")
    listed = re.search(r"const SCHEMA_TYPES[^=]*=\s*\[([^\]]*)\]", src).group(1)
    assert re.findall(r"'(\w+)'", listed) == FE_SCHEMA_TYPES
    dims = re.search(r"const DIMENSIONS[^=]*=\s*\[([^\]]*)\]", src).group(1)
    assert re.findall(r"'(\w+)'", dims) == FE_DIMENSIONS
    assert "const TASK_ID = /^[\\w:.-]{1,48}$/" in src
    # The request it sends: only user_id, so every other query parameter must stay optional.
    assert "`/v1/tasks/next?user_id=${encodeURIComponent(userId)}`" in src


def test_the_frontends_exact_request_gets_a_valid_task(client):
    r = client.get(f"{URL}?user_id={UUID}")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/json"
    t = r.json()
    assert valid_task(t)
    assert set(t) == {"task_id", "dimension", "schema_type", "params", "surface_seed"}  # TaskPayload


@pytest.mark.parametrize("schema_type", SCHEMA_TYPES)
def test_every_schema_is_served_and_valid(client, schema_type):
    r = client.get(URL, params={"user_id": "u1", "schema_type": schema_type})
    assert r.status_code == 200
    t = r.json()
    assert valid_task(t) and t["schema_type"] == schema_type and t["dimension"] == DIMENSION_OF[schema_type]


def test_dimension_filter(client):
    for _ in range(4):
        t = client.get(URL, params={"user_id": "u1", "dimension": "executive_function"}).json()
        assert t["schema_type"] in {"stroop", "tower"}


@pytest.mark.parametrize(
    "params",
    [
        {"user_id": "u1", "schema_type": "go_no_go"},
        {"user_id": "u1", "dimension": "vibes"},
        {"user_id": "u1", "schema_type": "stroop", "dimension": "working_memory"},
        {"user_id": "u1", "session_id": "a.b"},
        {"user_id": "u1", "session_id": "s1", "seq": -1},
        {"user_id": "../u1"},
        {},
    ],
)
def test_bad_requests_are_422(client, params):
    assert client.get(URL, params=params).status_code == 422


def test_idempotent_per_user_and_session(client):
    q = {"user_id": "u1", "session_id": "sess-1", "seq": 0}
    a, b = client.get(URL, params=q), client.get(URL, params=q)
    assert a.status_code == b.status_code == 200 and a.content == b.content
    assert client.get(URL, params={**q, "seq": 1}).json()["task_id"] != a.json()["task_id"]
    # The id is case-insensitive (user_key), so U1 is the same user in the same session.
    assert client.get(URL, params={**q, "user_id": "U1"}).content == a.content


def test_no_fresh_task_is_503(client, monkeypatch):
    api.get_dispatcher().seed_source = lambda: 7
    assert client.get(URL, params={"user_id": "u1", "schema_type": "matrix"}).status_code == 200
    r = client.get(URL, params={"user_id": "u1", "schema_type": "matrix"})
    assert r.status_code == 503 and r.headers["retry-after"] == "1"


def test_delete_clears_the_registry(client, tmp_path):
    client.get(URL, params={"user_id": "u1", "session_id": "s1"})
    client.get(URL, params={"user_id": "u2", "session_id": "s1"})
    api.get_dispatcher().flush()
    reg = tmp_path / "registry"
    assert (reg / "u1.json").exists() and (reg / "u2.json").exists()

    r = client.delete("/v1/user/telemetry", params={"user_id": "U1"})
    assert r.status_code == 200 and r.json() == {"deleted_events": 0, "deleted_files": 1}
    assert not (reg / "u1.json").exists()
    assert (reg / "u2.json").exists()  # other users untouched
    assert api.get_dispatcher().export("u1") is None  # memory too, not only the file
    assert client.delete("/v1/user/telemetry", params={"user_id": "u1"}).json()["deleted_files"] == 0


def test_export_includes_the_registry(client):
    assert client.get("/v1/user/export", params={"user_id": "u1"}).status_code == 404
    client.get(URL, params={"user_id": "u1", "session_id": "s1"})
    r = client.get("/v1/user/export", params={"user_id": "u1"})
    assert r.status_code == 200
    rows = [json.loads(line) for line in r.text.splitlines()]
    assert len(rows) == 1 and rows[0]["store"] == "task_registry" and rows[0]["user_id"] == "u1"
    assert set(rows[0]["data"]) == {"v", "seen", "sessions", "schemas", "last"}


def test_export_puts_the_registry_after_the_events(client):
    event = {
        "user_id": "u1",
        "session_id": "s1",
        "task_id": "n_back-1-abc",
        "trial_index": 0,
        "dimension": "working_memory",
        "score_norm": 1.0,
        "response_time_ms": 500.0,
        "error_flag": False,
        "error_burst": 0,
        "hesitation_jitter": 1.0,
        "client_ts": "2026-10-31T12:00:00Z",
    }
    assert client.post("/v1/telemetry/event", json=event).status_code == 202
    client.get(URL, params={"user_id": "u1"})
    rows = [json.loads(line) for line in client.get("/v1/user/export", params={"user_id": "u1"}).text.splitlines()]
    assert rows[0]["task_id"] == "n_back-1-abc" and rows[1]["store"] == "task_registry"


def test_openapi_documents_the_payload(client):
    op = client.get("/openapi.json").json()["paths"][URL]["get"]
    assert "TaskPayload" in json.dumps(op["responses"]["200"])
    assert {p["name"] for p in op["parameters"]} == {"user_id", "schema_type", "dimension", "session_id", "seq"}
    assert [p["name"] for p in op["parameters"] if p["required"]] == ["user_id"]


# --- privacy: scoped hooks, the real registry, failures -------------------------------------------


def test_a_pre_existing_registry_file_outside_tmp_is_never_touched(client):
    """The production registry (data/processed/task_registry) is out of every test's reach."""
    from app.privacy.telemetry_store import delete_user, export_user
    from dynamic_cache import cache_dispatcher

    real = Path(cache_dispatcher.__file__).resolve().parents[1] / "data" / "processed" / "task_registry"
    created = [p for p in (real.parent, real) if not p.exists()]  # removed again, innermost first
    probe = real / "never-touch-probe.json"
    real.mkdir(parents=True, exist_ok=True)
    probe.write_text('{"v": 1, "probe": true}')
    stamp = probe.stat().st_mtime_ns
    try:
        q = {"user_id": "never-touch-probe"}
        assert client.get(URL, params=q).status_code == 200
        client.get("/v1/user/export", params=q)
        client.delete("/v1/user/telemetry", params=q)
        delete_user("never-touch-probe")
        export_user("never-touch-probe")
        api.get_dispatcher().flush()
        assert probe.read_text() == '{"v": 1, "probe": true}' and probe.stat().st_mtime_ns == stamp
    finally:
        probe.unlink()
        for p in reversed(created):
            p.rmdir()


def test_store_hooks_keep_to_an_explicit_directory(client, tmp_path):
    from app.privacy.telemetry_store import delete_user, export_user

    client.get(URL, params={"user_id": "u1", "session_id": "s1"})
    api.get_dispatcher().flush()
    served = tmp_path / "registry" / "u1.json"
    before = served.read_bytes()
    tool_dir = tmp_path / "tool"
    (tool_dir / "task_registry").mkdir(parents=True)
    (tool_dir / "task_registry" / "u1.json").write_text('{"v": 1}')
    rows = export_user("u1", tool_dir).decode().splitlines()
    assert [json.loads(r)["data"] for r in rows] == [{"v": 1}]
    assert delete_user("u1", tool_dir) == {"deleted_events": 0, "deleted_files": 1}
    assert not (tool_dir / "task_registry" / "u1.json").exists()
    assert served.read_bytes() == before  # the served registry is untouched


def test_a_failing_store_makes_delete_503_and_still_runs_the_others(client, tmp_path, caplog):
    from app.privacy import telemetry_store

    ran = []
    telemetry_store.register_user_store("broken", lambda key, d: 1 / 0, lambda key, d: None)
    telemetry_store.register_user_store("after", lambda key, d: ran.append(key) or 0, lambda key, d: None)
    try:
        client.get(URL, params={"user_id": "u1", "session_id": "s1"})
        api.get_dispatcher().flush()
        r = client.delete("/v1/user/telemetry", params={"user_id": "u1"})
        assert r.status_code == 503 and r.headers["retry-after"] == "1"
        assert ran == ["u1"]  # the other stores still ran
        assert not (tmp_path / "registry" / "u1.json").exists()  # and so did the registry's
        assert "broken" in caplog.text and "ZeroDivisionError" in caplog.text and "u1" not in caplog.text
    finally:
        del telemetry_store._USER_STORES["broken"], telemetry_store._USER_STORES["after"]
    assert client.delete("/v1/user/telemetry", params={"user_id": "u1"}).status_code == 200  # the retry


def test_a_failing_store_makes_export_503(client):
    from app.privacy import telemetry_store

    telemetry_store.register_user_store("broken", lambda key, d: 0, lambda key, d: 1 / 0)
    try:
        assert client.get("/v1/user/export", params={"user_id": "u1"}).status_code == 503
    finally:
        del telemetry_store._USER_STORES["broken"]


def test_a_corrupt_registry_does_not_block_the_telemetry_export(client, tmp_path):
    (tmp_path / "registry").mkdir(exist_ok=True)
    (tmp_path / "registry" / "u1.json").write_text("{oops")
    r = client.get("/v1/user/export", params={"user_id": "u1"})
    assert r.status_code == 200
    assert json.loads(r.text)["data"] == {"unreadable": "{oops"}


# --- rate limit ---------------------------------------------------------------------------------------


def test_too_many_calls_for_one_id_are_429(client, monkeypatch):
    now = [1_790_000_000.0]
    monkeypatch.setattr(api, "limiter", api.RateLimiter(limits=((3600, 3),), clock=lambda: now[0]))
    for _ in range(3):
        assert client.get(URL, params={"user_id": "u1"}).status_code == 200
    r = client.get(URL, params={"user_id": "U1"})  # the same id in another case
    assert r.status_code == 429 and 0 < int(r.headers["retry-after"]) <= 3600
    assert client.get(URL, params={"user_id": "u2"}).status_code == 200  # per id
    now[0] += 3600
    assert client.get(URL, params={"user_id": "u1"}).status_code == 200  # next window


def test_rate_limiter_windows_and_bound():
    now = [0.0]
    rl = api.RateLimiter(limits=((10, 2), (100, 3)), clock=lambda: now[0], max_keys=2)
    assert rl.hit("a") is None and rl.hit("a") is None
    assert rl.hit("a") == 10  # the short window is full: retry when it ends
    now[0] = 10.0
    assert rl.hit("a") is None  # a new short window; the long one now holds 3
    now[0] = 20.0
    assert rl.hit("a") == 80  # the long window is full until t = 100
    rl.hit("b"), rl.hit("c")
    assert list(rl._hits) == ["b", "c"]  # at most max_keys ids tracked


def test_default_limits():
    assert api.RATE_LIMITS == ((3600, 120), (86_400, 400))


# --- lifespan -----------------------------------------------------------------------------------------


def test_lifespan_starts_and_stops_the_dispatcher(client):
    d = api.get_dispatcher()
    with TestClient(app) as c:
        assert c.get(URL, params={"user_id": "u1"}).status_code == 200
    assert d._closed and api._dispatcher is None
