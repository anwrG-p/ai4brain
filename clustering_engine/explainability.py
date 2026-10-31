"""Prototype differential vector (README Member 3): delta_c = W_eval (mu_target - mu_active), keyed
by pillar so the coach can say which skills separate the active profile from the target one."""

from __future__ import annotations

import numpy as np

from clustering_engine.clustering_gmm import PILLARS


def delta_c(mu_target, mu_active, W=None, pillars: tuple[str, ...] = PILLARS) -> dict[str, float]:
    """W_eval (mu_target - mu_active) as {pillar: value}.

    - W None: identity (the centroids are pillar scores already, d must equal len(pillars)).
    - W 1-D [d]: per-pillar weights (a diagonal W_eval).
    - W 2-D [len(pillars), d]: projects a latent difference onto the pillars.
    """
    target = np.asarray(mu_target, dtype=float)
    active = np.asarray(mu_active, dtype=float)
    if target.ndim != 1 or target.shape != active.shape:
        raise ValueError("mu_target and mu_active must be 1-D arrays of the same length")
    diff = target - active
    if W is None:
        out = diff
    else:
        W = np.asarray(W, dtype=float)
        if W.ndim == 1:
            if W.shape != diff.shape:
                raise ValueError("diagonal W must match the centroid length")
            out = W * diff
        elif W.ndim == 2 and W.shape[1] == diff.size:
            out = W @ diff
        else:
            raise ValueError("W must be [d] or [n_pillars, d]")
    if out.size != len(pillars):
        raise ValueError(f"delta_c has {out.size} entries for {len(pillars)} pillars")
    return {p: float(v) for p, v in zip(pillars, out)}
