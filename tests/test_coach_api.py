"""API and integration tests for Member 2 FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient
from ai_coach.api import app

client = TestClient(app)


def test_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "member2-ai-coach"}


def test_post_coach_chat_endpoint():
    payload = {
        "user_id": "test_user_001",
        "message": "Why did my task get faster?",
        "active_cluster_id": 3,
        "delta_vector": {"working_memory": 0.20},
    }
    res = client.post("/v1/coach/chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "reply_text" in data
    assert "working memory" in data["xai_explanation"].lower()
    assert data["safety_metadata"]["is_safe"] is True
    assert "collab_score_snapshot" in data


def test_get_collaboration_score_endpoint():
    res = client.get("/v1/coach/collaboration-score?user_id=test_user_001&cluster_id=4")
    assert res.status_code == 200
    data = res.json()
    assert "composite_score" in data
    assert data["archetype_id"] == 4
    assert data["archetype_tier"] == "practitioner"
    assert "clarification" in data["dimension_scores"]
    assert "autonomy" in data["dimension_weights"]


def test_state_event_ingestion_and_chat_context():
    # 1. Member 3 emits state event
    event = {
        "user_id": "state_user_999",
        "transition_occurred": True,
        "active_cluster_id": 7,
        "delta_vector": {"spatial_orientation": 0.25},
        "uncertainty": 0.05,
    }
    event_res = client.post("/v1/coach/state-event", json=event)
    assert event_res.status_code == 202
    assert event_res.json()["status"] == "ingested"

    # 2. User chats without providing delta_vector explicitly - should fetch cached event
    chat_res = client.post(
        "/v1/coach/chat",
        json={"user_id": "state_user_999", "message": "What should I work on today?"},
    )
    assert chat_res.status_code == 200
    chat_data = chat_res.json()
    assert "spatial orientation" in chat_data["xai_explanation"].lower()


def test_verify_safety_endpoint():
    unsafe_text = "This patient has severe cognitive impairment and ADHD deficit."
    res = client.post("/v1/coach/verify-safety", json={"text": unsafe_text})
    assert res.status_code == 200
    data = res.json()
    assert data["is_safe"] is False
    assert "patient" not in data["sanitized_text"].lower()
    assert "learner" in data["sanitized_text"].lower()


def test_learning_path_endpoint():
    res = client.get("/v1/coach/learning-path/user_learning_123?cluster_id=1")
    assert res.status_code == 200
    data = res.json()
    assert data["archetype_tier"] == "explorer"
    assert len(data["modules"]) >= 3
