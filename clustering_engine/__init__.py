"""AI4Brain Clustering Engine & Explainability Decoder.

Provides soft Gaussian Mixture Model clustering over K=9 cognitive archetypes,
Schmitt-trigger hysteresis gating with dwell-time filter, and non-clinical
prototype explainability decoding.
"""

from clustering_engine.archetypes import (
    ARCHETYPES,
    Archetype,
    COGNITIVE_DIMENSIONS,
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
    DIMENSION_DESCRIPTIONS,
    ExplainabilityDecoder,
    PACING_PHRASES,
    validate_non_clinical,
)
from clustering_engine.evaluator import (
    CognitiveEvaluator,
    EvaluationResult,
    TransitionEvent,
)

__all__ = [
    "ARCHETYPES",
    "Archetype",
    "COGNITIVE_DIMENSIONS",
    "get_archetype",
    "get_archetype_by_code",
    "LeakyIntegrator",
    "SoftGMMClusterer",
    "HysteresisState",
    "SchmittTriggerHysteresisGate",
    "TransitionDecision",
    "DIMENSION_DESCRIPTIONS",
    "ExplainabilityDecoder",
    "PACING_PHRASES",
    "validate_non_clinical",
    "CognitiveEvaluator",
    "EvaluationResult",
    "TransitionEvent",
]
