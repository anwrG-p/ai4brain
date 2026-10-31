"""Unit and integration tests for dynamic user-generated archetypes (zero default archetypes)."""

import numpy as np
import pytest

from brain_twin_jepa.clustering_bridge import BrainTwinClusteringBridge
from brain_twin_jepa.sat_jepa import SATJEPAModel
from clustering_engine.evaluator import CognitiveEvaluator
from clustering_engine.gmm_clusterer import SoftGMMClusterer


class TestZeroArchetypeBootstrap:
    """Tests verifying no fixed archetypes by default and purely user-generated archetypes."""

    def test_evaluator_starts_with_zero_archetypes(self):
        evaluator = CognitiveEvaluator(k=0, novelty_threshold=0.1)
        assert evaluator.k == 0
        assert len(evaluator.archetype_registry) == 0
        assert len(evaluator.clusterer.centroids) == 0

        # User 1 arrives with continuous latent vector
        v1 = np.ones(64) * 0.5
        res1 = evaluator.evaluate("user_01", v1)

        # Dynamic archetype 1 is generated from user
        assert evaluator.k == 1
        assert len(evaluator.archetype_registry) == 1
        assert res1.active_cluster_id == 1
        assert "C1" in res1.cluster_probabilities
        assert res1.cluster_probabilities["C1"] == 1.0

        # User 2 arrives with a distant cognitive state (triggers novelty spawn)
        v2 = np.ones(64) * -5.0
        res2 = evaluator.evaluate("user_02", v2)

        # Dynamic archetype 2 is generated from user
        assert evaluator.k == 2
        assert len(evaluator.archetype_registry) == 2
        assert "C2" in res2.cluster_probabilities
        assert res2.cluster_probabilities["C2"] > 0.8

    def test_bridge_with_zero_archetype_default(self):
        # Bridge configured with zero default archetypes
        evaluator = CognitiveEvaluator(k=0, novelty_threshold=0.1)
        model = SATJEPAModel()
        bridge = BrainTwinClusteringBridge(model=model, evaluator=evaluator)

        assert bridge.evaluator.k == 0

        # Stream Member 1 telemetry events
        event1 = {
            "dimension": "working_memory",
            "score_norm": 0.95,
            "response_time_ms": 750.0,
            "error_flag": False,
            "error_burst": 0,
            "hesitation_jitter": 15.0,
            "trial_index": 0,
        }
        out1 = bridge.process_telemetry("usr_learner_1", event1)

        # Archetype is dynamically generated from user telemetry
        assert bridge.evaluator.k == 1
        assert out1["active_cluster_id"] == 1
        assert "C1" in out1["cluster_probabilities"]
        assert len(out1["latent_state"]) == 64

        # Forecast forward trajectory based on the dynamically formed cluster
        forecast = bridge.predict_trajectory("usr_learner_1", horizon=3)
        assert forecast["forecast_horizon"] == 3
        assert len(forecast["steps"]) == 3
        for step in forecast["steps"]:
            assert step["predicted_cluster_id"] == 1
            assert step["uncertainty_sigma"] > 0.0

    def test_sat_jepa_anchors_to_user_centroids_after_discovery(self):
        model = SATJEPAModel()
        # Simulate 2 user-generated centroids from a cohort
        discovered_centroids = np.random.default_rng(42).normal(0.0, 1.0, (2, 64)).astype(np.float32)

        # Dynamic anchoring to the cohort centroids
        model.anchor_to_user_centroids(discovered_centroids)

        weights = model.context_encoder.get_weights()
        assert np.all(np.isfinite(weights["w_proj"]))
