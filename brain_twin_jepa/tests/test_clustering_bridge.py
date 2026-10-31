"""Unit tests for BrainTwinClusteringBridge."""

import numpy as np
import pytest

from brain_twin_jepa.clustering_bridge import BrainTwinClusteringBridge
from clustering_engine.evaluator import CognitiveEvaluator


class TestBrainTwinClusteringBridge:
    """Test suite for Brain Twin SAT-JEPA clustering bridge."""

    def test_bridge_default_initialization(self):
        bridge = BrainTwinClusteringBridge()
        assert bridge.evaluator is not None
        assert bridge.model is not None
        assert bridge.evaluator.dim == 64

    def test_process_jepa_state_backward_compatibility(self):
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

    def test_process_telemetry_event(self):
        bridge = BrainTwinClusteringBridge()
        event = {
            "dimension": "working_memory",
            "score_norm": 0.88,
            "response_time_ms": 1100.0,
            "error_flag": False,
            "error_burst": 0,
            "hesitation_jitter": 22.0,
            "trial_index": 1,
        }

        result = bridge.process_telemetry("usr_telemetry_01", event)

        assert isinstance(result, dict)
        assert result["user_id"] == "usr_telemetry_01"
        assert "active_cluster_id" in result
        assert "latent_state" in result
        assert len(result["latent_state"]) == 64
        assert result["input_dimension"] == "working_memory"
        assert "radar_scores" in result
        assert "cluster_probabilities" in result

    def test_predict_trajectory(self):
        bridge = BrainTwinClusteringBridge()
        events = [
            {"dimension": "pattern_induction", "score_norm": 0.9, "response_time_ms": 850.0},
            {"dimension": "pattern_induction", "score_norm": 0.95, "response_time_ms": 800.0},
        ]

        for e in events:
            bridge.process_telemetry("usr_traj", e)

        trajectory_payload = bridge.predict_trajectory("usr_traj", horizon=5)

        assert trajectory_payload["user_id"] == "usr_traj"
        assert trajectory_payload["forecast_horizon"] == 5
        assert len(trajectory_payload["steps"]) == 5

        for step in trajectory_payload["steps"]:
            assert "step_offset" in step
            assert "predicted_cluster_id" in step
            assert "cluster_name" in step
            assert "predicted_radar_scores" in step
            assert "uncertainty_sigma" in step
            assert "latent_vector" in step
            assert len(step["latent_vector"]) == 64
            assert step["uncertainty_sigma"] > 0.0

    def test_custom_evaluator_injection(self):
        custom_evaluator = CognitiveEvaluator(k=4, dimensions=["dim_a", "dim_b"])
        bridge = BrainTwinClusteringBridge(evaluator=custom_evaluator)
        vec = np.zeros(64)
        result = bridge.process_jepa_state("usr_custom_bridge", vec)

        assert len(result["cluster_probabilities"]) == 4
        assert len(result["radar_scores"]) == 2

    def test_reset_user(self):
        bridge = BrainTwinClusteringBridge()
        event = {"dimension": "executive_function", "score_norm": 0.8, "response_time_ms": 1000.0}
        bridge.process_telemetry("usr_reset", event)

        assert bridge.evaluator.smoother.get_state("usr_reset") is not None
        assert bridge.model.get_user_state("usr_reset") is not None

        bridge.reset_user("usr_reset")

        assert bridge.evaluator.smoother.get_state("usr_reset") is None
        assert bridge.model.get_user_state("usr_reset") is None
