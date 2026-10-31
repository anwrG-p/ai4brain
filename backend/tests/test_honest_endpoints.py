"""BE-00: no endpoint answers with made-up values, and nothing the frontend shows names a brain region."""

import importlib
import json

import pytest
from fastapi.testclient import TestClient

from app.memory.template_memory_store import memory_store

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
    assert "plasticity_bottleneck" not in text
    assert "bottleneck" not in text


# --- 501 until the engine behind the route exists -----------------------------------------------


def test_clustering_evaluate_is_501(client):
    r = client.post("/v1/clustering/evaluate", json={"user_id": "u1", "latent_vector": [0.1]})
    assert r.status_code == 501
    assert r.json() == {"detail": "clustering not available yet"}


def test_collaboration_score_is_501(client):
    r = client.get("/v1/coach/collaboration-score", params={"user_id": "u1", "cluster_id": 3})
    assert r.status_code == 501
    assert r.json() == {"detail": "collaboration score not available yet"}


# --- honest delete ----------------------------------------------------------------------------


def test_delete_removes_the_jsonl_and_counts_events(client, tmp_path):
    batch = [{**EVENT, "trial_index": i} for i in range(3)]
    assert client.post("/v1/telemetry/event", json=batch).json() == {"accepted": 3}
    assert (tmp_path / "u_del.jsonl").exists()

    r = client.delete("/v1/user/telemetry", params={"user_id": "u_del"})
    assert r.status_code == 200
    assert r.json() == {"deleted_events": 3, "deleted_files": 1, "deleted_evaluations": 0}
    assert not (tmp_path / "u_del.jsonl").exists()


def test_delete_is_idempotent_and_reports_zero(client):
    r = client.delete("/v1/user/telemetry", params={"user_id": "nobody"})
    assert r.status_code == 200
    assert r.json() == {"deleted_events": 0, "deleted_files": 0, "deleted_evaluations": 0}


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


def test_delete_also_clears_in_memory_evaluations(client):
    memory_store._user_evaluation_history["u_mem"] = [{"x": 1}, {"x": 2}]
    memory_store.get_user_brain_state("u_mem")
    r = client.delete("/v1/user/telemetry", params={"user_id": "u_mem"})
    assert r.json()["deleted_evaluations"] == 2
    assert memory_store.get_user_history("u_mem") == []


# --- profile: dimension ids only, no prior passed off as a score ------------------------------


def run_one_session(client, user_id: str) -> None:
    init = client.post("/api/session/init", json={"user_id": user_id}).json()
    trials = [
        {
            "trial_index": t["trial_index"],
            "stimulus_id": t["stimulus_id"],
            "stimulus_features": {"is_lure": t["is_lure"]},
            "target_present": t["target_present"],
            "user_response": t["target_present"],
            "is_correct": i % 5 != 0,
            "reaction_time_ms": 420.0 + 10 * (i % 7),
        }
        for i, t in enumerate(init["task_config"]["trials"])
    ]
    r = client.post(
        "/api/telemetry/ingest",
        json={
            "session_id": init["session_id"],
            "user_id": user_id,
            "task_type": init["task_config"]["task_type"],
            "trials": trials,
        },
    )
    assert r.status_code == 200, r.text


def test_profile_without_data_says_so(client):
    r = client.get("/v1/dashboard/profile", params={"user_id": "fresh_user"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "not_enough_data"
    assert body["estimates"] == []
    assert "collaboration" not in body
    assert_no_region_names(body)


def test_profile_after_a_session_uses_dimension_ids_only(client):
    run_one_session(client, "prof_user")
    body = client.get("/v1/dashboard/profile", params={"user_id": "prof_user"}).json()
    assert body["status"] == "ok"
    assert_no_region_names(body)
    assert "collaboration" not in body  # no hard-coded collaboration block
    ids = {e["dimensionId"] for e in body["estimates"]}
    assert ids and ids <= {
        "working_memory",
        "inhibition_control",
        "cognitive_flexibility",
        "episodic_pattern_separation",
        "divided_perceptual_speed",
    }
    keys = {e["backendDimensionKey"] for e in body["estimates"]}
    assert keys <= {"working_memory", "executive_function", "episodic_memory", "processing_speed"}
    for e in body["estimates"]:
        assert 0.0 <= e["ciLower"] <= e["mean"] <= e["ciUpper"] <= 100.0
        assert e["sampleSize"] == 1
    assert body["focus_dimension_id"] in ids


def test_profile_omits_dimensions_the_sessions_never_measured(client):
    # A fresh user's first session is an n-back, which never observes the episodic node:
    # an estimate for it would only restate the prior.
    run_one_session(client, "nback_user")
    assert memory_store.get_user_history("nback_user")
    body = client.get("/v1/dashboard/profile", params={"user_id": "nback_user"}).json()
    ids = {e["dimensionId"] for e in body["estimates"]}
    assert "working_memory" in ids
    assert "episodic_pattern_separation" not in ids


# --- next task: no region names --------------------------------------------------------------


def test_next_task_has_no_region_names(client):
    body = client.get("/v1/tasks/next", params={"user_id": "u1"}).json()
    assert_no_region_names(body)
    assert body["schema_type"] == "n_back" and body["dimension"] == "working_memory"


# --- coach chat: the real coach, or an honest error ------------------------------------------


def test_coach_chat_uses_the_coach_module(client):
    r = client.post("/v1/coach/chat", json={"user_id": "u1", "user_prompt": "How do I focus?"})
    assert r.status_code == 200
    body = r.json()
    assert_no_region_names(body)
    assert body["reply_text"]
    assert "safety_metadata" in body


def test_coach_chat_error_is_503_not_canned_text(client, monkeypatch):
    import ai_coach.agent

    def boom(self, request):
        raise RuntimeError("down")

    monkeypatch.setattr(ai_coach.agent.AICoachAgent, "handle_chat", boom)
    r = client.post("/v1/coach/chat", json={"user_id": "u1", "user_prompt": "hi"})
    assert r.status_code == 503
    assert r.json() == {"detail": "coach not available"}


# --- health check -----------------------------------------------------------------------------


def test_health_check_has_no_region_or_design_system_fields(client):
    body = client.get("/").json()
    assert body["status"] == "OPERATIONAL"
    assert "digital_brain_nodes" not in body and "design_system" not in body
    assert_no_region_names(body)


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
