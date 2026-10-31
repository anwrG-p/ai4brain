"""Unit tests for LatentPredictor."""

import numpy as np
import pytest

from brain_twin_jepa.predictor import LatentPredictor


class TestLatentPredictor:
    """Test suite for pure-NumPy Latent Predictor."""

    def test_initialization(self):
        predictor = LatentPredictor(latent_dim=64, num_dimensions=6, hidden_dim=64)
        assert predictor.input_dim == 71
        assert "w1" in predictor.weights
        assert "w2" in predictor.weights
        assert "w_var" in predictor.weights

    def test_predict_single_step(self):
        predictor = LatentPredictor()
        s_t = np.ones(64, dtype=np.float32) * 0.25

        s_hat, sigma = predictor.predict_step(s_t, step_h=1, target_dimension="working_memory")

        assert isinstance(s_hat, np.ndarray)
        assert s_hat.shape == (64,)
        assert np.all(np.isfinite(s_hat))
        assert sigma > 0.0

        # Residual connection ensures predicted point is in close vicinity
        diff = np.linalg.norm(s_hat - s_t)
        assert diff < 2.0  # Smooth continuous transition

    def test_monotonic_uncertainty_growth(self):
        predictor = LatentPredictor()
        s_t = np.zeros(64, dtype=np.float32)

        sigmas = []
        for h in range(1, 6):
            _, sigma = predictor.predict_step(s_t, step_h=h)
            sigmas.append(sigma)

        # Verify that uncertainty strictly grows with forecast horizon
        for i in range(len(sigmas) - 1):
            assert sigmas[i] < sigmas[i + 1]

    def test_predict_horizon_length_and_types(self):
        predictor = LatentPredictor()
        s_t = np.random.default_rng(0).normal(0.0, 1.0, 64).astype(np.float32)

        traj = predictor.predict_horizon(s_t, horizon=5)
        assert len(traj) == 5

        for h, (s_hat_h, sigma_h) in enumerate(traj, start=1):
            assert s_hat_h.shape == (64,)
            assert np.all(np.isfinite(s_hat_h))
            assert sigma_h > 0.0

    def test_invalid_horizon_raises(self):
        predictor = LatentPredictor()
        s_t = np.zeros(64, dtype=np.float32)
        with pytest.raises(ValueError, match="Horizon must be >= 1"):
            predictor.predict_horizon(s_t, horizon=0)

    def test_invalid_state_shape_raises(self):
        predictor = LatentPredictor()
        with pytest.raises(ValueError, match="State shape mismatch"):
            predictor.predict_step(np.zeros(32, dtype=np.float32))

    def test_nan_state_raises(self):
        predictor = LatentPredictor()
        s_t = np.zeros(64, dtype=np.float32)
        s_t[0] = np.nan
        with pytest.raises(ValueError, match="non-finite latent state"):
            predictor.predict_step(s_t)
