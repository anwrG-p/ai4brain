"""BE-00: no endpoint answers with made-up values, and nothing the frontend shows names a brain region."""

import importlib
import json

import pytest
from fastapi.testclient import TestClient

REGION_NAMES = ["dlPFC", "ACC", "vlPFC", "Striatum", "Hippocampus", "Parieto", "cortical", "cortex"]

EVENT = {
    "user_id": "u_del",
    "session_id": "s1",
    "task_id": "t1",
    "trial_index": 0,
    "dimension": "working_memory",
    "score_norm": 1.0,
    "response_time_ms": 512.5,
    "error_flag": False,
    "error_burst": 0,
    "hesitation_jitter": 12.3,
    "client_ts": "2026-10-23T12:00:00Z",
}


def assert_no_region_names(payload) -> None:
    text = json.dumps(payload)
    for name in REGION_NAMES:
        assert name not in text, f"{name!r} leaked into {text[:200]}"
    assert "bottleneck" not in text


# --- user_id: required and file-safe on every /v1 route --------------------------------------

USER_ROUTES = [
    ("get", "/v1/tasks/next", lambda uid: {"params": {} if uid is None else {"user_id": uid}}),
    ("get", "/v1/dashboard/profile", lambda uid: {"params": {} if uid is None else {"user_id": uid}}),
    ("get", "/v1/coach/collaboration-score", lambda uid: {"params": {} if uid is None else {"user_id": uid}}),
    ("delete", "/v1/user/telemetry", lambda uid: {"params": {} if uid is None else {"user_id": uid}}),
    (
        "post",
        "/v1/coach/chat",
        # A body that is valid apart from the id, so the 422 is about the id.
        lambda uid: {
            "json": {"transcript": [], "message": "hi", "kind": "typed"}
            | ({} if uid is None else {"user_id": uid})
        },
    ),
    ("post", "/v1/clustering/evaluate", lambda uid: {"json": {} if uid is None else {"user_id": uid}}),
]


@pytest.mark.parametrize("method,path,kwargs", USER_ROUTES)
@pytest.mark.parametrize("uid", [None, "../x", "a.b", "", "x" * 65])
def test_user_id_is_required_and_pattern_checked(client, method, path, kwargs, uid):
    if method == "delete":
        r = client.request("DELETE", path, **kwargs(uid))
    else:
        r = getattr(client, method)(path, **kwargs(uid))
    assert r.status_code == 422


# --- honest delete ----------------------------------------------------------------------------


def test_delete_removes_the_jsonl_and_counts_events(client, tmp_path):
    batch = [{**EVENT, "trial_index": i} for i in range(3)]
    assert client.post("/v1/telemetry/event", json=batch).json() == {"accepted": 3}
    assert (tmp_path / "u_del.jsonl").exists()

    r = client.delete("/v1/user/telemetry", params={"user_id": "u_del"})
    assert r.status_code == 200
    assert r.json() == {"deleted_events": 3, "deleted_chat_turns": 0, "deleted_files": 1}
    assert not (tmp_path / "u_del.jsonl").exists()


def test_delete_is_idempotent_and_reports_zero(client):
    r = client.delete("/v1/user/telemetry", params={"user_id": "nobody"})
    assert r.status_code == 200
    assert r.json() == {"deleted_events": 0, "deleted_chat_turns": 0, "deleted_files": 0}


def test_delete_leaves_other_users_alone(client, tmp_path):
    client.post("/v1/telemetry/event", json={**EVENT, "user_id": "keep_me"})
    client.post("/v1/telemetry/event", json=EVENT)
    client.delete("/v1/user/telemetry", params={"user_id": "u_del"})
    assert (tmp_path / "keep_me.jsonl").exists()


@pytest.mark.parametrize("bad", ["../x", "a.b", "", "x" * 65])
def test_delete_rejects_ids_that_are_not_file_safe(client, monkeypatch, tmp_path, bad):
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path / "telemetry"))
    victim = tmp_path / "x.jsonl"  # what "../x" would reach
    victim.write_text("{}\n", encoding="utf-8")
    r = client.delete("/v1/user/telemetry", params={"user_id": bad})
    assert r.status_code == 422
    assert victim.exists()


# --- profile: numbers only from events an exercise scorer reads (BE-11) ----------------------


def test_profile_never_invents_numbers(client):
    # Stored events that no exercise scorer reads (task "t1" is no exercise) score no skill, so
    # the profile has nothing to show rather than a prior dressed up as a score (R15).
    setup = client.post(
        "/v1/telemetry/event", json=[{**EVENT, "user_id": "prof", "trial_index": i} for i in range(20)]
    )
    assert setup.status_code == 202
    r = client.get("/v1/dashboard/profile", params={"user_id": "prof"})
    assert r.status_code == 200
    assert r.json() == {"user_id": "prof", "status": "not_enough_data", "sessions": 1, "min_sessions": 1}


# --- health check -----------------------------------------------------------------------------


def test_health_check_is_status_and_version_only(client):
    assert client.get("/").json() == {"status": "OPERATIONAL", "version": "1.4.0"}


# --- the agent engine's /api routes are gone -------------------------------------------------


@pytest.mark.parametrize(
    "method,path",
    [
        ("post", "/api/session/init"),
        ("get", "/api/session/init"),
        ("post", "/api/telemetry/ingest"),
        ("get", "/api/brain/state/u1"),
        ("get", "/api/brain/history/u1"),
        ("post", "/api/coach/reflection"),
    ],
)
def test_api_routes_are_unmounted(client, method, path):
    assert getattr(client, method)(path).status_code == 404


def test_no_route_payload_names_a_region(client):
    assert_no_region_names(client.post("/v1/clustering/evaluate", json={"user_id": "u1"}).json())
    assert_no_region_names(client.get("/v1/dashboard/profile", params={"user_id": "u1"}).json())
    assert_no_region_names(client.get("/").json())


# --- CORS -------------------------------------------------------------------------------------


def preflight(app, origin: str):
    return TestClient(app).options(
        "/v1/telemetry/event",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
    )


@pytest.fixture
def reload_main(monkeypatch):
    def _reload(origins: str | None):
        if origins is None:
            monkeypatch.delenv("CORS_ALLOW_ORIGINS", raising=False)
        else:
            monkeypatch.setenv("CORS_ALLOW_ORIGINS", origins)
        return importlib.reload(importlib.import_module("app.main")).app

    yield _reload
    monkeypatch.delenv("CORS_ALLOW_ORIGINS", raising=False)
    importlib.reload(importlib.import_module("app.main"))


def test_cors_defaults_to_the_vite_dev_origin(reload_main):
    app = reload_main(None)
    ok = preflight(app, "http://localhost:5173")
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-credentials" not in ok.headers
    assert "access-control-allow-origin" not in preflight(app, "https://evil.example").headers


def test_cors_origins_come_from_env(reload_main):
    app = reload_main("https://twin.example, https://staging.twin.example")
    for origin in ("https://twin.example", "https://staging.twin.example"):
        assert preflight(app, origin).headers.get("access-control-allow-origin") == origin
    assert "access-control-allow-origin" not in preflight(app, "http://localhost:5173").headers


def test_cors_never_wildcards_with_credentials(reload_main):
    from starlette.middleware.cors import CORSMiddleware

    app = reload_main("*")
    cors = next(m for m in app.user_middleware if m.cls is CORSMiddleware)
    assert not cors.kwargs.get("allow_credentials", False)
