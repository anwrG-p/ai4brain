"""Unit tests for TelemetryFeaturizer."""

import numpy as np
import pytest

from brain_twin_jepa.featurizer import (
    CANONICAL_DIMENSIONS,
    FEATURE_DIM,
    TelemetryFeaturizer,
)


class TestTelemetryFeaturizer:
    """Test suite for telemetry featurization and validation."""

    def test_default_featurization_shape_and_bounds(self):
        featurizer = TelemetryFeaturizer()
        assert featurizer.feature_dim == 12

        sample_event = {
            "dimension": "working_memory",
            "score_norm": 0.85,
            "response_time_ms": 1250.0,
            "error_flag": False,
            "error_burst": 0,
            "hesitation_jitter": 45.0,
            "trial_index": 5,
        }

        vec = featurizer.featurize(sample_event)
        assert isinstance(vec, np.ndarray)
        assert vec.shape == (12,)
        assert vec.dtype == np.float32
        assert np.all(np.isfinite(vec))
        # Dimension one-hot for working_memory (index 0)
        assert vec[0] == 1.0
        assert np.sum(vec[0:6]) == 1.0
        # Score
        assert pytest.approx(vec[6], abs=1e-4) == 0.85
        # Response time in [0, 1]
        assert 0.0 < vec[7] < 1.0
        # Error flag
        assert vec[8] == 0.0
        # Error burst
        assert vec[9] == 0.0
        # Jitter in [0, 1]
        assert 0.0 < vec[10] < 1.0
        # Trial index
        assert pytest.approx(vec[11], abs=1e-4) == 0.05

    def test_all_canonical_dimensions(self):
        featurizer = TelemetryFeaturizer()
        for idx, dim in enumerate(CANONICAL_DIMENSIONS):
            event = {
                "dimension": dim,
                "score_norm": 1.0,
                "response_time_ms": 500.0,
            }
            vec = featurizer.featurize(event)
            assert vec[idx] == 1.0
            assert np.sum(vec[0:6]) == 1.0

    def test_unknown_dimension_raises(self):
        featurizer = TelemetryFeaturizer()
        with pytest.raises(ValueError, match="Unknown cognitive dimension"):
            featurizer.featurize({"dimension": "invalid_dim", "score_norm": 0.5})

    def test_nan_or_inf_rejection(self):
        featurizer = TelemetryFeaturizer()
        with pytest.raises(ValueError, match="non-finite numerical values"):
            featurizer.featurize({
                "dimension": "pattern_induction",
                "score_norm": float("nan"),
                "response_time_ms": 1000.0,
            })

        with pytest.raises(ValueError, match="non-finite numerical values"):
            featurizer.featurize({
                "dimension": "pattern_induction",
                "score_norm": 0.5,
                "response_time_ms": float("inf"),
            })

    def test_negative_values_rejection(self):
        featurizer = TelemetryFeaturizer()
        with pytest.raises(ValueError, match="negative values"):
            featurizer.featurize({
                "dimension": "spatial_orientation",
                "score_norm": -0.1,
                "response_time_ms": 1000.0,
            })

    def test_batch_featurization(self):
        featurizer = TelemetryFeaturizer()
        events = [
            {"dimension": "working_memory", "score_norm": 0.9, "response_time_ms": 800.0},
            {"dimension": "processing_speed", "score_norm": 0.7, "response_time_ms": 400.0},
            {"dimension": "episodic_memory", "score_norm": 0.6, "response_time_ms": 1500.0},
        ]
        matrix = featurizer.featurize_batch(events)
        assert matrix.shape == (3, 12)
        assert matrix.dtype == np.float32
        assert np.all(np.isfinite(matrix))

    def test_empty_batch(self):
        featurizer = TelemetryFeaturizer()
        empty = featurizer.featurize_batch([])
        assert empty.shape == (0, 12)

    def test_get_dimension_one_hot(self):
        featurizer = TelemetryFeaturizer()
        hot = featurizer.get_dimension_one_hot("spatial_orientation")
        assert hot.shape == (6,)
        assert hot[3] == 1.0
        assert np.sum(hot) == 1.0
