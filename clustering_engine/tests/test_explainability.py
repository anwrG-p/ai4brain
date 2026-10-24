"""Unit tests for Centroid Prototype Explainability Decoder (XAI)."""

import numpy as np
import pytest

from clustering_engine.archetypes import COGNITIVE_DIMENSIONS
from clustering_engine.explainability import (
    ExplainabilityDecoder,
    FORBIDDEN_CLINICAL_REGEX,
    validate_non_clinical,
)
from clustering_engine.gmm_clusterer import SoftGMMClusterer


class TestExplainabilityDecoder:
    """Test suite for centroid prototype projection and XAI explanations."""

    @pytest.fixture
    def clusterer(self) -> SoftGMMClusterer:
        return SoftGMMClusterer(dim=64)

    @pytest.fixture
    def decoder(self, clusterer: SoftGMMClusterer) -> ExplainabilityDecoder:
        return ExplainabilityDecoder(dim=64, centroids=clusterer.get_all_centroids())

    def test_w_eval_shape_and_dimensions(self, decoder: ExplainabilityDecoder):
        assert decoder.w_eval.shape == (5, 64)
        assert len(decoder.dimensions) == 5
        assert set(decoder.dimensions) == {
            "working_memory",
            "pattern_processing",
            "processing_speed",
            "spatial_reasoning",
            "verification_rigor",
        }

    def test_delta_vector_computation(
        self, decoder: ExplainabilityDecoder, clusterer: SoftGMMClusterer
    ):
        """Verify Delta c = W_eval * (mu_target - mu_curr) produces 5 cognitive deltas."""
        centroids = clusterer.get_all_centroids()
        delta = decoder.compute_delta_vector(
            from_cluster_id=1,
            to_cluster_id=4,
            centroids=centroids,
        )

        assert len(delta) == 5
        for dim in COGNITIVE_DIMENSIONS:
            assert dim in delta
            assert isinstance(delta[dim], float)

    def test_dominant_driver_selection(self, decoder: ExplainabilityDecoder):
        """Driver must correspond to argmax_j |Delta c_j|."""
        sample_delta = {
            "working_memory": 0.14,
            "pattern_processing": 0.35,
            "processing_speed": -0.22,
            "spatial_reasoning": 0.05,
            "verification_rigor": -0.08,
        }
        dominant_driver, val = decoder.identify_dominant_driver(sample_delta)
        assert dominant_driver == "pattern_processing"
        assert val == 0.35

        negative_dominant = {
            "working_memory": 0.10,
            "pattern_processing": 0.15,
            "processing_speed": -0.45,
            "spatial_reasoning": 0.05,
            "verification_rigor": -0.08,
        }
        dominant_driver2, val2 = decoder.identify_dominant_driver(negative_dominant)
        assert dominant_driver2 == "processing_speed"
        assert val2 == -0.45

    def test_non_clinical_safety_guardrails(
        self, decoder: ExplainabilityDecoder, clusterer: SoftGMMClusterer
    ):
        """All generated explanations must contain zero clinical or diagnostic terms."""
        centroids = clusterer.get_all_centroids()

        # Test transitions across archetype pairs
        for src in range(1, 10):
            for tgt in range(1, 10):
                if src == tgt:
                    continue
                delta = decoder.compute_delta_vector(src, tgt, centroids)
                driver, _ = decoder.identify_dominant_driver(delta)
                explanation = decoder.generate_explanation(tgt, delta, driver)

                assert isinstance(explanation, str)
                assert len(explanation) > 10
                # Must pass strict guardrail check without raising
                validate_non_clinical(explanation)
                assert FORBIDDEN_CLINICAL_REGEX.search(explanation) is None

    def test_guardrail_validator_rejects_forbidden_words(self):
        """Validator must raise ValueError on clinical or diagnostic tokens."""
        forbidden_samples = [
            "User shows signs of ADHD in working memory.",
            "Detected cognitive impairment during testing.",
            "Significant deficit observed in response speed.",
            "Pathology detected in executive function.",
            "Clinical diagnosis indicates dysfunction.",
        ]
        for sample in forbidden_samples:
            with pytest.raises(ValueError, match="Safety guardrail violation"):
                validate_non_clinical(sample)

    def test_radar_scores_bounds(self, decoder: ExplainabilityDecoder):
        """Radar scores must be scaled within 0 to 100."""
        s_bar = np.random.RandomState(42).randn(64)
        scores = decoder.compute_radar_scores(s_bar)
        assert len(scores) == 5
        for dim, score in scores.items():
            assert 0.0 <= score <= 100.0

    def test_uncertainty_band_entropy_scaling(self, decoder: ExplainabilityDecoder):
        """Concentrated responsibilities should have lower uncertainty than uniform ones."""
        certain = {"C1": 0.98, "C2": 0.01, "C3": 0.01}
        diffuse = {f"C{i}": 1.0 / 9 for i in range(1, 10)}

        u_certain = decoder.compute_uncertainty_band(certain)
        u_diffuse = decoder.compute_uncertainty_band(diffuse)

        assert u_certain < u_diffuse
        assert u_certain >= 3.0
        assert u_diffuse <= 12.0
