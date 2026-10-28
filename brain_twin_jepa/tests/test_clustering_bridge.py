"""Unit tests for BrainTwinClusteringBridge."""

import numpy as np
import pytest

from brain_twin_jepa.clustering_bridge import BrainTwinClusteringBridge
from clustering_engine.evaluator import CognitiveEvaluator


class TestBrainTwinClusteringBridge:
    """Test suite for Brain Twin JEPA clustering bridge."""

    def test_bridge_default_initialization(self):
        bridge = BrainTwinClusteringBridge()
        assert bridge.evaluator is not None
        assert bridge.evaluator.dim == 64

    def test_process_jepa_state(self):
        bridge = BrainTwinClusteringBridge()
        vec = np.zeros(64)
        result = bridge.process_jepa_state("usr_bridge_01", vec)

        assert isinstance(result, dict)
        assert result["user_id"] == "usr_bridge_01"
        assert "active_cluster_id" in result
        assert "cluster_name" in result
        assert "cluster_probabilities" in result
        assert "has_transitioned" in result
        assert "radar_scores" in result
        assert "uncertainty_band" in result
        assert len(result["cluster_probabilities"]) == 9

    def test_custom_evaluator_injection(self):
        custom_evaluator = CognitiveEvaluator(k=4, dimensions=["dim_a", "dim_b"])
        bridge = BrainTwinClusteringBridge(evaluator=custom_evaluator)
        vec = np.zeros(64)
        result = bridge.process_jepa_state("usr_custom_bridge", vec)

        assert len(result["cluster_probabilities"]) == 4
        assert len(result["radar_scores"]) == 2

    def test_reset_user(self):
        bridge = BrainTwinClusteringBridge()
        bridge.process_jepa_state("usr_reset", np.ones(64))
        assert bridge.evaluator.smoother.get_state("usr_reset") is not None

        bridge.reset_user("usr_reset")
        assert bridge.evaluator.smoother.get_state("usr_reset") is None
