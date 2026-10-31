"""The /v1 stand-ins answer honestly until their modules ship (BE-00).

The detailed checks are in test_honest_endpoints.py; this file keeps the original per-route smoke tests.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "OPERATIONAL"


def test_v1_tasks_next():
    assert client.get("/v1/tasks/next?user_id=test_user").status_code == 501


def test_v1_dashboard_profile():
    response = client.get("/v1/dashboard/profile?user_id=test_user")
    assert response.status_code == 200
    assert response.json()["status"] == "not_enough_data"


def test_v1_coach_chat():
    payload = {"user_id": "test_user", "user_prompt": "How can I improve my working memory?"}
    assert client.post("/v1/coach/chat", json=payload).status_code == 501


def test_v1_coach_collaboration_score():
    assert client.get("/v1/coach/collaboration-score?user_id=test_user&cluster_id=3").status_code == 501


def test_v1_clustering_evaluate():
    payload = {"user_id": "test_user", "latent_vector": [0.1, 0.2, 0.3]}
    assert client.post("/v1/clustering/evaluate", json=payload).status_code == 501
