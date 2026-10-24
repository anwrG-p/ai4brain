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

__all__ = [
    "ARCHETYPES",
    "Archetype",
    "COGNITIVE_DIMENSIONS",
    "get_archetype",
    "get_archetype_by_code",
    "LeakyIntegrator",
    "SoftGMMClusterer",
]
