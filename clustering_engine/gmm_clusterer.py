"""Soft Gaussian Mixture Model (GMM) Clustering for Cognitive Archetypes.

Evaluates soft posterior responsibilities gamma_{t,k} = P(C_k | s_bar_t)
over a d-dimensional latent space for dynamic K cognitive archetypes.
Supports dynamic online centroid adaptation, dynamic centroid addition,
affinity-based novelty scoring, and automatic K discovery via BIC.
Uses log-sum-exp stabilization to guarantee numerical bounds and that
responsibilities sum to 1.0 +/- 1e-5.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple, Union

import numpy as np
from scipy.special import logsumexp
from sklearn.mixture import GaussianMixture


def _create_dynamic_centroids(k: int = 9, dim: int = 64, seed: int = 42) -> np.ndarray:
    """Generate deterministic, calibrated orthonormal prototype centroids in R^dim for any K.

    Uses QR decomposition to guarantee orthogonality, then scales and normalizes.
    """
    if k < 0:
        raise ValueError(f"k must be >= 0, got {k}")
    if k == 0:
        return np.empty((0, dim), dtype=np.float64)
    if dim <= 0:
        raise ValueError(f"dim must be >= 1, got {dim}")

    rng = np.random.RandomState(seed)
    # Generate random matrix and perform QR decomposition for an orthonormal basis
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
        seed: Optional[int] = 42,
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
            seed: Random seed for initialization (default: 42).
        """
        self.dim: int = dim
        self.k: int = k
        self.seed: Optional[int] = seed

        if self.k == 0:
            self.cluster_codes: List[str] = []
            self.centroids = np.empty((0, self.dim), dtype=np.float64)
            self.variances = np.empty((0, self.dim), dtype=np.float64)
            self.priors = np.empty((0,), dtype=np.float64)
            return

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
            self.centroids = _create_dynamic_centroids(k=self.k, dim=self.dim, seed=self.seed or 42)

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

    @property
    def means(self) -> np.ndarray:
        """Alias for self.centroids matching scikit-learn convention."""
        return self.centroids

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
        if self.k == 0:
            return {}

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

    def predict_proba(
        self,
        s_bar: Union[np.ndarray, Sequence[float]],
    ) -> np.ndarray:
        """Compute soft posterior probabilities as a 1D numpy array."""
        if self.k == 0:
            return np.empty((0,), dtype=np.float64)
        resps = self.compute_responsibilities(s_bar)
        return np.array([resps[code] for code in self.cluster_codes], dtype=np.float64)

    def compute_max_affinity(
        self,
        s_bar: Union[np.ndarray, Sequence[float]],
    ) -> float:
        """Compute maximum normalized likelihood affinity in [0, 1] across all clusters.

        Returns:
            Affinity score where 1.0 indicates exact centroid match and ~0.0 indicates an outlier.
        """
        if self.k == 0:
            return 0.0
        x = np.asarray(s_bar, dtype=np.float64).flatten()
        if x.shape[0] != self.dim:
            raise ValueError(f"Dimension mismatch: expected {self.dim}, got {x.shape[0]}")
        diff = x - self.centroids  # shape (k, dim)
        sq_dist_norm = np.mean((diff ** 2) / self.variances, axis=1)  # shape (k,)
        affinities = np.exp(-0.5 * sq_dist_norm)
        return float(np.max(affinities))

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

    def update_online(
        self,
        s_bar: Union[np.ndarray, Sequence[float]],
        lr: float = 0.02,
        responsibilities: Optional[Union[Dict[str, float], Sequence[float], np.ndarray]] = None,
        normalize: bool = False,
    ) -> np.ndarray:
        """Dynamically update centroid positions online based on observed state.

        Performs soft stochastic gradient / EM centroid update:
            mu_k <- mu_k + lr * gamma_{t, k} * (s_bar - mu_k)

        Args:
            s_bar: Smoothed observation vector of shape (dim,).
            lr: Online adaptation learning rate in (0.0, 1.0].
            responsibilities: Optional pre-computed responsibilities.
            normalize: If True, project updated centroids onto the unit sphere.

        Returns:
            Updated centroids matrix of shape (k, dim).
        """
        x = np.asarray(s_bar, dtype=np.float64).flatten()
        if x.shape[0] != self.dim:
            raise ValueError(f"Dimension mismatch: expected {self.dim}, got {x.shape[0]}")
        if not np.all(np.isfinite(x)):
            raise ValueError("Input vector must contain only finite numbers.")

        if responsibilities is None:
            probs_dict = self.compute_responsibilities(x)
            probs = [probs_dict[code] for code in self.cluster_codes]
        elif isinstance(responsibilities, dict):
            probs = [responsibilities.get(code, 0.0) for code in self.cluster_codes]
        else:
            probs = list(responsibilities)

        lr_clamped = float(np.clip(lr, 1e-4, 1.0))
        for idx in range(self.k):
            gamma_k = probs[idx] if idx < len(probs) else 0.0
            if gamma_k > 1e-5:
                diff = x - self.centroids[idx]
                self.centroids[idx] += lr_clamped * gamma_k * diff
                if normalize:
                    norm = np.linalg.norm(self.centroids[idx])
                    if norm > 1e-12:
                        self.centroids[idx] = self.centroids[idx] / norm

        return self.centroids.copy()

    def add_centroid(
        self,
        new_centroid: Union[np.ndarray, Sequence[float]],
        code: Optional[str] = None,
        variance: Optional[Union[float, Sequence[float]]] = None,
        prior: Optional[float] = None,
        normalize: bool = False,
    ) -> int:
        """Dynamically register a new cluster centroid, growing K by 1.

        Args:
            new_centroid: Vector of shape (dim,) representing the new centroid.
            code: Optional cluster code name (default: f"C{self.k + 1}").
            variance: Optional diagonal variance (defaults to average existing variance).
            prior: Optional prior probability for the new component.
            normalize: If True, normalize new centroid vector before storing.

        Returns:
            1-based integer ID of the newly added cluster.
        """
        c = np.asarray(new_centroid, dtype=np.float64).flatten()
        if c.shape[0] != self.dim:
            raise ValueError(f"Dimension mismatch: expected {self.dim}, got {c.shape[0]}")
        if not np.all(np.isfinite(c)):
            raise ValueError("Centroid vector must contain only finite numbers.")

        if normalize:
            norm = np.linalg.norm(c)
            if norm > 1e-12:
                c = c / norm

        if self.k == 0:
            new_centroids = c[None, :]
            new_code = code if code is not None else "C1"
            new_codes = [new_code]
            if variance is not None:
                v = np.asarray(variance, dtype=np.float64).flatten()
                new_var_row = np.full((1, self.dim), fill_value=v[0]) if v.shape[0] == 1 else v[None, :]
            else:
                new_var_row = np.full((1, self.dim), fill_value=0.30)
            new_variances = new_var_row
            new_priors = np.array([1.0], dtype=np.float64)
        else:
            new_centroids = np.vstack([self.centroids, c[None, :]])
            new_code = code if code is not None else f"C{self.k + 1}"
            new_codes = list(self.cluster_codes) + [new_code]

            if variance is not None:
                v = np.asarray(variance, dtype=np.float64).flatten()
                if v.shape[0] == 1:
                    new_var_row = np.full((1, self.dim), fill_value=v[0])
                elif v.shape[0] == self.dim:
                    new_var_row = v[None, :]
                else:
                    raise ValueError(f"Variance shape mismatch: expected 1 or {self.dim}, got {v.shape[0]}")
            else:
                avg_var = float(np.mean(self.variances))
                new_var_row = np.full((1, self.dim), fill_value=avg_var)
            new_variances = np.vstack([self.variances, new_var_row])

            if prior is not None:
                new_p = float(np.clip(prior, 1e-4, 0.5))
                scaled_priors = self.priors * (1.0 - new_p)
                new_priors = np.append(scaled_priors, new_p)
            else:
                new_priors = np.append(self.priors, 1.0 / (self.k + 1))
                new_priors = new_priors / np.sum(new_priors)

        self.k += 1
        self.centroids = new_centroids
        self.cluster_codes = new_codes
        self.variances = new_variances
        self.priors = new_priors
        return self.k

    def discover_optimal_k(
        self,
        X: np.ndarray,
        k_min: int = 2,
        k_max: int = 12,
        max_iter: int = 100,
        tol: float = 1e-4,
    ) -> int:
        """Dynamically determine optimal number of centroids K from data using BIC.

        Fits candidate GMMs across k in [k_min, min(k_max, N-1)] and selects k
        minimizing the Bayesian Information Criterion (BIC).

        Args:
            X: Sample data of shape (N, dim).
            k_min: Minimum number of candidate clusters (default: 2).
            k_max: Maximum number of candidate clusters (default: 12).
            max_iter: Maximum EM iterations per candidate.
            tol: EM convergence tolerance.

        Returns:
            The discovered optimal number of clusters K.
        """
        X_arr = np.asarray(X, dtype=np.float64)
        if X_arr.ndim != 2 or X_arr.shape[1] != self.dim:
            raise ValueError(f"Expected X with shape (N, {self.dim}), got {X_arr.shape}")

        n_samples = X_arr.shape[0]
        upper_k = min(k_max, n_samples - 1)
        if upper_k < k_min:
            upper_k = max(k_min, min(n_samples, k_max))

        best_bic = float("inf")
        best_k = self.k
        best_model = None

        for cand_k in range(k_min, upper_k + 1):
            if n_samples < cand_k:
                continue
            model = GaussianMixture(
                n_components=cand_k,
                covariance_type="diag",
                max_iter=max_iter,
                tol=tol,
                random_state=42,
            )
            model.fit(X_arr)
            bic = model.bic(X_arr)
            if bic < best_bic:
                best_bic = bic
                best_k = cand_k
                best_model = model

        if best_model is not None:
            self.k = best_k
            self.cluster_codes = [f"C{idx + 1}" for idx in range(self.k)]
            self.centroids = best_model.means_.copy()
            self.variances = best_model.covariances_.copy()
            self.priors = best_model.weights_.copy()

        return self.k

    def fit(
        self,
        X: np.ndarray,
        k: Optional[int] = None,
        max_iter: int = 100,
        tol: float = 1e-4,
    ) -> "SoftGMMClusterer":
        """Fit or tune mixture parameters from data X of shape (N, dim) using EM."""
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

    def save_parameters(self, path: Union[str, Path]) -> None:
        """Export dynamic GMM parameters to JSON."""
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "dim": self.dim,
            "k": self.k,
            "cluster_codes": self.cluster_codes,
            "centroids": self.centroids.tolist(),
            "variances": self.variances.tolist(),
            "priors": self.priors.tolist(),
        }
        with open(target, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)

    def save(self, path: Union[str, Path]) -> None:
        """Alias for save_parameters."""
        self.save_parameters(path)

    @classmethod
    def load_parameters(cls, path: Union[str, Path]) -> "SoftGMMClusterer":
        """Instantiate clusterer from saved parameters JSON file."""
        target = Path(path)
        with open(target, "r", encoding="utf-8") as fh:
            data = json.load(fh)

        instance = cls(
            dim=data["dim"],
            k=data["k"],
            cluster_codes=data["cluster_codes"],
            centroids=np.array(data["centroids"], dtype=np.float64),
            variances=np.array(data["variances"], dtype=np.float64),
            priors=np.array(data["priors"], dtype=np.float64),
        )
        return instance

    @classmethod
    def load(cls, path: Union[str, Path]) -> "SoftGMMClusterer":
        """Alias for load_parameters."""
        return cls.load_parameters(path)
