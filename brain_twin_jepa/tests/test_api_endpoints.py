"""Unit tests for Brain Twin SAT-JEPA FastAPI endpoints."""

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from clustering_engine.api_router import brain_twin_router, router


@pytest.fixture
def client() -> TestClient:
    app = FastAPI(title="AI4Brain Cognitive Services")
    app.include_router(router)
    app.include_router(brain_twin_router)
    return TestClient(app)


class TestBrainTwinAPIEndpoints:
    """Test suite for /v1/brain-twin HTTP endpoints."""

    def test_post_telemetry_step_success(self, client: TestClient):
        payload = {
            "user_id": "api_usr_01",
            "dimension": "working_memory",
            "score_norm": 0.85,
            "response_time_ms": 1200.0,
            "error_flag": False,
            "error_burst": 0,
            "hesitation_jitter": 25.0,
            "trial_index": 1,
        }

        resp = client.post("/v1/brain-twin/step", json=payload)
        assert resp.status_code == 200

        data = resp.json()
        assert data["user_id"] == "api_usr_01"
        assert "active_cluster_id" in data
        assert "cluster_name" in data
        assert "radar_scores" in data
        assert "latent_state" in data
        assert len(data["latent_state"]) == 64
        assert data["input_dimension"] == "working_memory"

    def test_post_telemetry_step_invalid_dimension(self, client: TestClient):
        payload = {
            "user_id": "api_usr_err",
            "dimension": "nonexistent_dimension",
            "score_norm": 0.5,
            "response_time_ms": 1000.0,
        }
        resp = client.post("/v1/brain-twin/step", json=payload)
        assert resp.status_code == 422

    def test_get_trajectory_forecast_success(self, client: TestClient):
        # Ingest a step first so user is observed
        payload = {
            "user_id": "api_usr_forecast",
            "dimension": "pattern_induction",
            "score_norm": 0.92,
            "response_time_ms": 900.0,
            "trial_index": 2,
        }
        client.post("/v1/brain-twin/step", json=payload)

        # Request trajectory forecast
        resp = client.get("/v1/brain-twin/forecast/api_usr_forecast?horizon=4")
        assert resp.status_code == 200

        data = resp.json()
        assert data["user_id"] == "api_usr_forecast"
        assert data["forecast_horizon"] == 4
        assert len(data["steps"]) == 4

        for step in data["steps"]:
            assert "predicted_cluster_id" in step
            assert "cluster_name" in step
            assert "predicted_radar_scores" in step
            assert "uncertainty_sigma" in step
            assert step["uncertainty_sigma"] > 0.0

    def test_get_trajectory_forecast_unobserved_user_returns_404(self, client: TestClient):
        resp = client.get("/v1/brain-twin/forecast/nonexistent_user_999")
        assert resp.status_code == 404

    def test_reset_user_endpoint(self, client: TestClient):
        resp = client.post("/v1/brain-twin/reset/api_usr_reset")
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_id"] == "api_usr_reset"
        assert data["status"] == "reset_successful"
