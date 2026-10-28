"""Unit and integration tests for dynamic centroids, online adaptation, and runtime K discovery."""

from __future__ import annotations

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from clustering_engine.api_router import get_evaluator, router, set_evaluator
from clustering_engine.evaluator import CognitiveEvaluator
from clustering_engine.gmm_clusterer import SoftGMMClusterer


class TestGMMClustererDynamicCentroids:
    """Test suite for SoftGMMClusterer online adaptation and runtime expansion."""

    def test_online_update_shifts_centroid(self):
        """Centroid should move towards the observation vector proportional to learning rate."""
        clusterer = SoftGMMClusterer(dim=16, k=3, seed=42)
        initial_c1 = clusterer.get_centroid(1).copy()

        # Observation shifted from c1
        target = initial_c1 + 2.0
        # Force responsibility=1.0 on cluster 1 (index 0)
        resps = np.array([1.0, 0.0, 0.0])
        clusterer.update_online(target, lr=0.1, responsibilities=resps)

        updated_c1 = clusterer.get_centroid(1)
        expected_c1 = initial_c1 + 0.1 * (target - initial_c1)
        np.testing.assert_allclose(updated_c1, expected_c1, rtol=1e-5)

        # Other centroids should remain unchanged
        np.testing.assert_array_equal(clusterer.get_centroid(2), clusterer.means[1])
        np.testing.assert_array_equal(clusterer.get_centroid(3), clusterer.means[2])

    def test_add_centroid_expands_k(self):
        """add_centroid should increment K, update priors and codes, and yield valid probabilities."""
        clusterer = SoftGMMClusterer(dim=8, k=3, seed=42)
        assert clusterer.k == 3
        assert list(clusterer.cluster_codes) == ["C1", "C2", "C3"]

        new_vec = np.ones(8) * 5.0
        new_id = clusterer.add_centroid(new_vec, code="C4")

        assert new_id == 4
        assert clusterer.k == 4
        assert list(clusterer.cluster_codes) == ["C1", "C2", "C3", "C4"]
        assert len(clusterer.priors) == 4
        assert pytest.approx(clusterer.priors.sum()) == 1.0
        np.testing.assert_allclose(clusterer.get_centroid(4), new_vec)

        # Predicting probabilities on new centroid should yield maximum on cluster 4
        probs = clusterer.predict_proba(new_vec)
        assert len(probs) == 4
        assert pytest.approx(probs.sum()) == 1.0
        assert np.argmax(probs) == 3  # 0-indexed cluster 4

    def test_discover_optimal_k_from_clusters(self):
        """discover_optimal_k should identify true cluster count from separated Gaussian components."""
        rng = np.random.default_rng(123)
        # 3 distinct clusters in 10-dimensional space
        c1 = rng.normal(loc=-4.0, scale=0.3, size=(50, 10))
        c2 = rng.normal(loc=0.0, scale=0.3, size=(50, 10))
        c3 = rng.normal(loc=4.0, scale=0.3, size=(50, 10))
        X = np.vstack([c1, c2, c3])

        clusterer = SoftGMMClusterer(dim=10, k=2, seed=42)
        best_k = clusterer.discover_optimal_k(X=X, k_min=2, k_max=5)

        assert best_k == 3
        assert clusterer.k == 3
        assert len(clusterer.means) == 3


class TestEvaluatorDynamicCentroids:
    """Test suite for CognitiveEvaluator online centroid adaptation and novelty spawning."""

    def test_online_adaptation_in_evaluate(self):
        """When adaptive_centroids=True, centroids dynamically adjust with incoming stream."""
        evaluator = CognitiveEvaluator(
            dim=16,
            k=3,
            adaptive_centroids=True,
            centroid_lr=0.05,
        )
        c1_initial = evaluator.clusterer.get_centroid(1).copy()
        target = c1_initial + 1.0

        # Evaluate repeatedly with vector near c1
        for _ in range(5):
            evaluator.evaluate("user_stream", target)

        c1_updated = evaluator.clusterer.get_centroid(1)
        # Centroid 1 should have moved towards target
        assert np.linalg.norm(c1_updated - target) < np.linalg.norm(c1_initial - target)

    def test_novelty_threshold_spawns_new_centroid(self):
        """Observations with max responsibility < novelty_threshold should dynamically spawn a centroid."""
        evaluator = CognitiveEvaluator(
            dim=16,
            k=3,
            novelty_threshold=0.01,
            adaptive_centroids=False,
        )
        assert evaluator.k == 3

        # Create an outlier vector far outside existing centroid space
        outlier = np.ones(16) * 50.0

        # First evaluation with outlier triggers dynamic centroid spawn
        res = evaluator.evaluate("user_novelty", outlier)
        assert evaluator.k == 4
        assert len(res.cluster_probabilities) == 4
        assert "C4" in res.cluster_probabilities
        # The new centroid is placed right at the outlier, so subsequent responsibility is high
        assert res.cluster_probabilities["C4"] > 0.5

    def test_add_dynamic_centroid_api(self):
        """add_dynamic_centroid should expand archetype registry and preserve radar scoring."""
        evaluator = CognitiveEvaluator(dim=16, k=3)
        new_vec = np.ones(16) * 3.5

        new_id = evaluator.add_dynamic_centroid(
            centroid=new_vec,
            name="Pioneering Navigator",
            proficiency_tier="Advanced",
            description="Exploratory state with high adaptability.",
        )
        assert new_id == 4
        assert evaluator.k == 4
        archetype = evaluator.archetype_registry.get_archetype(4)
        assert archetype.name == "Pioneering Navigator"
        assert archetype.proficiency_tier == "Advanced"

        # Evaluate near new centroid
        res = evaluator.evaluate("user_custom", new_vec)
        assert "C4" in res.cluster_probabilities
        assert len(res.radar_scores) == 5


class TestFastAPIDynamicCentroidEndpoints:
    """Test suite for FastAPI dynamic centroid REST endpoints."""

    @pytest.fixture
    def client(self) -> TestClient:
        test_evaluator = CognitiveEvaluator(dim=16, k=3)
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_evaluator] = lambda: test_evaluator
        test_client = TestClient(app)
        yield test_client
        app.dependency_overrides.clear()

    def test_get_centroids_endpoint(self, client: TestClient):
        response = client.get("/v1/clustering/centroids")
        assert response.status_code == 200
        data = response.json()
        assert data["k"] == 3
        assert len(data["cluster_codes"]) == 3
        assert "C1" in data["centroids"]
        assert len(data["centroids"]["C1"]) == 16
        assert "C1" in data["archetypes"]

    def test_spawn_centroid_endpoint(self, client: TestClient):
        payload = {
            "centroid": [1.0] * 16,
            "name": "Adaptive Vanguard",
            "proficiency_tier": "Strategic",
            "pacing_strategy": "Iterative",
            "description": "High initiative exploratory cognitive archetype.",
        }
        response = client.post("/v1/clustering/centroids/spawn", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["cluster_id"] == 4
        assert data["cluster_code"] == "C4"
        assert data["name"] == "Adaptive Vanguard"
        assert data["total_k"] == 4

        # Verify status endpoint reflects updated K
        get_res = client.get("/v1/clustering/centroids")
        assert get_res.json()["k"] == 4

    def test_spawn_centroid_invalid_dim_returns_422(self, client: TestClient):
        payload = {"centroid": [1.0] * 8}  # Expected 16
        response = client.post("/v1/clustering/centroids/spawn", json=payload)
        assert response.status_code == 422

    def test_adapt_configuration_endpoint(self, client: TestClient):
        payload = {
            "adaptive_centroids": True,
            "centroid_lr": 0.08,
            "novelty_threshold": 0.05,
        }
        response = client.post("/v1/clustering/centroids/adapt", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["adaptive_centroids"] is True
        assert data["centroid_lr"] == 0.08
        assert data["novelty_threshold"] == 0.05

    def test_discover_k_endpoint(self, client: TestClient):
        rng = np.random.default_rng(999)
        # Create 2 separated clusters
        c1 = rng.normal(loc=-2.0, scale=0.2, size=(25, 16))
        c2 = rng.normal(loc=2.0, scale=0.2, size=(25, 16))
        samples = np.vstack([c1, c2]).tolist()

        payload = {
            "samples": samples,
            "k_min": 2,
            "k_max": 4,
        }
        response = client.post("/v1/clustering/centroids/discover", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "discovered_k" in data
        assert data["discovered_k"] >= 2
        assert len(data["cluster_codes"]) == data["discovered_k"]
