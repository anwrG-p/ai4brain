"""Latent Trajectory Predictor for SAT-JEPA Brain Twin.

Pure NumPy 2-layer residual MLP with vectorized GELU activation that predicts
future cognitive states and monotonic uncertainty intervals.
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Sequence, Tuple, Union
import numpy as np
from scipy.special import erf

from brain_twin_jepa.featurizer import DIMENSION_TO_IDX


def _gelu(x: np.ndarray) -> np.ndarray:
    """Gaussian Error Linear Unit (GELU) in pure NumPy/SciPy."""
    return (0.5 * x * (1.0 + erf(x / math.sqrt(2.0)))).astype(np.float32)


class LatentPredictor:
    """Latent Predictor g_φ: (s_t, h, c_{t+h}) → (ŝ_{t+h}, σ_{t+h}²).

    Projects forward state displacements using a residual MLP architecture
    conditioned on step horizon h and optional target cognitive dimension.
    """

    def __init__(
        self,
        latent_dim: int = 64,
        num_dimensions: int = 6,
        hidden_dim: int = 64,
        seed: int = 42,
    ) -> None:
        self.latent_dim = latent_dim
        self.num_dimensions = num_dimensions
        self.hidden_dim = hidden_dim
        self.input_dim = latent_dim + 1 + num_dimensions  # 64 + 1 + 6 = 71

        self._rng = np.random.default_rng(seed)
        self.weights: Dict[str, np.ndarray] = self._init_weights()

    def _init_weights(self) -> Dict[str, np.ndarray]:
        """Initialize weights with small variance for residual stability."""
        scale_1 = np.sqrt(2.0 / self.input_dim)
        w1 = self._rng.normal(0.0, scale_1, (self.hidden_dim, self.input_dim)).astype(np.float32)
        b1 = np.zeros(self.hidden_dim, dtype=np.float32)

        # Residual projection initialized with small weights for smooth identity start
        w2 = self._rng.normal(0.0, 0.02, (self.latent_dim, self.hidden_dim)).astype(np.float32)
        b2 = np.zeros(self.latent_dim, dtype=np.float32)

        # Uncertainty variance head
        w_var = self._rng.normal(0.0, 0.01, (1, self.hidden_dim)).astype(np.float32)
        b_var = np.array([0.0], dtype=np.float32)

        return {
            "w1": w1, "b1": b1,
            "w2": w2, "b2": b2,
            "w_var": w_var, "b_var": b_var,
        }

    def _build_input(
        self,
        s_t: np.ndarray,
        step_h: int,
        target_dimension: Optional[Union[str, int]] = None,
    ) -> np.ndarray:
        """Construct the 71-dimensional conditioning input vector."""
        if s_t.shape != (self.latent_dim,):
            raise ValueError(f"State shape mismatch: expected ({self.latent_dim},), got {s_t.shape}")
        if not np.all(np.isfinite(s_t)):
            raise ValueError("Predictor received non-finite latent state vector.")

        # Horizon scalar normalized by 10.0
        h_scaled = np.array([max(1, step_h) / 10.0], dtype=np.float32)

        # Target dimension one-hot
        c_vec = np.zeros(self.num_dimensions, dtype=np.float32)
        if target_dimension is not None:
            if isinstance(target_dimension, str):
                dim_str = target_dimension.lower()
                if dim_str in DIMENSION_TO_IDX:
                    c_vec[DIMENSION_TO_IDX[dim_str]] = 1.0
                else:
                    c_vec.fill(1.0 / self.num_dimensions)
            elif isinstance(target_dimension, int) and 0 <= target_dimension < self.num_dimensions:
                c_vec[target_dimension] = 1.0
            else:
                c_vec.fill(1.0 / self.num_dimensions)
        else:
            # Uniform neutral prior over dimensions
            c_vec.fill(1.0 / self.num_dimensions)

        return np.concatenate([s_t.astype(np.float32), h_scaled, c_vec])

    def predict_step(
        self,
        s_t: np.ndarray,
        step_h: int = 1,
        target_dimension: Optional[Union[str, int]] = None,
    ) -> Tuple[np.ndarray, float]:
        """Predict a single future state ŝ_{t+h} and its scalar uncertainty σ_{t+h}."""
        u = self._build_input(s_t, step_h, target_dimension)
        w = self.weights

        # Layer 1 with GELU
        z1 = _gelu(w["w1"] @ u + w["b1"])

        # Residual state delta
        delta_s = w["w2"] @ z1 + w["b2"]
        s_hat = s_t + delta_s

        # Monotonic horizon uncertainty: baseline + rate * h
        log_var = float((w["w_var"] @ z1 + w["b_var"])[0])
        log_var = max(-4.0, min(4.0, log_var))
        base_sigma = math.exp(0.5 * log_var)
        # Uncertainty grows monotonically with forecast distance h
        horizon_sigma = base_sigma * (1.0 + 0.15 * float(step_h))

        return s_hat.astype(np.float32), float(horizon_sigma)

    def predict_horizon(
        self,
        s_t: np.ndarray,
        horizon: int = 5,
        target_dimensions: Optional[Sequence[Optional[Union[str, int]]]] = None,
    ) -> List[Tuple[np.ndarray, float]]:
        """Forecast a continuous trajectory over h = 1..horizon steps.

        Returns:
            List of (s_hat_h, uncertainty_sigma_h) for each step h ∈ {1..horizon}.
        """
        if horizon < 1:
            raise ValueError(f"Horizon must be >= 1, got {horizon}")

        trajectory: List[Tuple[np.ndarray, float]] = []
        for h in range(1, horizon + 1):
            dim_cond = None
            if target_dimensions is not None and len(target_dimensions) >= h:
                dim_cond = target_dimensions[h - 1]

            s_hat, sigma = self.predict_step(s_t, step_h=h, target_dimension=dim_cond)
            trajectory.append((s_hat, sigma))

        return trajectory

    def get_weights(self) -> Dict[str, np.ndarray]:
        return {k: v.copy() for k, v in self.weights.items()}

    def load_weights(self, weights: Dict[str, np.ndarray]) -> None:
        for k, v in weights.items():
            if k in self.weights:
                if self.weights[k].shape != v.shape:
                    raise ValueError(f"Weight shape mismatch for '{k}': expected {self.weights[k].shape}, got {v.shape}")
                self.weights[k] = v.copy().astype(np.float32)
