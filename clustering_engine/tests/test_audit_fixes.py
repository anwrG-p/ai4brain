"""Unit tests verifying all audit findings and bug fixes."""

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from clustering_engine.api_router import get_evaluator, router, set_evaluator
from clustering_engine.archetypes import ARCHETYPES, ArchetypeRegistry
from clustering_engine.evaluator import CognitiveEvaluator
from clustering_engine.explainability import ExplainabilityDecoder, validate_non_clinical
from clustering_engine.gmm_clusterer import SoftGMMClusterer
from clustering_engine.hysteresis_gate import SchmittTriggerHysteresisGate
from clustering_engine.temporal_smoother import LeakyIntegrator


class TestAuditFixes:
    """Comprehensive regression tests for audit findings."""

    def test_nan_and_inf_rejected_by_smoother(self):
        """Input vectors containing NaN or Inf must be rejected and not corrupt user state."""
        smoother = LeakyIntegrator(eta=0.12, expected_dim=64)
        smoother.smooth("u1", np.ones(64))

        bad_nan = np.full(64, np.nan)
        with pytest.raises(ValueError, match="Input vector must contain only finite numbers"):
            smoother.smooth("u1", bad_nan)

        bad_inf = np.full(64, np.inf)
        with pytest.raises(ValueError, match="Input vector must contain only finite numbers"):
            smoother.smooth("u1", bad_inf)

        # Confirm user state remains clean (finite) and usable
        clean_state = smoother.get_state("u1")
        assert clean_state is not None
        assert np.all(np.isfinite(clean_state))

        # Subsequent smooth succeeds cleanly
        smoothed = smoother.smooth("u1", np.ones(64) * 2.0)
        assert np.all(np.isfinite(smoothed))

    def test_smoother_max_sessions_lru_eviction(self):
        """Sessions exceeding max_sessions are evicted in LRU order."""
        smoother = LeakyIntegrator(expected_dim=64, max_sessions=3)
        for i in range(5):
            smoother.smooth(f"u{i}", np.ones(64))

        assert len(smoother._states) == 3
        # u0 and u1 should have been evicted
        assert smoother.get_state("u0") is None
        assert smoother.get_state("u1") is None
        # u2, u3, u4 should remain
        assert smoother.get_state("u2") is not None
        assert smoother.get_state("u3") is not None
        assert smoother.get_state("u4") is not None

    def test_hysteresis_gate_max_sessions_lru_eviction(self):
        """Hysteresis gate evicts oldest user sessions when max_sessions is exceeded."""
        gate = SchmittTriggerHysteresisGate(max_sessions=3)
        for i in range(5):
            gate.process(f"u{i}", {1: 0.8, 2: 0.2})

        assert len(gate._user_states) == 3
        assert "u0" not in gate._user_states
        assert "u1" not in gate._user_states
        assert "u4" in gate._user_states

    def test_set_active_cluster_dynamic_k(self):
        """set_active_cluster must allow K > 9 when dynamic clusters are used."""
        gate = SchmittTriggerHysteresisGate()
        gate.set_active_cluster("u_dynamic", 12)
        assert gate.get_active_cluster("u_dynamic") == 12

        gate.set_active_cluster("u_dynamic", 15)
        assert gate.get_active_cluster("u_dynamic") == 15

        with pytest.raises(ValueError, match="Cluster id must be >= 1"):
            gate.set_active_cluster("u_dynamic", 0)

    def test_robust_cluster_parsing_in_hysteresis(self):
        """Gate accepts keys like 'c1', '1', 'arch_4', etc."""
        gate = SchmittTriggerHysteresisGate()
        d1 = gate.process("u1", {"c1": 0.2, "c4": 0.8})
        assert d1.active_cluster_id == 4

        d2 = gate.process("u2", {"arch_2": 0.3, "arch_5": 0.7})
        assert d2.active_cluster_id == 5

    def test_robust_cluster_parsing_in_radar_and_archetypes(self):
        """Radar score computation and archetype loading handle lowercase and custom keys."""
        dec = ExplainabilityDecoder()
        scores = dec.compute_radar_scores(
            np.zeros(64), responsibilities={"c1": 0.6, "c2": 0.4}
        )
        assert len(scores) == 5
        assert all(0.0 <= v <= 100.0 for v in scores.values())

        # Archetype load from dict with lowercase keys
        data = {
            "c1": {"name": "Test Arch 1", "proficiency_tier": "Developing"},
            "arch_2": {"name": "Test Arch 2", "proficiency_tier": "Operational"},
        }
        reg = ArchetypeRegistry.load_from_dict(data)
        assert len(reg) == 2
        assert reg.get(1).name == "Test Arch 1"
        assert reg.get(2).name == "Test Arch 2"

    def test_direct_radar_projection_scale_calibrated(self):
        """Direct projection without responsibilities should be scaled 0-100 without 50% compression."""
        cl = SoftGMMClusterer()
        dec = ExplainabilityDecoder(centroids=cl.get_all_centroids())

        c9 = cl.get_centroid(9)
        scores_resp = dec.compute_radar_scores(c9, responsibilities={"C9": 1.0})
        scores_direct = dec.compute_radar_scores(c9, responsibilities=None)

        # For centroid 9, target working_memory is 92.0
        # Direct projection should be within ~2 points of 92.0, not compressed to 81.0
        assert scores_resp["working_memory"] == 92.0
        assert abs(scores_direct["working_memory"] - 92.0) <= 2.0

    def test_zero_delta_explanation_does_not_fabricate_increase(self):
        """When delta is 0.0, explanation must not claim a 12% increase."""
        dec = ExplainabilityDecoder()
        exp = dec.generate_explanation(
            to_cluster_id=1,
            delta_vector={"working_memory": 0.0},
            dominant_driver="working_memory",
        )
        assert "12%" not in exp
        assert "increase" not in exp
        assert "balanced working memory stability" in exp
        validate_non_clinical(exp)

    def test_router_dependency_injection(self):
        """FastAPI router should allow overriding the evaluator via set_evaluator or Depends."""
        custom_evaluator = CognitiveEvaluator(k=4, dimensions=["dim_x", "dim_y"])
        app = FastAPI()
        app.include_router(router)
        client = TestClient(app)

        # Test dependency override
        app.dependency_overrides[get_evaluator] = lambda: custom_evaluator
        resp = client.post(
            "/v1/clustering/evaluate",
            json={"user_id": "u_override", "latent_vector": [0.0] * 64},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["cluster_probabilities"]) == 4
        assert len(body["radar_scores"]) == 2

        # Clean up override
        app.dependency_overrides.clear()
