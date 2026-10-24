"""Unit tests for Soft GMM Clusterer."""

import math
from pathlib import Path
import numpy as np
import pytest

from clustering_engine.archetypes import ARCHETYPES
from clustering_engine.gmm_clusterer import SoftGMMClusterer
from clustering_engine.temporal_smoother import LeakyIntegrator


class TestSoftGMMClusterer:
    """Test suite for Soft GMM responsibilities and boundary stability."""

    @pytest.fixture
    def clusterer(self) -> SoftGMMClusterer:
        return SoftGMMClusterer(dim=64)

    def test_archetypes_count_and_keys(self, clusterer: SoftGMMClusterer):
        assert clusterer.k == 9
        assert len(ARCHETYPES) == 9
        for i in range(1, 10):
            assert i in ARCHETYPES
            assert ARCHETYPES[i].code == f"C{i}"

    def test_responsibilities_sum_to_one(self, clusterer: SoftGMMClusterer):
        """Verify soft posterior probabilities sum to 1.0 +/- 1e-5 across diverse inputs."""
        rng = np.random.RandomState(42)

        test_vectors = [
            np.zeros(64),
            np.ones(64),
            rng.randn(64),
            rng.randn(64) * 100.0,
            rng.randn(64) * 0.001,
            clusterer.get_centroid(1),
            clusterer.get_centroid(5),
            clusterer.get_centroid(9),
            (clusterer.get_centroid(2) + clusterer.get_centroid(4)) / 2.0,
        ]

        for idx, vec in enumerate(test_vectors):
            probs = clusterer.compute_responsibilities(vec)
            assert len(probs) == 9
            total = sum(probs.values())
            assert abs(total - 1.0) <= 1e-5, f"Vector {idx} probability sum {total} exceeded tolerance"
            for code, prob in probs.items():
                assert 0.0 <= prob <= 1.0, f"Probability {code}={prob} outside [0, 1]"

    def test_centroid_highest_responsibility(self, clusterer: SoftGMMClusterer):
        """When input is at centroid k, cluster C_k should have high responsibility."""
        for k in range(1, 10):
            centroid = clusterer.get_centroid(k)
            probs = clusterer.compute_responsibilities(centroid)
            assert max(probs, key=probs.get) == f"C{k}"

    def test_dimension_mismatch_raises(self, clusterer: SoftGMMClusterer):
        """Input vectors with mismatched dimensions should raise ValueError."""
        with pytest.raises(ValueError, match="Dimension mismatch"):
            clusterer.compute_responsibilities(np.zeros(32))

        with pytest.raises(ValueError, match="Dimension mismatch"):
            clusterer.compute_responsibilities(np.zeros(128))

    def test_save_and_load(self, clusterer: SoftGMMClusterer, tmp_path: Path):
        """Test serializing clusterer to file and restoring."""
        save_file = tmp_path / "gmm_test_params.json"
        clusterer.save(save_file)
        assert save_file.exists()

        loaded = SoftGMMClusterer.load(save_file)
        assert loaded.dim == clusterer.dim
        assert loaded.k == clusterer.k
        np.testing.assert_allclose(loaded.centroids, clusterer.centroids)
        np.testing.assert_allclose(loaded.variances, clusterer.variances)
        np.testing.assert_allclose(loaded.priors, clusterer.priors)

    def test_fit_from_samples(self, clusterer: SoftGMMClusterer):
        """Test fitting parameters from sample latent vectors."""
        rng = np.random.RandomState(123)
        samples = rng.randn(45, 64)
        clusterer.fit(samples, max_iter=20)
        assert clusterer.centroids.shape == (9, 64)
        assert clusterer.variances.shape == (9, 64)


class TestLeakyIntegrator:
    """Test suite for Temporal State Smoothing."""

    def test_initial_state_equals_input(self):
        smoother = LeakyIntegrator(eta=0.12, expected_dim=64)
        x0 = np.ones(64) * 0.5
        smoothed = smoother.smooth("usr_1", x0)
        np.testing.assert_allclose(smoothed, x0)

    def test_exponential_smoothing_decay(self):
        smoother = LeakyIntegrator(eta=0.12, expected_dim=64)
        x0 = np.zeros(64)
        smoother.smooth("usr_1", x0)

        x1 = np.ones(64)
        smoothed = smoother.smooth("usr_1", x1)
        expected = (1.0 - 0.12) * 0.0 + 0.12 * 1.0
        np.testing.assert_allclose(smoothed, np.full(64, expected))

    def test_user_state_isolation(self):
        smoother = LeakyIntegrator(eta=0.12, expected_dim=64)
        smoother.smooth("usr_a", np.ones(64))
        smoother.smooth("usr_b", np.zeros(64))

        np.testing.assert_allclose(smoother.get_state("usr_a"), np.ones(64))
        np.testing.assert_allclose(smoother.get_state("usr_b"), np.zeros(64))
