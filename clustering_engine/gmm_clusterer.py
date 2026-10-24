"""Soft Gaussian Mixture Model (GMM) Clustering for Cognitive Archetypes.

Evaluates soft posterior responsibilities gamma_{t,k} = P(C_k | s_bar_t)
over a 64-dimensional latent space for K = 9 non-clinical cognitive archetypes.
Uses log-sum-exp stabilization to guarantee numerical bounds and that
responsibilities sum to 1.0 +/- 1e-5.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple, Union

import numpy as np
from scipy.special import logsumexp

from clustering_engine.archetypes import ARCHETYPES, Archetype


def _create_default_centroids(dim: int = 64) -> np.ndarray:
    """Generate deterministic, calibrated orthonormal prototype centroids in R^dim.

    Spans the 3x3 cognitive grid (Proficiency x Pacing Strategy) across K=9 archetypes.
    """
    rng = np.random.RandomState(42)
    # Generate random matrix and perform QR decomposition for an orthonormal basis
    q, _ = np.linalg.qr(rng.randn(dim, 9))  # shape (dim, 9)
    centroids = q.T  # shape (9, dim), each row is an orthonormal vector

    # Give structured directionality to each row based on grid position
    for idx in range(9):
        arch_id = idx + 1
        tier_idx = (arch_id - 1) // 3  # 0: Developing, 1: Operational, 2: Strategic
        pace_idx = (arch_id - 1) % 3   # 0: Fast, 1: Balanced, 2: Deliberate
        # Inject consistent bias in first 6 dimensions
        centroids[idx, 0] = (tier_idx - 1.0) * 0.4
        centroids[idx, 1] = (pace_idx - 1.0) * 0.4
        centroids[idx, 2] = 0.5 * (tier_idx + 1.0)
        # Normalize to unit sphere
        norm = np.linalg.norm(centroids[idx])
        if norm > 1e-12:
            centroids[idx] = centroids[idx] / norm

    return centroids


class SoftGMMClusterer:
    """Soft Gaussian Mixture Model clustering engine with K=9 cognitive archetypes."""

    def __init__(
        self,
        dim: int = 64,
        variance: float = 0.30,
        centroids: Optional[np.ndarray] = None,
        variances: Optional[np.ndarray] = None,
        priors: Optional[np.ndarray] = None,
    ) -> None:
        """Initialize the Soft GMM clusterer.

        Args:
            dim: Dimension of latent space (default: 64).
            variance: Default isotropic variance sigma^2 per dimension.
            centroids: Optional pre-calibrated centroids matrix of shape (9, dim).
            variances: Optional diagonal variances array of shape (9, dim) or (9,).
            priors: Optional prior probabilities array of shape (9,).
        """
        self.dim: int = dim
        self.k: int = 9

        if centroids is not None:
            c = np.asarray(centroids, dtype=np.float64)
            if c.shape != (self.k, self.dim):
                raise ValueError(f"Centroids shape must be ({self.k}, {self.dim}), got {c.shape}")
            self.centroids = c.copy()
        else:
            self.centroids = _create_default_centroids(self.dim)

        if variances is not None:
            v = np.asarray(variances, dtype=np.float64)
            if v.shape == (self.k,):
                self.variances = np.tile(v[:, None], (1, self.dim))
            elif v.shape == (self.k, self.dim):
                self.variances = v.copy()
            else:
                raise ValueError(f"Invalid variances shape: {v.shape}")
        else:
            self.variances = np.full((self.k, self.dim), fill_value=variance, dtype=np.float64)

        if priors is not None:
            p = np.asarray(priors, dtype=np.float64)
            if p.shape != (self.k,):
                raise ValueError(f"Priors shape must be ({self.k},), got {p.shape}")
            p_sum = np.sum(p)
            self.priors = p / p_sum
        else:
            self.priors = np.full(self.k, fill_value=1.0 / self.k, dtype=np.float64)

    def _compute_log_likelihoods(self, x: np.ndarray) -> np.ndarray:
        """Compute log N(x; mu_k, Sigma_k) for all K=9 components.

        Args:
            x: Input vector of shape (dim,).

        Returns:
            Array of shape (9,) containing log-densities.
        """
        diff = x - self.centroids  # shape (9, dim)
        sq_diff = (diff ** 2) / self.variances  # shape (9, dim)
        mahalanobis = np.sum(sq_diff, axis=1)  # shape (9,)

        log_det = np.sum(np.log(self.variances), axis=1)  # shape (9,)
        const = self.dim * np.log(2.0 * np.pi)

        log_densities = -0.5 * (const + log_det + mahalanobis)
        return log_densities

    def compute_responsibilities(
        self,
        s_bar: Union[np.ndarray, Sequence[float]],
    ) -> Dict[str, float]:
        """Compute soft posterior responsibility probabilities gamma_{t, k} = P(C_k | s_bar).

        Returns:
            Dictionary mapping cluster codes 'C1'..'C9' to probabilities summing to 1.0 +/- 1e-5.
        """
        x = np.asarray(s_bar, dtype=np.float64).flatten()
        if x.shape[0] != self.dim:
            raise ValueError(
                f"Dimension mismatch: expected {self.dim}, got {x.shape[0]}"
            )

        log_densities = self._compute_log_likelihoods(x)  # shape (9,)
        log_priors = np.log(np.clip(self.priors, 1e-12, 1.0))
        log_joint = log_priors + log_densities  # shape (9,)

        log_evidence = logsumexp(log_joint)
        log_posterior = log_joint - log_evidence
        posterior = np.exp(log_posterior)

        # Precise normalization guaranteeing sum == 1.0 +/- 1e-5
        total = np.sum(posterior)
        if total > 0.0:
            posterior = posterior / total
        else:
            posterior = np.full(self.k, fill_value=1.0 / self.k)

        # Map to C1..C9
        return {f"C{idx + 1}": float(posterior[idx]) for idx in range(self.k)}

    def get_responsibilities_by_id(
        self,
        s_bar: Union[np.ndarray, Sequence[float]],
    ) -> Dict[int, float]:
        """Compute soft responsibilities keyed by 1-based integer cluster id (1..9)."""
        probs_by_code = self.compute_responsibilities(s_bar)
        return {int(code[1:]): prob for code, prob in probs_by_code.items()}

    def get_centroid(self, cluster_id: int) -> np.ndarray:
        """Get the prototype centroid vector for a 1-based cluster id (1..9)."""
        if not (1 <= cluster_id <= 9):
            raise ValueError(f"Cluster id must be between 1 and 9, got {cluster_id}")
        return self.centroids[cluster_id - 1].copy()

    def get_all_centroids(self) -> Dict[int, np.ndarray]:
        """Get all 9 centroids keyed by 1-based cluster id."""
        return {k: self.centroids[k - 1].copy() for k in range(1, 10)}

    def fit(self, X: np.ndarray, max_iter: int = 100, tol: float = 1e-4) -> "SoftGMMClusterer":
        """Fit or tune mixture parameters from data X of shape (N, dim) using EM.

        Args:
            X: Training latent samples of shape (N, dim).
            max_iter: Maximum EM iterations.
            tol: Convergence tolerance.
        """
        from sklearn.mixture import GaussianMixture

        X_arr = np.asarray(X, dtype=np.float64)
        if X_arr.ndim != 2 or X_arr.shape[1] != self.dim:
            raise ValueError(f"Expected X with shape (N, {self.dim}), got {X_arr.shape}")
        if X_arr.shape[0] < self.k:
            raise ValueError(f"Need at least {self.k} samples to fit, got {X_arr.shape[0]}")

        gmm = GaussianMixture(
            n_components=self.k,
            covariance_type="diag",
            max_iter=max_iter,
            tol=tol,
            random_state=42,
        )
        gmm.fit(X_arr)

        self.centroids = gmm.means_.copy()
        self.variances = gmm.covariances_.copy()
        self.priors = gmm.weights_.copy()
        return self

    def save(self, filepath: Union[str, Path]) -> None:
        """Save calibrated GMM clusterer parameters to a JSON file."""
        data = {
            "dim": self.dim,
            "k": self.k,
            "centroids": self.centroids.tolist(),
            "variances": self.variances.tolist(),
            "priors": self.priors.tolist(),
        }
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    @classmethod
    def load(cls, filepath: Union[str, Path]) -> "SoftGMMClusterer":
        """Load GMM clusterer parameters from a JSON file."""
        path = Path(filepath)
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return cls(
            dim=data["dim"],
            centroids=np.array(data["centroids"], dtype=np.float64),
            variances=np.array(data["variances"], dtype=np.float64),
            priors=np.array(data["priors"], dtype=np.float64),
        )
