"""Temporal State Smoothing (Leaky Integrator) for cognitive latent vectors.

Decouples fast transient fluctuations from slow-varying cognitive trajectories
using an exponential smoothing filter:
    s_bar_t = (1 - eta) * s_bar_{t-1} + eta * s_t   (eta = 0.12)
"""

from __future__ import annotations

from collections import OrderedDict
from typing import Dict, Optional, Sequence, Union
import numpy as np


class LeakyIntegrator:
    """Exponential leaky integrator maintaining continuous state trajectories per user."""

    def __init__(
        self,
        eta: float = 0.12,
        normalize: bool = False,
        expected_dim: int = 64,
        max_sessions: int = 10000,
    ) -> None:
        """Initialize the LeakyIntegrator.

        Args:
            eta: Smoothing rate in (0.0, 1.0]. Defaults to 0.12.
            normalize: If True, normalize smoothed vectors to unit L2 norm.
            expected_dim: Expected dimensionality of latent vectors (default: 64).
            max_sessions: Maximum concurrent user sessions kept in memory (default: 10000).
        """
        if not (0.0 < eta <= 1.0):
            raise ValueError(f"eta must be in (0.0, 1.0], got {eta}")
        self.eta: float = float(eta)
        self.normalize: bool = normalize
        self.expected_dim: int = expected_dim
        self.max_sessions: int = max(1, max_sessions)
        self._states: OrderedDict[str, np.ndarray] = OrderedDict()

    def smooth(
        self,
        user_id: str,
        s_t: Union[np.ndarray, Sequence[float]],
    ) -> np.ndarray:
        """Update and return the smoothed cognitive state for a user.

        Args:
            user_id: Unique identifier for the user session.
            s_t: Latent state vector at current step t.

        Returns:
            Smoothed latent state vector s_bar_t.
        """
        arr = np.asarray(s_t, dtype=np.float64).flatten()
        if not np.all(np.isfinite(arr)):
            raise ValueError("Input vector must contain only finite numbers.")
        if self.expected_dim is not None and arr.shape[0] != self.expected_dim:
            raise ValueError(
                f"Dimension mismatch: expected vector of dimension {self.expected_dim}, "
                f"got {arr.shape[0]}"
            )

        if user_id not in self._states:
            s_bar = arr.copy()
        else:
            prev_s = self._states[user_id]
            s_bar = (1.0 - self.eta) * prev_s + self.eta * arr

        if self.normalize:
            norm = np.linalg.norm(s_bar)
            if norm > 1e-12:
                s_bar = s_bar / norm

        self._states[user_id] = s_bar
        self._states.move_to_end(user_id)
        if len(self._states) > self.max_sessions:
            self._states.popitem(last=False)
        return s_bar.copy()

    def get_state(self, user_id: str) -> Optional[np.ndarray]:
        """Return the current smoothed state for user, or None if uninitialized."""
        if user_id in self._states:
            self._states.move_to_end(user_id)
            return self._states[user_id].copy()
        return None

    def set_state(self, user_id: str, state: Union[np.ndarray, Sequence[float]]) -> None:
        """Explicitly set or restore smoothed state for a user."""
        arr = np.asarray(state, dtype=np.float64).flatten()
        if not np.all(np.isfinite(arr)):
            raise ValueError("State vector must contain only finite numbers.")
        if self.expected_dim is not None and arr.shape[0] != self.expected_dim:
            raise ValueError(
                f"Dimension mismatch: expected {self.expected_dim}, got {arr.shape[0]}"
            )
        self._states[user_id] = arr.copy()
        self._states.move_to_end(user_id)
        if len(self._states) > self.max_sessions:
            self._states.popitem(last=False)

    def reset(self, user_id: Optional[str] = None) -> None:
        """Reset state for a specific user, or all users if user_id is None."""
        if user_id is None:
            self._states.clear()
        else:
            self._states.pop(user_id, None)
