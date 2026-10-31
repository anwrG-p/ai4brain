"""AI4Brain Clustering Engine & Explainability Decoder.

Provides soft Gaussian Mixture Model clustering over dynamic K cognitive archetypes,
Schmitt-trigger hysteresis gating with dwell-time filter, and non-clinical
prototype explainability decoding across extensible cognitive dimensions.
"""

from clustering_engine.archetypes import (
    ARCHETYPES,
    DEFAULT_DIMENSIONS,
    Archetype,
    ArchetypeRegistry,
    COGNITIVE_DIMENSIONS,
    format_dimension_phrase,
    get_archetype,
    get_archetype_by_code,
)
from clustering_engine.temporal_smoother import LeakyIntegrator
from clustering_engine.gmm_clusterer import SoftGMMClusterer
from clustering_engine.hysteresis_gate import (
    HysteresisState,
    SchmittTriggerHysteresisGate,
    TransitionDecision,
)
from clustering_engine.explainability import (
    ExplainabilityDecoder,
    validate_non_clinical,
)
from clustering_engine.evaluator import (
    CognitiveEvaluator,
    EvaluationResult,
    TransitionEvent,
)
from clustering_engine.api_router import brain_twin_router, router

__all__ = [
    "ARCHETYPES",
    "DEFAULT_DIMENSIONS",
    "COGNITIVE_DIMENSIONS",
    "Archetype",
    "ArchetypeRegistry",
    "format_dimension_phrase",
    "get_archetype",
    "get_archetype_by_code",
    "LeakyIntegrator",
    "SoftGMMClusterer",
    "HysteresisState",
    "SchmittTriggerHysteresisGate",
    "TransitionDecision",
    "ExplainabilityDecoder",
    "validate_non_clinical",
    "CognitiveEvaluator",
    "EvaluationResult",
    "TransitionEvent",
    "router",
    "brain_twin_router",
]
