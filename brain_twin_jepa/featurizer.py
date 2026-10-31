"""Telemetry Featurizer for SAT-JEPA Brain Twin.

Transforms raw Member 1 telemetry events into normalized 12-dimensional
numerical feature vectors for continuous latent encoding.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Sequence, Union
import numpy as np

# Canonical 6 cognitive dimensions matching Member 1 and Member 3 specifications
CANONICAL_DIMENSIONS: List[str] = [
    "working_memory",
    "pattern_induction",
    "executive_function",
    "spatial_orientation",
    "processing_speed",
    "episodic_memory",
]

DIMENSION_TO_IDX: Dict[str, int] = {dim: i for i, dim in enumerate(CANONICAL_DIMENSIONS)}
FEATURE_DIM: int = 12
MAX_RT_MS: float = 600_000.0
LOG_MAX_RT: float = math.log(1.0 + MAX_RT_MS)


class TelemetryFeaturizer:
    """Extracts and normalizes a 12D feature vector from TelemetryEvent data.

    Feature Vector Layout (12D):
    [0:6]  - One-hot encoding of cognitive dimension (6D)
    [6]    - score_norm in [0, 1] (1D)
    [7]    - log-scaled response_time_ms in [0, 1] (1D)
    [8]    - error_flag as float {0.0, 1.0} (1D)
    [9]    - normalized error_burst in [0, 1] (1D)
    [10]   - log-scaled hesitation_jitter in [0, 1] (1D)
    [11]   - normalized trial_index in [0, 1] (1D)
    """

    def __init__(self, dimensions: Sequence[str] | None = None) -> None:
        self.dimensions = list(dimensions) if dimensions is not None else list(CANONICAL_DIMENSIONS)
        self.dim_to_idx = {d: i for i, d in enumerate(self.dimensions)}
        self.feature_dim = len(self.dimensions) + 6

    def featurize(self, event: Union[Dict[str, Any], Any]) -> np.ndarray:
        """Convert a single TelemetryEvent dict or object to a normalized 1D numpy array."""
        data = event if isinstance(event, dict) else (
            event.model_dump() if hasattr(event, "model_dump") else getattr(event, "__dict__", {})
        )

        dim_str = str(data.get("dimension", self.dimensions[0])).lower()
        if dim_str not in self.dim_to_idx:
            raise ValueError(f"Unknown cognitive dimension: '{dim_str}'. Expected one of {self.dimensions}")

        score_norm = float(data.get("score_norm", 0.0))
        rt_ms = float(data.get("response_time_ms", 0.0))
        error_flag = 1.0 if bool(data.get("error_flag", False)) else 0.0
        error_burst = float(data.get("error_burst", 0))
        hesitation_jitter = float(data.get("hesitation_jitter", 0.0))
        trial_index = float(data.get("trial_index", 0))

        # Check raw finiteness before math transformations
        raw_values = [score_norm, rt_ms, error_burst, hesitation_jitter, trial_index]
        if not all(math.isfinite(v) for v in raw_values):
            raise ValueError("TelemetryEvent contains non-finite numerical values (NaN or Inf).")

        if rt_ms < 0.0 or score_norm < 0.0:
            raise ValueError("TelemetryEvent contains negative values for strictly positive metrics.")

        vec = np.zeros(self.feature_dim, dtype=np.float32)

        # 1. One-hot dimension
        vec[self.dim_to_idx[dim_str]] = 1.0

        offset = len(self.dimensions)

        # 2. Score norm (clamped to [0, 1])
        vec[offset] = max(0.0, min(1.0, score_norm))

        # 3. Log-scaled Response Time
        vec[offset + 1] = max(0.0, min(1.0, math.log(1.0 + rt_ms) / LOG_MAX_RT))

        # 4. Error flag
        vec[offset + 2] = error_flag

        # 5. Normalized error burst (saturated at 10)
        vec[offset + 3] = max(0.0, min(1.0, error_burst / 10.0))

        # 6. Log-scaled hesitation jitter
        vec[offset + 4] = max(0.0, min(1.0, math.log(1.0 + max(0.0, hesitation_jitter)) / 10.0))

        # 7. Normalized trial progression (saturated at 100)
        vec[offset + 5] = max(0.0, min(1.0, trial_index / 100.0))

        if not np.all(np.isfinite(vec)):
            raise ValueError("Featurized vector produced non-finite values.")

        return vec

    def featurize_batch(self, events: Sequence[Union[Dict[str, Any], Any]]) -> np.ndarray:
        """Batch-featurize a sequence of telemetry events into an (N, feature_dim) matrix."""
        if not events:
            return np.empty((0, self.feature_dim), dtype=np.float32)
        return np.stack([self.featurize(e) for e in events], axis=0)

    def get_dimension_one_hot(self, dimension_name: str) -> np.ndarray:
        """Helper returning one-hot vector for a dimension."""
        dim_str = dimension_name.lower()
        if dim_str not in self.dim_to_idx:
            raise ValueError(f"Unknown dimension: '{dimension_name}'")
        one_hot = np.zeros(len(self.dimensions), dtype=np.float32)
        one_hot[self.dim_to_idx[dim_str]] = 1.0
        return one_hot
