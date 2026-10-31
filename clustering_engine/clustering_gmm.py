"""GMM practice profiles (README Member 3: K = 9 archetypes, soft posteriors gamma_k).

The mixture is fitted on any [n, d] array: the 5 pillar scores (the default view) or a latent such
as BE-10's. Clusters describe how someone practises (which skills lead in their scores). They are
never emotional or clinical states (research item 8), and their names are plain consumer words.

Determinism: the same X, k and seed give the same model, component order and names.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from scipy.optimize import linear_sum_assignment
from sklearn.mixture import GaussianMixture

PILLARS = ("focus", "agility", "impulse", "memory", "visual")
DEFAULT_K = 9
DEFAULT_SEED = 0

# Archetype id -> (name, prototype). A prototype is the cluster's pillar profile relative to
# everyone's, in standard deviations, in PILLARS order. Names describe a practice style only.
_ARCHETYPES: tuple[tuple[str, tuple[float, ...]], ...] = (
    ("Steady planner", (1.0, 0, 0, 0, 0)),
    ("Nimble switcher", (0, 1.0, 0, 0, 0)),
    ("Careful checker", (0, 0, 1.0, 0, 0)),
    ("Keen recaller", (0, 0, 0, 1.0, 0)),
    ("Quick spotter", (0, 0, 0, 0, 1.0)),
    ("All-rounder", (0.75,) * 5),
    ("Fresh starter", (-0.75,) * 5),
    ("Balanced builder", (0.0,) * 5),
    ("Methodical solver", (0.7, 0, 0.7, 0, 0)),
)
ARCHETYPE_NAMES: tuple[str, ...] = tuple(name for name, _ in _ARCHETYPES)
_PROTOTYPES = np.array([proto for _, proto in _ARCHETYPES], dtype=float)


def archetype_name(k: int) -> str:
    """The consumer name of archetype id `k`. Ids past the named nine are plain numbered profiles."""
    if k < 0:
        raise ValueError("archetype id must be >= 0")
    return ARCHETYPE_NAMES[k] if k < len(ARCHETYPE_NAMES) else f"Profile {k + 1}"


@dataclass
class ClusterModel:
    """A fitted mixture over standardised features, components sorted by archetype id."""

    gmm: GaussianMixture
    center: np.ndarray  # feature means the inputs are standardised with
    scale: np.ndarray  # feature SDs (1 where a feature is constant)
    k_requested: int
    seed: int
    # Archetype id per component, or None when no pillar view was available to name them.
    archetype_ids: list[int] | None = None
    features: list[str] = field(default_factory=list)

    @property
    def k(self) -> int:
        return int(self.gmm.n_components)

    @property
    def weights(self) -> np.ndarray:
        return self.gmm.weights_

    @property
    def means(self) -> np.ndarray:
        """Component centroids mu_k in the input's units ([k, d])."""
        return self.gmm.means_ * self.scale + self.center

    def name(self, component: int) -> str:
        if self.archetype_ids is None:
            return f"Profile {component + 1}"
        return archetype_name(self.archetype_ids[component])

    def posteriors(self, x) -> np.ndarray:
        """gamma_k = P(C_k | x): [k] for one vector, [n, k] for a batch. Each row sums to 1."""
        x = np.asarray(x, dtype=float)
        single = x.ndim == 1
        z = (np.atleast_2d(x) - self.center) / self.scale
        if z.shape[1] != self.center.shape[0]:
            raise ValueError(f"expected {self.center.shape[0]} features, got {z.shape[1]}")
        gamma = self.gmm.predict_proba(z)
        return gamma[0] if single else gamma

    # --- persistence (JSON, not pickle: readable and safe to load) -----------------------------

    def to_dict(self) -> dict:
        g = self.gmm
        return {
            "k": self.k,
            "k_requested": self.k_requested,
            "seed": self.seed,
            "covariance_type": g.covariance_type,
            "features": self.features,
            "archetype_ids": self.archetype_ids,
            "names": [self.name(i) for i in range(self.k)],
            "center": self.center.tolist(),
            "scale": self.scale.tolist(),
            "weights": g.weights_.tolist(),
            "means": g.means_.tolist(),
            "covariances": g.covariances_.tolist(),
            "precisions_cholesky": g.precisions_cholesky_.tolist(),
        }

    @classmethod
    def from_dict(cls, d: dict) -> "ClusterModel":
        g = GaussianMixture(n_components=d["k"], covariance_type=d["covariance_type"])
        g.weights_ = np.array(d["weights"])
        g.means_ = np.array(d["means"])
        g.covariances_ = np.array(d["covariances"])
        g.precisions_cholesky_ = np.array(d["precisions_cholesky"])
        g.precisions_ = _precisions(g.precisions_cholesky_, g.covariance_type)
        g.converged_ = True
        g.n_features_in_ = g.means_.shape[1]
        return cls(
            gmm=g,
            center=np.array(d["center"]),
            scale=np.array(d["scale"]),
            k_requested=d["k_requested"],
            seed=d["seed"],
            archetype_ids=d["archetype_ids"],
            features=d["features"],
        )

    def save(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=1) + "\n", encoding="utf-8", newline="\n")
        return path

    @classmethod
    def load(cls, path: str | Path) -> "ClusterModel":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))


def _precisions(chol: np.ndarray, covariance_type: str) -> np.ndarray:
    if covariance_type == "full":
        return np.einsum("kij,klj->kil", chol, chol)
    if covariance_type == "tied":
        return chol @ chol.T
    return chol**2  # diag, spherical


def posteriors(x, model: ClusterModel) -> np.ndarray:
    """gamma_k for `x` under `model` (see ClusterModel.posteriors)."""
    return model.posteriors(x)


def fit_gmm(
    X,
    k: int = DEFAULT_K,
    seed: int = DEFAULT_SEED,
    *,
    pillars=None,
    features: list[str] | None = None,
    covariance_type: str = "full",
    n_init: int = 3,
) -> ClusterModel:
    """Fits a k-component GMM on X [n, d] (standardised per column).

    - k defaults to 9; with fewer distinct rows than k it degrades to one component per distinct row.
    - Names: components are matched one-to-one to archetype prototypes on their pillar profile.
      The pillar profile is X itself when d == 5, else `pillars` ([n, 5], e.g. the pillar scores
      behind a latent), else the components stay unnamed ("Profile 1"...).
    """
    X = np.asarray(X, dtype=float)
    if X.ndim != 2 or X.shape[0] == 0 or X.shape[1] == 0:
        raise ValueError("X must be a non-empty [n, d] array")
    if not np.isfinite(X).all():
        raise ValueError("X must be finite")
    if k < 1:
        raise ValueError("k must be >= 1")
    n, d = X.shape
    k_eff = min(k, len(np.unique(X, axis=0)))

    center = X.mean(axis=0)
    scale = X.std(axis=0)
    scale[scale == 0] = 1.0
    Z = (X - center) / scale
    # sklearn needs 2 samples; doubling a single row leaves the one-component fit unchanged.
    Z_fit = np.repeat(Z, 2, axis=0) if n == 1 else Z
    gmm = GaussianMixture(
        n_components=k_eff,
        covariance_type=covariance_type,
        reg_covar=1e-3,  # standardised units: keeps tiny clusters (n < k) well-posed
        n_init=n_init,
        max_iter=500,
        random_state=seed,
    ).fit(Z_fit)

    if pillars is None and d == len(PILLARS):
        pillars = X
    ids = None
    if pillars is not None:
        P = np.asarray(pillars, dtype=float)
        if P.shape != (n, len(PILLARS)):
            raise ValueError(f"pillars must be [n, {len(PILLARS)}]")
        ids = _assign_archetypes(gmm.predict_proba(Z), P)
        order = np.argsort(ids, kind="stable")
        ids = [int(ids[i]) for i in order]
    else:
        # Unnamed: largest component first, ties by centroid, so the order is still canonical.
        order = np.lexsort((*gmm.means_.T[::-1], -gmm.weights_))
    _reorder(gmm, order)
    return ClusterModel(
        gmm=gmm,
        center=center,
        scale=scale,
        k_requested=k,
        seed=seed,
        archetype_ids=ids,
        features=list(features) if features else (list(PILLARS) if d == len(PILLARS) else []),
    )


def _assign_archetypes(gamma: np.ndarray, P: np.ndarray) -> np.ndarray:
    """Archetype id per component: Hungarian match of each component's pillar profile (its
    responsibility-weighted mean, in SDs from everyone's mean) to the prototypes. Components past
    the nine prototypes get ids 9, 10... in component order."""
    mass = gamma.sum(axis=0)
    mass[mass == 0] = 1.0
    sd = P.std(axis=0)
    sd[sd == 0] = 1.0
    profile = ((gamma.T @ P) / mass[:, None] - P.mean(axis=0)) / sd
    cost = ((profile[:, None, :] - _PROTOTYPES[None, :, :]) ** 2).sum(axis=2)
    rows, cols = linear_sum_assignment(cost)
    ids = np.full(gamma.shape[1], -1)
    ids[rows] = cols
    extra = np.flatnonzero(ids < 0)
    ids[extra] = len(_PROTOTYPES) + np.arange(len(extra))
    return ids


def _reorder(gmm: GaussianMixture, order: np.ndarray) -> None:
    gmm.weights_ = gmm.weights_[order]
    gmm.means_ = gmm.means_[order]
    if gmm.covariance_type != "tied":
        gmm.covariances_ = gmm.covariances_[order]
        gmm.precisions_cholesky_ = gmm.precisions_cholesky_[order]
        gmm.precisions_ = gmm.precisions_[order]
