"""End-to-End API Integration Test Suite."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OPERATIONAL"
    assert "EZ-Diffusion-DDM" in data["psychometrics"]


def test_full_session_lifecycle():
    user_id = "usr_integration_test_1"

    # 1. Initialize Session
    init_res = client.post("/api/session/init", json={"user_id": user_id})
    assert init_res.status_code == 200
    init_data = init_res.json()

    session_id = init_data["session_id"]
    task_config = init_data["task_config"]
    assert "trials" in task_config
    assert len(task_config["trials"]) > 0

    # 2. Simulate User Trial Responses
    simulated_trials = []
    for t in task_config["trials"]:
        is_correct = True
        simulated_trials.append({
            "trial_index": t["trial_index"],
            "stimulus_id": t["stimulus_id"],
            "stimulus_features": {
                "spatial_pos": t["stimulus_display"].get("spatial_pos", 0),
                "is_lure": t["is_lure"],
                "lure_offset": -1 if t.get("lure_type") == "N-1" else None,
                "relation_type": t["stimulus_display"].get("relation_query"),
                "node_depth": t["stimulus_display"].get("transitive_distance"),
                "rule_switched": False,
            },
            "target_present": t["target_present"],
            "user_response": t["target_present"],
            "is_correct": is_correct,
            "reaction_time_ms": 420.5,
            "non_decision_time_est_ms": 140.0,
            "device_telemetry": {"input_type": "keyboard", "frame_drops": 0},
        })

    ingest_payload = {
        "session_id": session_id,
        "user_id": user_id,
        "task_type": task_config["task_type"],
        "task_version": "1.0.0",
        "trials": simulated_trials,
    }

    # 3. Ingest Telemetry
    telemetry_res = client.post("/api/telemetry/ingest", json=ingest_payload)
    assert telemetry_res.status_code == 200
    eval_data = telemetry_res.json()

    assert "session_metrics" in eval_data
    assert "digital_brain_delta" in eval_data
    assert eval_data["session_metrics"]["ddm_drift_rate_v"] > 0
    assert eval_data["session_metrics"]["t_score"] > 50

    # 4. Check Digital Brain State
    brain_res = client.get(f"/api/brain/state/{user_id}")
    assert brain_res.status_code == 200
    brain_data = brain_res.json()
    assert brain_data["session_count"] == 1
    assert "dlPFC" in brain_data["nodes"]

    # 5. Coaching Reflection
    coach_res = client.post("/api/coach/reflection", json={
        "evaluation": eval_data,
        "affective_state": "FLOW",
    })
    assert coach_res.status_code == 200
    coach_data = coach_res.json()
    assert "coaching_reflection" in coach_data
    assert coach_data["guardrails_verified"] is True
