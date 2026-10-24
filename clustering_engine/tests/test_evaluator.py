"""End-to-end integration tests for CognitiveEvaluator and API router."""

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from clustering_engine.api_router import router
from clustering_engine.evaluator import CognitiveEvaluator, EvaluationResult


class TestCognitiveEvaluatorPipeline:
    """Test suite verifying end-to-end contract compliance and pipeline flow."""

    @pytest.fixture
    def evaluator(self) -> CognitiveEvaluator:
        return CognitiveEvaluator(dim=64, eta=0.12, delta_hyst=0.15, n_confirm=3)

    def test_schema_contract_conformance(self, evaluator: CognitiveEvaluator):
        """Verify the evaluation dictionary matches the exact target schema required."""
        vec = evaluator.clusterer.get_centroid(4)
        result: EvaluationResult = evaluator.evaluate("usr_test_01", vec)
        data = result.to_dict()

        # Required top-level keys
        expected_keys = {
            "user_id",
            "active_cluster_id",
            "cluster_name",
            "cluster_probabilities",
            "has_transitioned",
            "transition_event",
            "radar_scores",
            "uncertainty_band",
        }
        assert set(data.keys()) == expected_keys

        assert data["user_id"] == "usr_test_01"
        assert isinstance(data["active_cluster_id"], int)
        assert isinstance(data["cluster_name"], str)
        assert isinstance(data["cluster_probabilities"], dict)
        assert len(data["cluster_probabilities"]) == 9
        for i in range(1, 10):
            assert f"C{i}" in data["cluster_probabilities"]

        assert isinstance(data["has_transitioned"], bool)
        assert isinstance(data["radar_scores"], dict)
        assert len(data["radar_scores"]) == 5
        assert isinstance(data["uncertainty_band"], float)

    def test_transition_event_structure_on_cluster_jump(self):
        """When a transition triggers, transition_event must contain exact required fields."""
        # Use eta=1.0 to isolate and test the exact 3-frame dwell gate in the pipeline
        evaluator = CognitiveEvaluator(dim=64, eta=1.0, delta_hyst=0.15, n_confirm=3)

        # Initialize at cluster 1
        c1 = evaluator.clusterer.get_centroid(1)
        evaluator.evaluate("usr_transition_test", c1)

        # Feed cluster 4 for 3 consecutive frames
        c4 = evaluator.clusterer.get_centroid(4)
        evaluator.evaluate("usr_transition_test", c4)  # Frame 1
        evaluator.evaluate("usr_transition_test", c4)  # Frame 2
        res3 = evaluator.evaluate("usr_transition_test", c4)  # Frame 3 -> Jump!

        data = res3.to_dict()
        assert data["has_transitioned"] is True
        assert data["active_cluster_id"] == 4
        assert data["cluster_name"] == "Agile Sprinter"

        event = data["transition_event"]
        assert event is not None
        assert event["from_cluster"] == 1
        assert event["to_cluster"] == 4
        assert isinstance(event["confidence_margin"], float)
        assert isinstance(event["delta_vector"], dict)
        assert len(event["delta_vector"]) == 5
        assert isinstance(event["dominant_driver"], str)
        assert isinstance(event["xai_explanation"], str)
        assert "Agile Sprinter" in event["xai_explanation"]

    def test_continuous_trajectory_with_leaky_smoother(self, evaluator: CognitiveEvaluator):
        """Test continuous state stream with default eta=0.12 eventually transitions when sustained."""
        c1 = evaluator.clusterer.get_centroid(1)
        c4 = evaluator.clusterer.get_centroid(4)

        evaluator.evaluate("usr_stream", c1)
        transitioned = False
        for _ in range(15):
            res = evaluator.evaluate("usr_stream", c4)
            if res.has_transitioned:
                transitioned = True
                assert res.active_cluster_id == 4
                assert res.transition_event is not None
                break
        assert transitioned is True

    def test_no_transition_event_when_has_transitioned_false(self, evaluator: CognitiveEvaluator):
        """When has_transitioned is false, transition_event must be None."""
        c1 = evaluator.clusterer.get_centroid(1)
        res = evaluator.evaluate("usr_steady", c1)
        data = res.to_dict()
        assert data["has_transitioned"] is False
        assert data["transition_event"] is None

    def test_temporal_smoothing_dampens_noise(self, evaluator: CognitiveEvaluator):
        """Leaky integrator should prevent sudden jump on a single anomalous frame."""
        c1 = evaluator.clusterer.get_centroid(1)
        evaluator.evaluate("usr_smooth", c1)

        # Single burst toward C9
        c9 = evaluator.clusterer.get_centroid(9)
        res = evaluator.evaluate("usr_smooth", c9)

        # Because of leaky integrator (eta=0.12), state is still mostly C1
        assert res.active_cluster_id == 1
        assert res.has_transitioned is False


class TestFastAPIRouter:
    """Test suite for FastAPI routing endpoints."""

    @pytest.fixture
    def client(self) -> TestClient:
        app = FastAPI()
        app.include_router(router)
        return TestClient(app)

    def test_evaluate_endpoint(self, client: TestClient):
        payload = {
            "user_id": "usr_api_01",
            "latent_vector": [0.1] * 64,
        }
        response = client.post("/v1/clustering/evaluate", json=payload)
        assert response.status_code == 200
        body = response.json()
        assert body["user_id"] == "usr_api_01"
        assert "cluster_probabilities" in body
        assert len(body["cluster_probabilities"]) == 9

    def test_evaluate_invalid_dim_returns_422(self, client: TestClient):
        payload = {
            "user_id": "usr_api_bad",
            "latent_vector": [0.1] * 32,
        }
        response = client.post("/v1/clustering/evaluate", json=payload)
        assert response.status_code == 422

    def test_reset_user_endpoint(self, client: TestClient):
        response = client.post("/v1/clustering/reset/usr_api_01")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
