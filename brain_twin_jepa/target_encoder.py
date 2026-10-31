"""EMA Target Encoder for SAT-JEPA Brain Twin.

Maintains stationary target representations via Exponential Moving Average (EMA)
parameter momentum (tau = 0.996) to prevent representation collapse.
"""

from __future__ import annotations

from typing import Dict, Optional, Tuple
import numpy as np
from scipy.special import expit

from brain_twin_jepa.encoder import TemporalContextEncoder, _layer_norm


class TargetEncoder:
    """Target Encoder f_{θ̄} updated via EMA momentum from Context Encoder f_θ.

    Mathematical update:
        θ̄ ← τ θ̄ + (1 - τ) θ   (default τ = 0.996)
    """

    def __init__(self, source_encoder: TemporalContextEncoder, tau: float = 0.996) -> None:
        self.tau = tau
        self.input_dim = source_encoder.input_dim
        self.hidden_dim = source_encoder.hidden_dim
        self.latent_dim = source_encoder.latent_dim

        # Initial target weights are an exact copy of the context encoder
        self.weights: Dict[str, np.ndarray] = {
            k: v.copy().astype(np.float32) for k, v in source_encoder.weights.items()
        }

    def update_ema(self, source_encoder: TemporalContextEncoder, tau: Optional[float] = None) -> None:
        """Update target weights towards source context weights using EMA."""
        m = self.tau if tau is None else tau
        source_w = source_encoder.weights

        for k in self.weights:
            if k in source_w:
                self.weights[k] = (m * self.weights[k] + (1.0 - m) * source_w[k]).astype(np.float32)

    def encode_sequence(self, x_seq: np.ndarray, initial_h: Optional[np.ndarray] = None) -> np.ndarray:
        """Process a sequence of feature vectors x_{1:T} (shape (T, input_dim)) into target states (T, latent_dim)."""
        if x_seq.ndim != 2 or x_seq.shape[1] != self.input_dim:
            raise ValueError(f"Expected sequence of shape (T, {self.input_dim}), got {x_seq.shape}")
        if not np.all(np.isfinite(x_seq)):
            raise ValueError("Target encoder received non-finite sequence.")

        t_len = x_seq.shape[0]
        w = self.weights

        h = np.zeros(self.hidden_dim, dtype=np.float32) if initial_h is None else initial_h.copy()
        s_out = np.zeros((t_len, self.latent_dim), dtype=np.float32)

        for t in range(t_len):
            x_t = x_seq[t]
            r_t = expit(w["w_xr"] @ x_t + w["w_hr"] @ h + w["b_r"])
            z_t = expit(w["w_xz"] @ x_t + w["w_hz"] @ h + w["b_z"])
            h_cand = np.tanh(w["w_xh"] @ x_t + w["w_hh"] @ (r_t * h) + w["b_h"])
            h = (1.0 - z_t) * h + z_t * h_cand

            unnormed = w["w_proj"] @ h + w["b_proj"]
            s_out[t] = _layer_norm(unnormed, w["gamma"], w["beta"])

        return s_out

    def encode_single(self, x_t: np.ndarray, h_prev: Optional[np.ndarray] = None) -> tuple[np.ndarray, np.ndarray]:
        """Encode a single step, returning (s_t, h_next)."""
        w = self.weights
        h = np.zeros(self.hidden_dim, dtype=np.float32) if h_prev is None else h_prev

        r_t = expit(w["w_xr"] @ x_t + w["w_hr"] @ h + w["b_r"])
        z_t = expit(w["w_xz"] @ x_t + w["w_hz"] @ h + w["b_z"])
        h_cand = np.tanh(w["w_xh"] @ x_t + w["w_hh"] @ (r_t * h) + w["b_h"])
        h_next = (1.0 - z_t) * h + z_t * h_cand

        unnormed = w["w_proj"] @ h_next + w["b_proj"]
        s_t = _layer_norm(unnormed, w["gamma"], w["beta"])
        return s_t.astype(np.float32), h_next.astype(np.float32)

    def get_weights(self) -> Dict[str, np.ndarray]:
        return {k: v.copy() for k, v in self.weights.items()}

    def load_weights(self, weights: Dict[str, np.ndarray]) -> None:
        for k, v in weights.items():
            if k in self.weights:
                self.weights[k] = v.copy().astype(np.float32)
