"""Unified Cognitive Evaluator for AI4Brain clustering and explainability.

Integrates:
1. Temporal State Smoothing (Leaky Integrator, eta = 0.12)
2. Soft Gaussian Mixture Model (GMM) Clustering (K = 9 Archetypes)
3. Schmitt-Trigger Hysteresis Gate (delta = 0.15, N_confirm = 3)
4. Centroid Prototype Explainability Decoder (W_eval projection, Delta c, XAI)

Provides deterministic evaluation returning the exact JSON schema required by
the AI4Brain Task 3 contract.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Sequence, Union
import numpy as np

from clustering_engine.archetypes import (
    ARCHETYPES,
    COGNITIVE_DIMENSIONS,
    Archetype,
    get_archetype,
)
from clustering_engine.explainability import ExplainabilityDecoder
from clustering_engine.gmm_clusterer import SoftGMMClusterer
from clustering_engine.hysteresis_gate import SchmittTriggerHysteresisGate
from clustering_engine.temporal_smoother import LeakyIntegrator


@dataclass(frozen=True)
class TransitionEvent:
    """Transition event metadata triggered on cluster jump."""

    from_cluster: int
    to_cluster: int
    confidence_margin: float
    delta_vector: Dict[str, float]
    dominant_driver: str
    xai_explanation: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class EvaluationResult:
    """Complete evaluation payload adhering to Task 3 contract."""

    user_id: str
    active_cluster_id: int
    cluster_name: str
    cluster_probabilities: Dict[str, float]
    has_transitioned: bool
    transition_event: Optional[TransitionEvent]
    radar_scores: Dict[str, float]
    uncertainty_band: float

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "user_id": self.user_id,
            "active_cluster_id": self.active_cluster_id,
            "cluster_name": self.cluster_name,
            "cluster_probabilities": {
                k: round(v, 4) for k, v in self.cluster_probabilities.items()
            },
            "has_transitioned": self.has_transitioned,
            "transition_event": self.transition_event.to_dict() if self.transition_event else None,
            "radar_scores": self.radar_scores,
            "uncertainty_band": self.uncertainty_band,
        }
        return result


class CognitiveEvaluator:
    """End-to-end cognitive evaluator coordinating smoothing, GMM, gate, and XAI."""

    def __init__(
        self,
        dim: int = 64,
        eta: float = 0.12,
        delta_hyst: float = 0.15,
        n_confirm: int = 3,
        clusterer: Optional[SoftGMMClusterer] = None,
        smoother: Optional[LeakyIntegrator] = None,
        hysteresis_gate: Optional[SchmittTriggerHysteresisGate] = None,
        xai_decoder: Optional[ExplainabilityDecoder] = None,
    ) -> None:
        """Initialize the CognitiveEvaluator.

        Args:
            dim: Latent vector dimension (default: 64).
            eta: Leaky integrator smoothing factor (default: 0.12).
            delta_hyst: Schmitt-trigger hysteresis margin (default: 0.15).
            n_confirm: Dwell-time confirmation frames (default: 3).
            clusterer: Optional customized SoftGMMClusterer instance.
            smoother: Optional customized LeakyIntegrator instance.
            hysteresis_gate: Optional customized SchmittTriggerHysteresisGate instance.
            xai_decoder: Optional customized ExplainabilityDecoder instance.
        """
        self.dim = dim
        self.clusterer = clusterer or SoftGMMClusterer(dim=dim)
        self.smoother = smoother or LeakyIntegrator(eta=eta, expected_dim=dim)
        self.hysteresis_gate = hysteresis_gate or SchmittTriggerHysteresisGate(
            delta_hyst=delta_hyst,
            n_confirm=n_confirm,
        )
        self.xai_decoder = xai_decoder or ExplainabilityDecoder(
            dim=dim,
            centroids=self.clusterer.get_all_centroids(),
        )

    def evaluate(
        self,
        user_id: str,
        latent_vector: Union[np.ndarray, Sequence[float]],
    ) -> EvaluationResult:
        """Execute deterministic evaluation for a user trial step.

        Args:
            user_id: Unique user session identifier.
            latent_vector: Raw latent state vector s_t from JEPA encoder.

        Returns:
            EvaluationResult matching Task 3 data contract.
        """
        # Step 1: Temporal State Smoothing (Leaky Integrator)
        s_bar = self.smoother.smooth(user_id=user_id, s_t=latent_vector)

        # Step 2: Soft GMM Clustering (K = 9 Archetypes)
        probs_by_code = self.clusterer.compute_responsibilities(s_bar)
        probs_by_id = {int(code[1:]): p for code, p in probs_by_code.items()}

        # Step 3: Schmitt-Trigger Hysteresis Gate
        decision = self.hysteresis_gate.process(
            user_id=user_id,
            responsibilities=probs_by_id,
        )

        active_archetype = get_archetype(decision.active_cluster_id)

        # Step 4: Centroid Prototype Explainability on Transition
        transition_event: Optional[TransitionEvent] = None
        if decision.has_transitioned and decision.from_cluster is not None and decision.to_cluster is not None:
            centroids = self.clusterer.get_all_centroids()
            delta_vector = self.xai_decoder.compute_delta_vector(
                from_cluster_id=decision.from_cluster,
                to_cluster_id=decision.to_cluster,
                centroids=centroids,
            )
            dominant_driver, _ = self.xai_decoder.identify_dominant_driver(delta_vector)
            explanation = self.xai_decoder.generate_explanation(
                to_cluster_id=decision.to_cluster,
                delta_vector=delta_vector,
                dominant_driver=dominant_driver,
            )

            transition_event = TransitionEvent(
                from_cluster=decision.from_cluster,
                to_cluster=decision.to_cluster,
                confidence_margin=decision.confidence_margin,
                delta_vector=delta_vector,
                dominant_driver=dominant_driver,
                xai_explanation=explanation,
            )

        # Step 5: Radar Scores & Uncertainty Band
        radar_scores = self.xai_decoder.compute_radar_scores(
            s_bar=s_bar,
            responsibilities=probs_by_code,
        )
        uncertainty_band = self.xai_decoder.compute_uncertainty_band(probs_by_code)

        return EvaluationResult(
            user_id=user_id,
            active_cluster_id=decision.active_cluster_id,
            cluster_name=active_archetype.name,
            cluster_probabilities=probs_by_code,
            has_transitioned=decision.has_transitioned,
            transition_event=transition_event,
            radar_scores=radar_scores,
            uncertainty_band=uncertainty_band,
        )

    def reset_user(self, user_id: str) -> None:
        """Reset state tracking for a specific user."""
        self.smoother.reset(user_id)
        self.hysteresis_gate.reset(user_id)
