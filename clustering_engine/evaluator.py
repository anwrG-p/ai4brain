"""Unified Cognitive Evaluator for dynamic clusters and extensible cognitive dimensions.

Integrates:
1. Temporal State Smoothing (Leaky Integrator, eta = 0.12)
2. Soft Gaussian Mixture Model (GMM) Clustering (dynamic K archetypes)
3. Schmitt-Trigger Hysteresis Gate (delta = 0.15, N_confirm = 3)
4. Centroid Prototype Explainability Decoder (dynamic M cognitive dimensions)

Supports arbitrary K clusters and extensible dimension configurations.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union
import numpy as np

from clustering_engine.archetypes import (
    DEFAULT_DIMENSIONS,
    Archetype,
    ArchetypeRegistry,
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
    """Complete evaluation payload adhering to Task 3 contract with extensible dimensions."""

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
        k: Optional[int] = None,
        dimensions: Optional[Sequence[str]] = None,
        eta: float = 0.12,
        delta_hyst: float = 0.15,
        n_confirm: int = 3,
        clusterer: Optional[SoftGMMClusterer] = None,
        smoother: Optional[LeakyIntegrator] = None,
        hysteresis_gate: Optional[SchmittTriggerHysteresisGate] = None,
        xai_decoder: Optional[ExplainabilityDecoder] = None,
        archetype_registry: Optional[ArchetypeRegistry] = None,
    ) -> None:
        """Initialize CognitiveEvaluator with open clusters and dimensions.

        Args:
            dim: Latent vector dimension (default: 64).
            k: Number of clusters (default: 9 or inferred from clusterer/registry).
            dimensions: List of cognitive dimensions (default: DEFAULT_DIMENSIONS).
            eta: Leaky integrator smoothing factor (default: 0.12).
            delta_hyst: Schmitt-trigger hysteresis margin (default: 0.15).
            n_confirm: Dwell-time confirmation frames (default: 3).
            clusterer: Optional customized SoftGMMClusterer instance.
            smoother: Optional customized LeakyIntegrator instance.
            hysteresis_gate: Optional customized SchmittTriggerHysteresisGate instance.
            xai_decoder: Optional customized ExplainabilityDecoder instance.
            archetype_registry: Optional custom ArchetypeRegistry instance.
        """
        self.dim = dim
        self.dimensions: Tuple[str, ...] = tuple(dimensions) if dimensions is not None else DEFAULT_DIMENSIONS

        # Resolve cluster count K
        if k is not None:
            resolved_k = k
        elif clusterer is not None:
            resolved_k = clusterer.k
        elif archetype_registry is not None and len(archetype_registry) > 0:
            resolved_k = len(archetype_registry)
        else:
            resolved_k = 9

        self.k = resolved_k

        # Resolve archetype registry
        if archetype_registry is not None:
            self.archetype_registry = archetype_registry
        elif self.k == 9 and self.dimensions == DEFAULT_DIMENSIONS:
            self.archetype_registry = ArchetypeRegistry.create_default()
        else:
            self.archetype_registry = ArchetypeRegistry.generate_for_k(
                k=self.k,
                dimensions=self.dimensions,
            )

        self.clusterer = clusterer or SoftGMMClusterer(
            dim=dim,
            k=self.k,
        )
        self.smoother = smoother or LeakyIntegrator(eta=eta, expected_dim=dim)
        self.hysteresis_gate = hysteresis_gate or SchmittTriggerHysteresisGate(
            delta_hyst=delta_hyst,
            n_confirm=n_confirm,
        )
        self.xai_decoder = xai_decoder or ExplainabilityDecoder(
            dim=dim,
            dimensions=self.dimensions,
            centroids=self.clusterer.get_all_centroids(),
            archetype_registry=self.archetype_registry,
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

        # Step 2: Soft GMM Clustering (dynamic K archetypes)
        probs_by_code = self.clusterer.compute_responsibilities(s_bar)
        probs_by_id = self.clusterer.get_responsibilities_by_id(s_bar)

        # Step 3: Schmitt-Trigger Hysteresis Gate
        decision = self.hysteresis_gate.process(
            user_id=user_id,
            responsibilities=probs_by_id,
        )

        active_archetype = self.archetype_registry.get(decision.active_cluster_id)

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
                to_cluster_name=active_archetype.name,
            )

            transition_event = TransitionEvent(
                from_cluster=decision.from_cluster,
                to_cluster=decision.to_cluster,
                confidence_margin=decision.confidence_margin,
                delta_vector=delta_vector,
                dominant_driver=dominant_driver,
                xai_explanation=explanation,
            )

        # Step 5: Dynamic Radar Scores & Uncertainty Band
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
