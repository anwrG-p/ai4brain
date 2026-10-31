"""Unit tests for TemporalContextEncoder."""

import numpy as np
import pytest

from brain_twin_jepa.encoder import TemporalContextEncoder


class TestTemporalContextEncoder:
    """Test suite for pure-NumPy GRU Context Encoder."""

    def test_initialization_and_weights(self):
        encoder = TemporalContextEncoder(input_dim=12, hidden_dim=64, latent_dim=64)
        weights = encoder.get_weights()
        assert "w_xr" in weights
        assert "w_hr" in weights
        assert "w_proj" in weights
        assert weights["w_xr"].shape == (64, 12)
        assert weights["w_hr"].shape == (64, 64)
        assert weights["w_proj"].shape == (64, 64)

    def test_single_step_shape_and_finite(self):
        encoder = TemporalContextEncoder()
        x_t = np.ones(12, dtype=np.float32) * 0.5
        s_t = encoder.step("user_01", x_t)

        assert isinstance(s_t, np.ndarray)
        assert s_t.shape == (64,)
        assert np.all(np.isfinite(s_t))
        # LayerNorm ensures approx zero mean and unit variance
        assert pytest.approx(float(np.mean(s_t)), abs=0.2) == 0.0
        assert pytest.approx(float(np.var(s_t)), abs=0.2) == 1.0

    def test_sequential_steps_evolve_state(self):
        encoder = TemporalContextEncoder()
        x1 = np.zeros(12, dtype=np.float32)
        x2 = np.ones(12, dtype=np.float32)

        s1 = encoder.step("user_seq", x1)
        s2 = encoder.step("user_seq", x2)

        # State should evolve smoothly with new input
        assert not np.allclose(s1, s2)
        assert encoder.get_state("user_seq") is not None
        assert np.allclose(encoder.get_state("user_seq"), s2)

    def test_user_session_isolation(self):
        encoder = TemporalContextEncoder()
        x1 = np.ones(12, dtype=np.float32) * 0.2
        x2 = np.ones(12, dtype=np.float32) * 0.8

        s_user1 = encoder.step("user_a", x1)
        s_user2 = encoder.step("user_b", x2)

        assert not np.allclose(s_user1, s_user2)
        assert encoder.get_state("user_unknown") is None

    def test_reset_user(self):
        encoder = TemporalContextEncoder()
        x = np.ones(12, dtype=np.float32)
        encoder.step("user_reset", x)
        assert encoder.get_state("user_reset") is not None

        encoder.reset_user("user_reset")
        assert encoder.get_state("user_reset") is None

    def test_lru_session_eviction(self):
        encoder = TemporalContextEncoder(max_sessions=2)
        x = np.ones(12, dtype=np.float32)

        encoder.step("usr_1", x)
        encoder.step("usr_2", x)
        assert len(encoder._sessions) == 2

        # 3rd user evicts oldest (usr_1)
        encoder.step("usr_3", x)
        assert len(encoder._sessions) == 2
        assert "usr_1" not in encoder._sessions
        assert "usr_2" in encoder._sessions
        assert "usr_3" in encoder._sessions

    def test_nan_or_inf_rejection(self):
        encoder = TemporalContextEncoder()
        bad_x = np.ones(12, dtype=np.float32)
        bad_x[4] = np.nan

        with pytest.raises(ValueError, match="non-finite feature vector"):
            encoder.step("user_err", bad_x)

    def test_shape_mismatch_rejection(self):
        encoder = TemporalContextEncoder(input_dim=12)
        with pytest.raises(ValueError, match="Feature vector shape mismatch"):
            encoder.step("user_err", np.ones(8, dtype=np.float32))
