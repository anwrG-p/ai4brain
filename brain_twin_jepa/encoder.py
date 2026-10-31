"""Temporal Context Encoder for SAT-JEPA Brain Twin.

Pure NumPy implementation of a 64-unit Gated Recurrent Unit (GRU) with
vectorized LayerNorm and bounded LRU session tracking.
"""

from __future__ import annotations

from collections import OrderedDict
from typing import Dict, Optional
import numpy as np
from scipy.special import expit


def _layer_norm(x: np.ndarray, gamma: np.ndarray, beta: np.ndarray, eps: float = 1e-5) -> np.ndarray:
    """Vectorized Layer Normalization for 1D or 2D array."""
    mean = np.mean(x, axis=-1, keepdims=True)
    var = np.var(x, axis=-1, keepdims=True)
    norm = (x - mean) / np.sqrt(var + eps)
    return norm * gamma + beta


class TemporalContextEncoder:
    """Pure NumPy 64-unit Gated Recurrent Unit (GRU) Context Encoder f_θ.

    Maps trial sequence x_{1:t} into a smooth, normalized continuous latent state
    s_t ∈ ℝ^64, retaining user session history via bounded LRU cache.
    """

    def __init__(
        self,
        input_dim: int = 12,
        hidden_dim: int = 64,
        latent_dim: int = 64,
        max_sessions: int = 10_000,
        seed: int = 42,
    ) -> None:
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.latent_dim = latent_dim
        self.max_sessions = max_sessions

        self._rng = np.random.default_rng(seed)
        self.weights: Dict[str, np.ndarray] = self._init_weights()
        self._sessions: OrderedDict[str, np.ndarray] = OrderedDict()

    def _init_weights(self) -> Dict[str, np.ndarray]:
        """Initialize weights with Xavier for inputs and Orthonormal for recurrent weights."""
        scale_x = np.sqrt(2.0 / (self.input_dim + self.hidden_dim))
        
        # Input weights (hidden_dim, input_dim)
        w_xr = self._rng.normal(0.0, scale_x, (self.hidden_dim, self.input_dim)).astype(np.float32)
        w_xz = self._rng.normal(0.0, scale_x, (self.hidden_dim, self.input_dim)).astype(np.float32)
        w_xh = self._rng.normal(0.0, scale_x, (self.hidden_dim, self.input_dim)).astype(np.float32)

        # Recurrent weights with QR orthonormal decomposition
        q_r, _ = np.linalg.qr(self._rng.standard_normal((self.hidden_dim, self.hidden_dim)))
        q_z, _ = np.linalg.qr(self._rng.standard_normal((self.hidden_dim, self.hidden_dim)))
        q_h, _ = np.linalg.qr(self._rng.standard_normal((self.hidden_dim, self.hidden_dim)))

        w_hr = q_r.astype(np.float32)
        w_hz = q_z.astype(np.float32)
        w_hh = q_h.astype(np.float32)

        # Biases
        b_r = np.zeros(self.hidden_dim, dtype=np.float32)
        b_z = np.ones(self.hidden_dim, dtype=np.float32)  # Update gate bias 1.0 for retention
        b_h = np.zeros(self.hidden_dim, dtype=np.float32)

        # Projection & LayerNorm
        w_proj = np.eye(self.latent_dim, self.hidden_dim, dtype=np.float32)
        b_proj = np.zeros(self.latent_dim, dtype=np.float32)
        gamma = np.ones(self.latent_dim, dtype=np.float32)
        beta = np.zeros(self.latent_dim, dtype=np.float32)

        return {
            "w_xr": w_xr, "w_xz": w_xz, "w_xh": w_xh,
            "w_hr": w_hr, "w_hz": w_hz, "w_hh": w_hh,
            "b_r": b_r, "b_z": b_z, "b_h": b_h,
            "w_proj": w_proj, "b_proj": b_proj,
            "gamma": gamma, "beta": beta,
        }

    def _gru_cell(self, x_t: np.ndarray, h_prev: np.ndarray) -> np.ndarray:
        """Single-step GRU recurrence."""
        w = self.weights
        # Reset gate
        r_t = expit(w["w_xr"] @ x_t + w["w_hr"] @ h_prev + w["b_r"])
        # Update gate
        z_t = expit(w["w_xz"] @ x_t + w["w_hz"] @ h_prev + w["b_z"])
        # Candidate hidden state
        h_cand = np.tanh(w["w_xh"] @ x_t + w["w_hh"] @ (r_t * h_prev) + w["b_h"])
        # State interpolation
        h_next = (1.0 - z_t) * h_prev + z_t * h_cand
        return h_next.astype(np.float32)

    def _project_and_norm(self, h_t: np.ndarray) -> np.ndarray:
        """Projects hidden state to latent space and applies LayerNorm."""
        w = self.weights
        unnormed = w["w_proj"] @ h_t + w["b_proj"]
        normed = _layer_norm(unnormed, w["gamma"], w["beta"])
        return normed.astype(np.float32)

    def step(self, user_id: str, x_t: np.ndarray) -> np.ndarray:
        """Process a single trial feature vector x_t for a user, returning s_t ∈ ℝ^64."""
        if not np.all(np.isfinite(x_t)):
            raise ValueError(f"Context encoder received non-finite feature vector for user '{user_id}'.")
        if x_t.shape != (self.input_dim,):
            raise ValueError(f"Feature vector shape mismatch: expected ({self.input_dim},), got {x_t.shape}.")

        if user_id in self._sessions:
            h_prev = self._sessions.pop(user_id)
        else:
            if len(self._sessions) >= self.max_sessions:
                self._sessions.popitem(last=False)  # Evict oldest LRU session
            h_prev = np.zeros(self.hidden_dim, dtype=np.float32)

        h_next = self._gru_cell(x_t, h_prev)
        self._sessions[user_id] = h_next

        s_t = self._project_and_norm(h_next)
        return s_t

    def get_state(self, user_id: str) -> Optional[np.ndarray]:
        """Return the current latent state s_t for an active user, or None if unobserved."""
        if user_id in self._sessions:
            h = self._sessions[user_id]
            return self._project_and_norm(h)
        return None

    def reset_user(self, user_id: str) -> None:
        """Clear session memory for a given user."""
        self._sessions.pop(user_id, None)

    def clear_all(self) -> None:
        """Clear all active sessions."""
        self._sessions.clear()

    def get_weights(self) -> Dict[str, np.ndarray]:
        """Export a copy of current model weights."""
        return {k: v.copy() for k, v in self.weights.items()}

    def load_weights(self, weights: Dict[str, np.ndarray]) -> None:
        """Load external weight dictionary."""
        for k, v in weights.items():
            if k in self.weights:
                if self.weights[k].shape != v.shape:
                    raise ValueError(f"Weight shape mismatch for '{k}': expected {self.weights[k].shape}, got {v.shape}")
                self.weights[k] = v.copy().astype(np.float32)
