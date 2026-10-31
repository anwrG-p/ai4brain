"""Unit tests for TargetEncoder."""

import numpy as np
import pytest

from brain_twin_jepa.encoder import TemporalContextEncoder
from brain_twin_jepa.target_encoder import TargetEncoder


class TestTargetEncoder:
    """Test suite for EMA Target Encoder."""

    def test_target_initialization_matches_context(self):
        source = TemporalContextEncoder()
        target = TargetEncoder(source, tau=0.996)

        for k in source.weights:
            assert np.allclose(target.weights[k], source.weights[k])

    def test_ema_update_moves_smoothly(self):
        source = TemporalContextEncoder()
        target = TargetEncoder(source, tau=0.9)

        # Alter source weights manually
        source.weights["w_proj"] += 1.0

        # Before update, target is unchanged
        assert not np.allclose(target.weights["w_proj"], source.weights["w_proj"])

        target.update_ema(source, tau=0.9)
        # target should be 0.9 * old + 0.1 * new
        # old + 0.1 * 1.0 = old + 0.1
        diff = target.weights["w_proj"] - (source.weights["w_proj"] - 1.0)
        assert pytest.approx(float(diff[0, 0]), abs=1e-5) == 0.1

    def test_encode_sequence(self):
        source = TemporalContextEncoder()
        target = TargetEncoder(source)

        seq = np.ones((5, 12), dtype=np.float32) * 0.3
        states = target.encode_sequence(seq)

        assert states.shape == (5, 64)
        assert np.all(np.isfinite(states))

    def test_encode_single(self):
        source = TemporalContextEncoder()
        target = TargetEncoder(source)

        x_t = np.ones(12, dtype=np.float32) * 0.4
        s_t, h_t = target.encode_single(x_t)

        assert s_t.shape == (64,)
        assert h_t.shape == (64,)
        assert np.all(np.isfinite(s_t))

    def test_sequence_shape_validation(self):
        source = TemporalContextEncoder()
        target = TargetEncoder(source)

        with pytest.raises(ValueError, match="Expected sequence of shape"):
            target.encode_sequence(np.ones((5, 8), dtype=np.float32))
