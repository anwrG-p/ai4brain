"""Soft Gaussian Mixture Model (GMM) Clustering for Cognitive Archetypes.

Evaluates soft posterior responsibilities gamma_{t,k} = P(C_k | s_bar_t)
over a d-dimensional latent space for arbitrary K cognitive archetypes.
Uses log-sum-exp stabilization to guarantee numerical bounds and that
responsibilities sum to 1.0 +/- 1e-5.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple, Union

import numpy as np
from scipy.special import logsumexp


def _create_dynamic_centroids(k: int = 9, dim: int = 64) -> np.ndarray:
    """Generate deterministic, calibrated orthonormal prototype centroids in R^dim for any K.

    Uses QR decomposition to guarantee orthogonality, then scales and normalizes.
    """
    if k <= 0:
        raise ValueError(f"k must be >= 1, got {k}")
    if dim <= 0:
        raise ValueError(f"dim must be >= 1, got {dim}")

    rng = np.random.RandomState(42)
    # Generate random matrix and perform QR decomposition for an orthonormal basis
    # If k > dim, generate in blocks
    if k <= dim:
        q, _ = np.linalg.qr(rng.randn(dim, k))  # shape (dim, k)
        centroids = q.T  # shape (k, dim)
    else:
        parts = []
        remaining = k
        while remaining > 0:
            take = min(remaining, dim)
            q, _ = np.linalg.qr(rng.randn(dim, take))
            parts.append(q.T)
            remaining -= take
        centroids = np.vstack(parts)

    # Normalize each centroid to the unit sphere with structured directional dispersion
    for idx in range(k):
        # Inject structured variance across first few coordinates
        centroids[idx, 0] += 0.3 * np.sin(2 * np.pi * idx / max(1, k))
        centroids[idx, 1] += 0.3 * np.cos(2 * np.pi * idx / max(1, k))
        norm = np.linalg.norm(centroids[idx])
        if norm > 1e-12:
            centroids[idx] = centroids[idx] / norm

    return centroids


class SoftGMMClusterer:
    """Soft Gaussian Mixture Model clustering engine supporting dynamic K clusters."""

    def __init__(
        self,
        dim: int = 64,
        k: int = 9,
        cluster_codes: Optional[Sequence[str]] = None,
        variance: float = 0.30,
        centroids: Optional[np.ndarray] = None,
        variances: Optional[np.ndarray] = None,
        priors: Optional[np.ndarray] = None,
    ) -> None:
        """Initialize the Soft GMM clusterer.

        Args:
            dim: Dimension of latent space (default: 64).
            k: Number of mixture components (default: 9).
            cluster_codes: Optional list of codes for clusters (default: 'C1'..'CK').
            variance: Default isotropic variance sigma^2 per dimension.
            centroids: Optional pre-calibrated centroids matrix of shape (k, dim).
            variances: Optional diagonal variances array of shape (k, dim) or (k,).
            priors: Optional prior probabilities array of shape (k,).
        """
        self.dim: int = dim
        self.k: int = k

        if cluster_codes is not None:
            if len(cluster_codes) != self.k:
                raise ValueError(
                    f"cluster_codes length ({len(cluster_codes)}) must match k ({self.k})"
                )
            self.cluster_codes: List[str] = [str(c) for c in cluster_codes]
        else:
            self.cluster_codes = [f"C{idx + 1}" for idx in range(self.k)]

        if centroids is not None:
            c = np.asarray(centroids, dtype=np.float64)
            if c.shape != (self.k, self.dim):
                raise ValueError(f"Centroids shape must be ({self.k}, {self.dim}), got {c.shape}")
            self.centroids = c.copy()
        else:
            self.centroids = _create_dynamic_centroids(k=self.k, dim=self.dim)

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
        """Compute log N(x; mu_k, Sigma_k) for all K components."""
        diff = x - self.centroids  # shape (k, dim)
        sq_diff = (diff ** 2) / self.variances  # shape (k, dim)
        mahalanobis = np.sum(sq_diff, axis=1)  # shape (k,)

        log_det = np.sum(np.log(self.variances), axis=1)  # shape (k,)
        const = self.dim * np.log(2.0 * np.pi)

        log_densities = -0.5 * (const + log_det + mahalanobis)
        return log_densities

    def compute_responsibilities(
        self,
        s_bar: Union[np.ndarray, Sequence[float]],
    ) -> Dict[str, float]:
        """Compute soft posterior responsibility probabilities gamma_{t, k} = P(C_k | s_bar).

        Returns:
            Dictionary mapping cluster codes to probabilities summing to 1.0 +/- 1e-5.
        """
        x = np.asarray(s_bar, dtype=np.float64).flatten()
        if x.shape[0] != self.dim:
            raise ValueError(
                f"Dimension mismatch: expected {self.dim}, got {x.shape[0]}"
            )

        log_densities = self._compute_log_likelihoods(x)  # shape (k,)
        log_priors = np.log(np.clip(self.priors, 1e-12, 1.0))
        log_joint = log_priors + log_densities  # shape (k,)

        log_evidence = logsumexp(log_joint)
        log_posterior = log_joint - log_evidence
        posterior = np.exp(log_posterior)

        # Precise normalization guaranteeing sum == 1.0 +/- 1e-5
        total = np.sum(posterior)
        if total > 0.0:
            posterior = posterior / total
        else:
            posterior = np.full(self.k, fill_value=1.0 / self.k)

        # Map to cluster codes
        return {self.cluster_codes[idx]: float(posterior[idx]) for idx in range(self.k)}

    def get_responsibilities_by_id(
        self,
        s_bar: Union[np.ndarray, Sequence[float]],
    ) -> Dict[int, float]:
        """Compute soft responsibilities keyed by 1-based integer cluster id (1..K)."""
        probs_by_code = self.compute_responsibilities(s_bar)
        return {idx + 1: probs_by_code[self.cluster_codes[idx]] for idx in range(self.k)}

    def get_centroid(self, cluster_id: int) -> np.ndarray:
        """Get the prototype centroid vector for a 1-based cluster id (1..K)."""
        if not (1 <= cluster_id <= self.k):
            raise ValueError(f"Cluster id must be between 1 and {self.k}, got {cluster_id}")
        return self.centroids[cluster_id - 1].copy()

    def get_all_centroids(self) -> Dict[int, np.ndarray]:
        """Get all K centroids keyed by 1-based cluster id."""
        return {idx + 1: self.centroids[idx].copy() for idx in range(self.k)}

    def fit(
        self,
        X: np.ndarray,
        k: Optional[int] = None,
        max_iter: int = 100,
        tol: float = 1e-4,
    ) -> "SoftGMMClusterer":
        """Fit or tune mixture parameters from data X of shape (N, dim) using EM.

        Args:
            X: Training latent samples of shape (N, dim).
            k: Optional new number of clusters to fit. If provided, updates self.k.
            max_iter: Maximum EM iterations.
            tol: Convergence tolerance.
        """
        from sklearn.mixture import GaussianMixture

        X_arr = np.asarray(X, dtype=np.float64)
        if X_arr.ndim != 2 or X_arr.shape[1] != self.dim:
            raise ValueError(f"Expected X with shape (N, {self.dim}), got {X_arr.shape}")

        target_k = k if k is not None else self.k
        if target_k <= 0:
            raise ValueError(f"Target k must be >= 1, got {target_k}")
        if X_arr.shape[0] < target_k:
            raise ValueError(f"Need at least {target_k} samples to fit, got {X_arr.shape[0]}")

        gmm = GaussianMixture(
            n_components=target_k,
            covariance_type="diag",
            max_iter=max_iter,
            tol=tol,
            random_state=42,
        )
        gmm.fit(X_arr)

        self.k = target_k
        self.cluster_codes = [f"C{idx + 1}" for idx in range(self.k)]
        self.centroids = gmm.means_.copy()
        self.variances = gmm.covariances_.copy()
        self.priors = gmm.weights_.copy()
        return self

    def save(self, filepath: Union[str, Path]) -> None:
        """Save calibrated GMM clusterer parameters to a JSON file."""
        data = {
            "dim": self.dim,
            "k": self.k,
            "cluster_codes": self.cluster_codes,
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
            k=data["k"],
            cluster_codes=data.get("cluster_codes"),
            centroids=np.array(data["centroids"], dtype=np.float64),
            variances=np.array(data["variances"], dtype=np.float64),
            priors=np.array(data["priors"], dtype=np.float64),
        )
