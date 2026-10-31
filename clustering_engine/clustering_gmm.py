"""GMM practice profiles (README Member 3: K = 9 archetypes, soft posteriors gamma_k).

The mixture is fitted on any [n, d] array: the 5 pillar scores (the default view) or a latent such
as BE-10's. Clusters describe how someone practises (which skills lead in their scores). They are
never emotional or clinical states (research item 8), and their names are plain consumer words.

Determinism: the same X, k and seed give the same model, component order and names.
"""

from __future__ import annotations

import hashlib
import json
import warnings
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import scipy
import sklearn
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
    """The consumer name of archetype id `k` (0..8)."""
    if not 0 <= k < len(ARCHETYPE_NAMES):
        raise ValueError(f"archetype id must be in 0..{len(ARCHETYPE_NAMES) - 1}")
    return ARCHETYPE_NAMES[k]


@dataclass
class ClusterModel:
    """A fitted mixture over standardised features. Named components come first, sorted by
    archetype id; unnamed ones follow, largest first."""

    gmm: GaussianMixture
    center: np.ndarray  # feature means the inputs are standardised with
    scale: np.ndarray  # feature SDs (1 where a feature is constant)
    k_requested: int
    seed: int
    # Archetype id per component (None for a component no prototype fits), or None for the whole
    # list when no pillar view was available to name them.
    archetype_ids: list[int | None] | None = None
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

    @property
    def model_id(self) -> str:
        """A hash of the fitted parameters. Component indices only mean something within one
        model_id: BE-11 must store it with each user's HysteresisGate state and reset the gate
        when the served model's id differs."""
        blob = json.dumps(self._params(), sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]

    def name(self, component: int) -> str:
        aid = None if self.archetype_ids is None else self.archetype_ids[component]
        return f"Profile {component + 1}" if aid is None else archetype_name(aid)

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

    def _params(self) -> dict:
        g = self.gmm
        return {
            "k": self.k,
            "k_requested": self.k_requested,
            "seed": self.seed,
            "covariance_type": g.covariance_type,
            "features": list(self.features),
            "archetype_ids": self.archetype_ids,
            "center": self.center.tolist(),
            "scale": self.scale.tolist(),
            "weights": g.weights_.tolist(),
            "means": g.means_.tolist(),
            "covariances": g.covariances_.tolist(),
            "precisions_cholesky": g.precisions_cholesky_.tolist(),
        }

    def to_dict(self) -> dict:
        return {
            "model_id": self.model_id,
            "versions": library_versions(),
            "names": [self.name(i) for i in range(self.k)],
            **self._params(),
        }

    @classmethod
    def from_dict(cls, d: dict) -> "ClusterModel":
        """Rebuilds a saved model. Raises ValueError on any malformed or inconsistent field
        (including a model_id that does not match the parameters), and warns (UserWarning) when
        the model was saved under other library versions."""
        a = _validate(d)
        g = GaussianMixture(n_components=a["k"], covariance_type=d["covariance_type"])
        g.weights_ = a["weights"]
        g.means_ = a["means"]
        g.covariances_ = a["covariances"]
        g.precisions_cholesky_ = a["precisions_cholesky"]
        g.precisions_ = _precisions(g.precisions_cholesky_, g.covariance_type)
        g.converged_ = True
        g.n_features_in_ = g.means_.shape[1]
        model = cls(
            gmm=g,
            center=a["center"],
            scale=a["scale"],
            k_requested=d["k_requested"],
            seed=d["seed"],
            archetype_ids=None if d["archetype_ids"] is None else list(d["archetype_ids"]),
            features=list(d["features"]),
        )
        if "model_id" in d and d["model_id"] != model.model_id:
            raise ValueError("model_id does not match the parameters")
        saved = d.get("versions")
        if saved != library_versions():
            warnings.warn(
                f"clustering model saved with {saved}, loaded with {library_versions()}",
                UserWarning,
                stacklevel=2,
            )
        return model

    def save(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=1) + "\n", encoding="utf-8", newline="\n")
        return path

    @classmethod
    def load(cls, path: str | Path) -> "ClusterModel":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))


def library_versions() -> dict[str, str]:
    return {"numpy": np.__version__, "scikit-learn": sklearn.__version__, "scipy": scipy.__version__}


COVARIANCE_TYPES = ("full", "tied", "diag", "spherical")
_REQUIRED = ("k", "k_requested", "seed", "covariance_type", "features", "archetype_ids", "center",
             "scale", "weights", "means", "covariances", "precisions_cholesky")


def _array(d: dict, key: str, shape: tuple[int, ...]) -> np.ndarray:
    try:
        a = np.array(d[key], dtype=float)
    except (TypeError, ValueError) as e:
        raise ValueError(f"{key} is not a numeric array") from e
    if a.shape != shape:
        raise ValueError(f"{key} has shape {a.shape}, expected {shape}")
    if not np.isfinite(a).all():
        raise ValueError(f"{key} is not finite")
    return a


def _int(d: dict, key: str, minimum: int) -> int:
    v = d[key]
    if isinstance(v, bool) or not isinstance(v, int) or v < minimum:
        raise ValueError(f"{key} must be an integer >= {minimum}")
    return v


def _validate(d) -> dict:
    """Checks a saved model's fields and their consistency; returns its arrays."""
    if not isinstance(d, dict):
        raise ValueError("model must be a JSON object")
    missing = [key for key in _REQUIRED if key not in d]
    if missing:
        raise ValueError(f"missing fields: {missing}")
    cov_type = d["covariance_type"]
    if cov_type not in COVARIANCE_TYPES:
        raise ValueError(f"covariance_type must be one of {COVARIANCE_TYPES}")
    k = _int(d, "k", 1)
    _int(d, "k_requested", 1)
    _int(d, "seed", 0)
    means = d["means"]
    if not isinstance(means, list) or len(means) != k or not means or not isinstance(means[0], list) or not means[0]:
        raise ValueError(f"means must be [k={k}, d]")
    dim = len(means[0])
    a = {
        "k": k,
        "means": _array(d, "means", (k, dim)),
        "center": _array(d, "center", (dim,)),
        "scale": _array(d, "scale", (dim,)),
        "weights": _array(d, "weights", (k,)),
    }
    if (a["scale"] <= 0).any():
        raise ValueError("scale must be > 0")
    if (a["weights"] < 0).any() or abs(a["weights"].sum() - 1.0) > 1e-6:
        raise ValueError("weights must be >= 0 and sum to 1")
    shape = {"full": (k, dim, dim), "tied": (dim, dim), "diag": (k, dim), "spherical": (k,)}[cov_type]
    a["covariances"] = _array(d, "covariances", shape)
    a["precisions_cholesky"] = _array(d, "precisions_cholesky", shape)
    ids = d["archetype_ids"]
    if ids is not None:
        named = [i for i in ids if i is not None] if isinstance(ids, list) else None
        if (
            named is None
            or len(ids) != k
            or any(isinstance(i, bool) or not isinstance(i, int) or not 0 <= i < len(ARCHETYPE_NAMES) for i in named)
            or len(set(named)) != len(named)
        ):
            raise ValueError(f"archetype_ids must be null or {k} distinct ids in 0..{len(ARCHETYPE_NAMES) - 1} (or nulls)")
    features = d["features"]
    if not isinstance(features, list) or not all(isinstance(f, str) for f in features) or len(features) not in (0, dim):
        raise ValueError(f"features must be empty or {dim} names")
    return a


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
    - Names: components are matched one-to-one to archetype prototypes on their pillar profile
      (see _assign_archetypes); one that fits no prototype stays "Profile N". The pillar profile
      is X itself when d == 5, else `pillars` ([n, 5], e.g. the pillar scores behind a latent),
      else every component stays unnamed.
    - `features`, when given, names the d columns.
    """
    X = np.asarray(X, dtype=float)
    if X.ndim != 2 or X.shape[0] == 0 or X.shape[1] == 0:
        raise ValueError("X must be a non-empty [n, d] array")
    if not np.isfinite(X).all():
        raise ValueError("X must be finite")
    if k < 1:
        raise ValueError("k must be >= 1")
    n, d = X.shape
    if features is not None and len(features) != d:
        raise ValueError(f"features has {len(features)} names for {d} columns")
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
        assigned = _assign_archetypes(gmm.predict_proba(Z), P)
        # Named components by archetype id, then unnamed ones in canonical order.
        unnamed = [i for i in _canonical_order(gmm) if assigned[i] is None]
        order = np.array(sorted((i for i in range(k_eff) if assigned[i] is not None), key=lambda i: assigned[i]) + unnamed)
        ids = [assigned[i] for i in order]
    else:
        order = _canonical_order(gmm)
    _reorder(gmm, order)
    return ClusterModel(
        gmm=gmm,
        center=center,
        scale=scale,
        k_requested=k,
        seed=seed,
        archetype_ids=ids,
        features=list(features) if features is not None else (list(PILLARS) if d == len(PILLARS) else []),
    )


# Naming thresholds (judgement, not evidence). A profile is shrunk to at most PROFILE_CAP SDs so
# a very pronounced cluster is named by its shape (an all-low cluster 3 SDs out is still "Fresh
# starter"); a component whose capped profile is more than MAX_NAME_COST (squared SDs) from its
# matched prototype keeps no name and shows as "Profile N".
PROFILE_CAP = 1.5
MAX_NAME_COST = 1.0


def _assign_archetypes(gamma: np.ndarray, P: np.ndarray) -> list[int | None]:
    """Archetype id (or None) per component: Hungarian match of each component's pillar profile
    (its responsibility-weighted mean, in SDs from everyone's mean, capped at PROFILE_CAP) to the
    prototypes. Pairs costing more than MAX_NAME_COST are priced out first, so the match names as
    many components as it can within the threshold; the rest, and components past the nine, get
    None."""
    mass = gamma.sum(axis=0)
    mass[mass == 0] = 1.0
    sd = P.std(axis=0)
    sd[sd == 0] = 1.0
    profile = ((gamma.T @ P) / mass[:, None] - P.mean(axis=0)) / sd
    norm = np.linalg.norm(profile, axis=1, keepdims=True)
    profile = profile * np.minimum(1.0, PROFILE_CAP / np.maximum(norm, 1e-12))
    cost = ((profile[:, None, :] - _PROTOTYPES[None, :, :]) ** 2).sum(axis=2)
    priced = np.where(cost <= MAX_NAME_COST, cost, 1e6)
    ids: list[int | None] = [None] * gamma.shape[1]
    for row, col in zip(*linear_sum_assignment(priced)):
        if cost[row, col] <= MAX_NAME_COST:
            ids[int(row)] = int(col)
    return ids


def _canonical_order(gmm: GaussianMixture) -> np.ndarray:
    """Largest component first, ties by centroid."""
    return np.lexsort((*gmm.means_.T[::-1], -gmm.weights_))


def _reorder(gmm: GaussianMixture, order: np.ndarray) -> None:
    gmm.weights_ = gmm.weights_[order]
    gmm.means_ = gmm.means_[order]
    if gmm.covariance_type != "tied":
        gmm.covariances_ = gmm.covariances_[order]
        gmm.precisions_cholesky_ = gmm.precisions_cholesky_[order]
        gmm.precisions_ = gmm.precisions_[order]
