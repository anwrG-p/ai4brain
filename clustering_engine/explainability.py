"""Centroid Prototype Explainability Decoder (XAI) for Extensible Dimensions.

Calculates projection matrix W_eval in R^{M x d} for arbitrary M cognitive dimensions,
computes prototype differential vectors Delta c = W_eval(mu_target - mu_curr),
identifies dominant drivers, and generates supportive, growth-mindset explanations
with strict non-clinical guardrails (no diagnostic or pathological terminology).
"""

from __future__ import annotations

import re
from typing import Dict, Final, List, Optional, Sequence, Tuple, Union
import numpy as np

from clustering_engine.archetypes import (
    DEFAULT_DIMENSIONS,
    Archetype,
    ArchetypeRegistry,
    format_dimension_phrase,
    get_archetype,
)

# Strict regex matching forbidden clinical/pathological tokens
FORBIDDEN_CLINICAL_REGEX: Final[re.Pattern] = re.compile(
    r"\b(adhd|deficit|deficits|impairment|impairments|pathology|pathologies|"
    r"disorder|disorders|dysfunction|dysfunctions|abnormal|subnormal|retarded|"
    r"clinical|patient|patients|symptom|symptoms|diagnosis|diagnostic|handicap)\b",
    re.IGNORECASE,
)


def validate_non_clinical(text: str) -> None:
    """Validate that text is strictly free of clinical or diagnostic terminology.

    Raises:
        ValueError: If any clinical or diagnostic term is detected.
    """
    match = FORBIDDEN_CLINICAL_REGEX.search(text)
    if match:
        raise ValueError(
            f"Safety guardrail violation: text contains clinical/diagnostic term '{match.group()}'."
        )


def _calibrate_dynamic_projection_matrix(
    dimensions: Sequence[str],
    centroids: Dict[int, np.ndarray],
    dim: int = 64,
    archetype_registry: Optional[ArchetypeRegistry] = None,
) -> np.ndarray:
    """Compute calibrated W_eval in R^{M x dim} mapping centroids to target cognitive deltas."""
    m_dim = len(dimensions)
    k = len(centroids)

    # Centroid matrix M (k, dim)
    M = np.zeros((k, dim), dtype=np.float64)
    # Target profile matrix Y (k, m_dim)
    Y = np.zeros((k, m_dim), dtype=np.float64)

    for idx, (c_id, mu) in enumerate(sorted(centroids.items())):
        M[idx] = mu
        if archetype_registry is not None:
            arch = archetype_registry.get(c_id)
        else:
            arch = get_archetype(c_id)

        for j, dim_name in enumerate(dimensions):
            target_val = arch.target_radar.get(dim_name, 70.0)
            Y[idx, j] = (target_val - 70.0) / 100.0

    # Solve Y = M * W^T via pseudo-inverse: W^T = pinv(M) * Y -> W = Y^T * pinv(M)^T
    pinv_M = np.linalg.pinv(M)
    W_eval = Y.T @ pinv_M.T  # shape (m_dim, dim)

    # If W_eval is all near-zero (e.g., target_radar missing or unaligned), initialize structured projection
    if np.max(np.abs(W_eval)) < 1e-6:
        W_eval = _create_default_w_eval(dimensions, dim)

    return W_eval


def _create_default_w_eval(dimensions: Sequence[str], dim: int = 64) -> np.ndarray:
    """Construct an orthonormal/calibrated projection matrix in R^{M x dim}."""
    m = len(dimensions)
    rng = np.random.RandomState(42)
    # Use QR decomposition for orthonormal rows
    if m <= dim:
        q, _ = np.linalg.qr(rng.randn(dim, m))
        w = (q.T) * 0.35
    else:
        q, _ = np.linalg.qr(rng.randn(m, dim))
        w = q * 0.35
    return w[:m, :dim]


class ExplainabilityDecoder:
    """XAI decoder projecting latent centroids to extensible non-clinical cognitive dimensions."""

    def __init__(
        self,
        dim: int = 64,
        dimensions: Optional[Sequence[str]] = None,
        w_eval: Optional[np.ndarray] = None,
        centroids: Optional[Dict[int, np.ndarray]] = None,
        archetype_registry: Optional[ArchetypeRegistry] = None,
    ) -> None:
        """Initialize ExplainabilityDecoder with extensible cognitive dimensions.

        Args:
            dim: Dimension of latent space (default: 64).
            dimensions: List of cognitive dimensions (default: DEFAULT_DIMENSIONS).
            w_eval: Optional calibrated matrix of shape (len(dimensions), dim).
            centroids: Optional dictionary of centroids for calibration.
            archetype_registry: Optional ArchetypeRegistry instance.
        """
        self.dim = dim
        self.dimensions: Tuple[str, ...] = tuple(dimensions) if dimensions is not None else DEFAULT_DIMENSIONS
        self.archetype_registry = archetype_registry or ArchetypeRegistry.create_default()
        m = len(self.dimensions)

        if w_eval is not None:
            w = np.asarray(w_eval, dtype=np.float64)
            if w.shape != (m, self.dim):
                raise ValueError(f"W_eval must have shape ({m}, {self.dim}), got {w.shape}")
            self.w_eval = w.copy()
        elif centroids is not None and len(centroids) > 0:
            self.w_eval = _calibrate_dynamic_projection_matrix(
                dimensions=self.dimensions,
                centroids=centroids,
                dim=self.dim,
                archetype_registry=self.archetype_registry,
            )
        else:
            self.w_eval = _create_default_w_eval(self.dimensions, self.dim)

    def update_centroids(self, centroids: Dict[int, np.ndarray]) -> None:
        """Dynamically re-calibrate projection matrix W_eval with updated centroids."""
        if centroids and len(centroids) > 0:
            self.w_eval = _calibrate_dynamic_projection_matrix(
                dimensions=self.dimensions,
                centroids=centroids,
                dim=self.dim,
                archetype_registry=self.archetype_registry,
            )

    def project_latent(self, vector: Union[np.ndarray, Sequence[float]]) -> np.ndarray:
        """Project a latent vector into the configured cognitive dimensions.

        Args:
            vector: Latent vector of shape (dim,).

        Returns:
            Projected vector of shape (len(dimensions),).
        """
        v = np.asarray(vector, dtype=np.float64).flatten()
        if v.shape[0] != self.dim:
            raise ValueError(f"Expected vector of dimension {self.dim}, got {v.shape[0]}")
        return self.w_eval @ v

    def compute_delta_vector(
        self,
        from_cluster_id: int,
        to_cluster_id: int,
        centroids: Dict[int, np.ndarray],
    ) -> Dict[str, float]:
        """Compute differential vector Delta c = W_eval * (mu_target - mu_curr).

        Args:
            from_cluster_id: 1-based source cluster ID.
            to_cluster_id: 1-based target cluster ID.
            centroids: Dictionary of centroids for all clusters.

        Returns:
            Dictionary mapping dimension names to differential values rounded to 2 decimals.
        """
        mu_curr = centroids[from_cluster_id]
        mu_target = centroids[to_cluster_id]

        diff = mu_target - mu_curr
        delta_c = self.w_eval @ diff

        delta_dict = {
            dim_name: float(round(delta_c[idx], 2))
            for idx, dim_name in enumerate(self.dimensions)
        }
        return delta_dict

    def identify_dominant_driver(
        self,
        delta_vector: Dict[str, float],
    ) -> Tuple[str, float]:
        """Identify dominant transition driver j* = argmax_j |Delta c_j|.

        Returns:
            Tuple of (dominant_dimension_name, signed_delta_value).
        """
        if not delta_vector:
            raise ValueError("Delta vector cannot be empty.")

        dominant_dim = max(delta_vector, key=lambda k: abs(delta_vector[k]))
        return dominant_dim, delta_vector[dominant_dim]

    def generate_explanation(
        self,
        to_cluster_id: int,
        delta_vector: Dict[str, float],
        dominant_driver: str,
        to_cluster_name: Optional[str] = None,
    ) -> str:
        """Generate non-clinical, growth-oriented explanation for a cluster transition.

        Args:
            to_cluster_id: Destination cluster ID.
            delta_vector: Computed differential vector.
            dominant_driver: Name of dominant cognitive dimension.
            to_cluster_name: Optional explicit name of the target cluster.

        Returns:
            Supportive explanation string validated against non-clinical guardrails.
        """
        target_archetype = self.archetype_registry.get(to_cluster_id)
        cluster_name = to_cluster_name or target_archetype.name

        driver_val = delta_vector.get(dominant_driver, 0.0)
        driver_pct = int(round(abs(driver_val) * 100))

        dim_desc = format_dimension_phrase(dominant_driver)
        pacing_phrase = target_archetype.pacing_strategy.lower()
        if "pacing" not in pacing_phrase:
            pacing_phrase = f"{pacing_phrase} pacing"

        if driver_val > 0.005 and driver_pct > 0:
            explanation = (
                f"Shifted to {cluster_name} due to a {driver_pct}% increase in "
                f"{dim_desc} and {pacing_phrase}."
            )
        elif driver_val < -0.005:
            explanation = (
                f"Shifted to {cluster_name} with streamlined {dim_desc} "
                f"calibrating toward {pacing_phrase}."
            )
        else:
            explanation = (
                f"Shifted to {cluster_name} with balanced {dim_desc} "
                f"calibrating toward {pacing_phrase}."
            )

        # Enforce non-clinical guardrail
        validate_non_clinical(explanation)
        return explanation

    def compute_radar_scores(
        self,
        s_bar: Union[np.ndarray, Sequence[float]],
        responsibilities: Optional[Dict[str, float]] = None,
    ) -> Dict[str, float]:
        """Compute 0-100 radar scores for all configured cognitive dimensions.

        Smoothly blends archetype target profiles based on soft responsibilities
        gamma_{t, k}, ensuring continuity across archetype boundaries.
        """
        if responsibilities is not None:
            scores = {dim: 0.0 for dim in self.dimensions}
            has_targets = False

            for code, prob in responsibilities.items():
                digits = "".join(ch for ch in str(code) if ch.isdigit())
                if digits:
                    cluster_id = int(digits)
                else:
                    try:
                        cluster_id = self.archetype_registry.get_by_code(str(code)).id
                    except Exception:
                        cluster_id = 1
                arch = self.archetype_registry.get(cluster_id)
                for dim in self.dimensions:
                    if dim in arch.target_radar:
                        scores[dim] += prob * arch.target_radar[dim]
                        has_targets = True
                    else:
                        scores[dim] += prob * 70.0

            if has_targets:
                return {dim: float(round(scores[dim], 1)) for dim in self.dimensions}

        # Fallback to direct linear projection
        proj = self.project_latent(s_bar)
        scores = {}
        for idx, dim in enumerate(self.dimensions):
            val = 70.0 + proj[idx] * 100.0
            scores[dim] = float(round(np.clip(val, 0.0, 100.0), 1))
        return scores

    def compute_uncertainty_band(
        self,
        responsibilities: Union[Dict[str, float], Dict[int, float]],
    ) -> float:
        """Compute uncertainty band scalar from posterior entropy across arbitrary K clusters."""
        probs = np.array(list(responsibilities.values()), dtype=np.float64)
        probs = np.clip(probs, 1e-12, 1.0)
        entropy = -float(np.sum(probs * np.log(probs)))
        k = max(2, len(probs))
        max_entropy = np.log(k)

        normalized_entropy = float(entropy / max_entropy)
        uncertainty = 3.0 + 8.5 * normalized_entropy
        return float(round(uncertainty, 1))
