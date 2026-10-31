"""Schmitt-trigger hysteresis gate on cluster posteriors (README Member 3: delta_hyst = 0.15,
N_confirm = 3).

The active cluster changes only after N_confirm consecutive frames in which the same challenger
leads the active cluster's posterior by more than delta. A frame inside the margin, or a different
challenger, restarts the count, so posteriors chattering around a boundary never switch.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

DELTA_HYST = 0.15
N_CONFIRM = 3


@dataclass
class HysteresisGate:
    delta: float = DELTA_HYST
    n_confirm: int = N_CONFIRM
    active: int | None = None  # None until the first frame
    challenger: int | None = None
    count: int = 0  # consecutive frames the challenger has led by more than delta
    switches: int = 0

    def __post_init__(self):
        if self.delta < 0 or self.n_confirm < 1:
            raise ValueError("delta must be >= 0 and n_confirm >= 1")

    def step(self, gamma) -> int:
        """Feeds one posterior frame gamma [k]; returns the active cluster after it."""
        g = np.asarray(gamma, dtype=float)
        if g.ndim != 1 or g.size == 0 or not np.isfinite(g).all():
            raise ValueError("gamma must be a non-empty finite 1-D array")
        top = int(np.argmax(g))
        if self.active is None or self.active >= g.size:
            # First frame (or the cluster count changed under us): adopt the leader, no switch.
            self.active, self.challenger, self.count = top, None, 0
            return self.active
        if top != self.active and g[top] - g[self.active] > self.delta:
            self.count = self.count + 1 if top == self.challenger else 1
            self.challenger = top
            if self.count >= self.n_confirm:
                self.active, self.challenger, self.count = top, None, 0
                self.switches += 1
        else:
            self.challenger, self.count = None, 0
        return self.active
