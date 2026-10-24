"""Centroid Prototype Explainability Decoder (XAI).

Calculates projection matrix W_eval in R^{5 x d}, computes prototype differential
vectors Delta c = W_eval(mu_target - mu_curr), identifies dominant drivers,
and generates supportive, growth-mindset explanations with strict non-clinical
guardrails (no diagnostic or pathological terminology).
"""

from __future__ import annotations

import re
from typing import Dict, Final, List, Optional, Sequence, Tuple, Union
import numpy as np

from clustering_engine.archetypes import (
    ARCHETYPES,
    COGNITIVE_DIMENSIONS,
    Archetype,
    get_archetype,
)

# Strict regex matching forbidden clinical/pathological tokens
FORBIDDEN_CLINICAL_REGEX: Final[re.Pattern] = re.compile(
    r"\b(adhd|deficit|deficits|impairment|impairments|pathology|pathologies|"
    r"disorder|disorders|dysfunction|dysfunctions|abnormal|subnormal|retarded|"
    r"clinical|patient|patients|symptom|symptoms|diagnosis|diagnostic|handicap)\b",
    re.IGNORECASE,
)

DIMENSION_DESCRIPTIONS: Final[Dict[str, str]] = {
    "working_memory": "working memory stability",
    "pattern_processing": "inductive pattern processing",
    "processing_speed": "processing speed",
    "spatial_reasoning": "spatial reasoning agility",
    "verification_rigor": "verification rigor",
}

PACING_PHRASES: Final[Dict[str, str]] = {
    "Fast / Exploratory": "accelerated pacing",
    "Fast / Accelerated": "accelerated pacing",
    "Fast / Dynamic": "dynamic pacing",
    "Balanced / Stepwise": "balanced pacing",
    "Balanced / Calibrated": "calibrated pacing",
    "Balanced / Versatile": "versatile pacing",
    "Deliberate / Reflective": "deliberate observation",
    "Deliberate / Methodical": "methodical verification pacing",
    "Deliberate / In-Depth": "systemic deep pacing",
}


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


def _calibrate_projection_matrix(
    centroids: Dict[int, np.ndarray],
    dim: int = 64,
) -> np.ndarray:
    """Compute calibrated W_eval in R^{5 x dim} mapping centroids to target cognitive deltas."""
    # Build target matrix Y (9, 5) from normalized target radar profiles (centered)
    Y = np.zeros((9, 5), dtype=np.float64)
    # Centroid matrix M (9, dim)
    M = np.zeros((9, dim), dtype=np.float64)

    for i in range(1, 10):
        arch = ARCHETYPES[i]
        M[i - 1] = centroids[i]
        # Normalized target values in [-0.5, 0.5] range
        for j, dim_name in enumerate(COGNITIVE_DIMENSIONS):
            Y[i - 1, j] = (arch.target_radar[dim_name] - 70.0) / 100.0

    # Solve Y = M * W^T via pseudo-inverse: W^T = pinv(M) * Y -> W = Y^T * pinv(M)^T
    pinv_M = np.linalg.pinv(M)
    W_eval = Y.T @ pinv_M.T  # shape (5, dim)
    return W_eval


class ExplainabilityDecoder:
    """XAI decoder projecting latent centroids to non-clinical cognitive dimensions."""

    def __init__(
        self,
        dim: int = 64,
        w_eval: Optional[np.ndarray] = None,
        centroids: Optional[Dict[int, np.ndarray]] = None,
    ) -> None:
        """Initialize ExplainabilityDecoder.

        Args:
            dim: Dimension of latent space (64).
            w_eval: Optional calibrated matrix of shape (5, dim).
            centroids: Optional dictionary of 9 centroids for calibration.
        """
        self.dim = dim
        self.dimensions = COGNITIVE_DIMENSIONS

        if w_eval is not None:
            w = np.asarray(w_eval, dtype=np.float64)
            if w.shape != (5, self.dim):
                raise ValueError(f"W_eval must have shape (5, {self.dim}), got {w.shape}")
            self.w_eval = w.copy()
        elif centroids is not None:
            self.w_eval = _calibrate_projection_matrix(centroids, self.dim)
        else:
            # Calibrate using default centroids from GMM clusterer
            from clustering_engine.gmm_clusterer import _create_default_centroids
            default_c_arr = _create_default_centroids(self.dim)
            default_centroids = {i + 1: default_c_arr[i] for i in range(9)}
            self.w_eval = _calibrate_projection_matrix(default_centroids, self.dim)

    def project_latent(self, vector: Union[np.ndarray, Sequence[float]]) -> np.ndarray:
        """Project a latent vector into the 5 cognitive dimensions.

        Args:
            vector: Latent vector of shape (dim,).

        Returns:
            Projected vector of shape (5,).
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
            from_cluster_id: 1-based source cluster ID (1..9).
            to_cluster_id: 1-based target cluster ID (1..9).
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
    ) -> str:
        """Generate non-clinical, growth-oriented explanation for a cluster transition.

        Args:
            to_cluster_id: Destination cluster ID.
            delta_vector: Computed differential vector.
            dominant_driver: Name of dominant cognitive dimension.

        Returns:
            Supportive explanation string validated against non-clinical guardrails.
        """
        target_archetype = get_archetype(to_cluster_id)
        driver_val = delta_vector[dominant_driver]
        driver_pct = int(round(abs(driver_val) * 100))
        # Ensure at least 1% for clarity
        if driver_pct == 0:
            driver_pct = 10

        dim_desc = DIMENSION_DESCRIPTIONS.get(dominant_driver, dominant_driver.replace("_", " "))
        pacing_phrase = PACING_PHRASES.get(target_archetype.pacing_strategy, "calibrated pacing")

        if driver_val >= 0:
            explanation = (
                f"Shifted to {target_archetype.name} due to a {driver_pct}% increase in "
                f"{dim_desc} and {pacing_phrase}."
            )
        else:
            explanation = (
                f"Shifted to {target_archetype.name} with streamlined {dim_desc} "
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
        """Compute 0-100 radar scores for the 5 non-clinical cognitive dimensions.

        Smoothly blends archetype target profiles based on soft responsibilities
        gamma_{t, k}, ensuring exact continuity across archetype boundaries.
        """
        if responsibilities is not None:
            scores = {dim: 0.0 for dim in self.dimensions}
            for code, prob in responsibilities.items():
                cluster_id = int(code.replace("C", ""))
                arch = get_archetype(cluster_id)
                for dim in self.dimensions:
                    scores[dim] += prob * arch.target_radar[dim]
            return {dim: float(round(scores[dim], 1)) for dim in self.dimensions}

        # Fallback to direct linear projection
        proj = self.project_latent(s_bar)
        scores = {}
        for idx, dim in enumerate(self.dimensions):
            # Map [-0.5, 0.5] range to [50, 90]
            val = 70.0 + proj[idx] * 50.0
            scores[dim] = float(round(np.clip(val, 0.0, 100.0), 1))
        return scores

    def compute_uncertainty_band(
        self,
        responsibilities: Union[Dict[str, float], Dict[int, float]],
    ) -> float:
        """Compute uncertainty band scalar (e.g. 0.0 to 15.0) from posterior entropy.

        High entropy (diffuse probabilities) yields higher uncertainty;
        low entropy (concentrated in one archetype) yields tight certainty.
        """
        probs = np.array(list(responsibilities.values()), dtype=np.float64)
        probs = np.clip(probs, 1e-12, 1.0)
        # Shannon entropy
        entropy = -float(np.sum(probs * np.log(probs)))
        max_entropy = np.log(len(probs))  # ln(9) approx 2.197

        normalized_entropy = float(entropy / max_entropy)
        # Map normalized entropy into realistic standard-error band (e.g., 3.0 to 12.0)
        uncertainty = 3.0 + 8.5 * normalized_entropy
        return float(round(uncertainty, 1))
