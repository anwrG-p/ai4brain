"""Cognitive archetypes definition for AI4Brain clustering engine.

Defines 9 non-clinical cognitive prototypes organized along a 3x3 grid
(Proficiency Tier x Pacing Strategy), maintaining strictly supportive,
growth-oriented terminology.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Final, List, Tuple


COGNITIVE_DIMENSIONS: Final[Tuple[str, ...]] = (
    "working_memory",
    "pattern_processing",
    "processing_speed",
    "spatial_reasoning",
    "verification_rigor",
)


@dataclass(frozen=True)
class Archetype:
    """Non-clinical cognitive archetype prototype."""

    id: int
    code: str
    name: str
    proficiency_tier: str
    pacing_strategy: str
    description: str
    growth_focus: str
    target_radar: Dict[str, float]


ARCHETYPES: Final[Dict[int, Archetype]] = {
    1: Archetype(
        id=1,
        code="C1",
        name="Intuitive Explorer",
        proficiency_tier="Developing",
        pacing_strategy="Fast / Exploratory",
        description="Discovers patterns rapidly through intuitive trials and energetic exploration.",
        growth_focus="Stabilizing working memory hold while preserving inductive agility.",
        target_radar={
            "working_memory": 60.0,
            "pattern_processing": 78.0,
            "processing_speed": 82.0,
            "spatial_reasoning": 62.0,
            "verification_rigor": 52.0,
        },
    ),
    2: Archetype(
        id=2,
        code="C2",
        name="Stepwise Builder",
        proficiency_tier="Developing",
        pacing_strategy="Balanced / Stepwise",
        description="Constructs solutions incrementally with consistent pacing and steady working memory.",
        growth_focus="Expanding multi-hop pattern abstraction from a strong procedural base.",
        target_radar={
            "working_memory": 68.0,
            "pattern_processing": 64.0,
            "processing_speed": 66.0,
            "spatial_reasoning": 65.0,
            "verification_rigor": 66.0,
        },
    ),
    3: Archetype(
        id=3,
        code="C3",
        name="Deliberate Observer",
        proficiency_tier="Developing",
        pacing_strategy="Deliberate / Reflective",
        description="Examines problem spaces with careful observation and high verification rigor before responding.",
        growth_focus="Accelerating response fluency while maintaining high baseline accuracy.",
        target_radar={
            "working_memory": 65.0,
            "pattern_processing": 60.0,
            "processing_speed": 55.0,
            "spatial_reasoning": 64.0,
            "verification_rigor": 80.0,
        },
    ),
    4: Archetype(
        id=4,
        code="C4",
        name="Agile Sprinter",
        proficiency_tier="Operational",
        pacing_strategy="Fast / Accelerated",
        description="Executes swift transitions across stimuli with accelerated processing speed and sharp pattern responsiveness.",
        growth_focus="Deepening verification checks during high-speed cognitive sequences.",
        target_radar={
            "working_memory": 72.4,
            "pattern_processing": 81.0,
            "processing_speed": 79.5,
            "spatial_reasoning": 65.2,
            "verification_rigor": 58.0,
        },
    ),
    5: Archetype(
        id=5,
        code="C5",
        name="Calibrated Operator",
        proficiency_tier="Operational",
        pacing_strategy="Balanced / Calibrated",
        description="Demonstrates balanced pacing, steady cognitive stamina, and calibrated response precision.",
        growth_focus="Bridging calibrated operational consistency into advanced systemic modeling.",
        target_radar={
            "working_memory": 74.0,
            "pattern_processing": 73.0,
            "processing_speed": 72.0,
            "spatial_reasoning": 72.0,
            "verification_rigor": 75.0,
        },
    ),
    6: Archetype(
        id=6,
        code="C6",
        name="Methodical Analyst",
        proficiency_tier="Operational",
        pacing_strategy="Deliberate / Methodical",
        description="Employs systematic spatial and logical analysis with elevated verification rigor and low error rates.",
        growth_focus="Streamlining deliberation latency on familiar structural patterns.",
        target_radar={
            "working_memory": 75.0,
            "pattern_processing": 72.0,
            "processing_speed": 62.0,
            "spatial_reasoning": 78.0,
            "verification_rigor": 85.0,
        },
    ),
    7: Archetype(
        id=7,
        code="C7",
        name="Rapid Strategist",
        proficiency_tier="Strategic",
        pacing_strategy="Fast / Dynamic",
        description="Synthesizes complex information dynamically at high speed with agile heuristic reasoning.",
        growth_focus="Harmonizing rapid conceptual synthesis with persistent structural audits.",
        target_radar={
            "working_memory": 82.0,
            "pattern_processing": 90.0,
            "processing_speed": 88.0,
            "spatial_reasoning": 79.0,
            "verification_rigor": 70.0,
        },
    ),
    8: Archetype(
        id=8,
        code="C8",
        name="Adaptive Architect",
        proficiency_tier="Strategic",
        pacing_strategy="Balanced / Versatile",
        description="Navigates multi-modal cognitive challenges with high spatial adaptability and integrated processing.",
        growth_focus="Orchestrating cross-domain cognitive strategies across high-complexity horizons.",
        target_radar={
            "working_memory": 85.0,
            "pattern_processing": 86.0,
            "processing_speed": 80.0,
            "spatial_reasoning": 89.0,
            "verification_rigor": 82.0,
        },
    ),
    9: Archetype(
        id=9,
        code="C9",
        name="Deep Systemic Thinker",
        proficiency_tier="Strategic",
        pacing_strategy="Deliberate / In-Depth",
        description="Tackles deep structural dependencies with extensive working memory hold and comprehensive verification.",
        growth_focus="Translating profound architectural insights into agile execution flows.",
        target_radar={
            "working_memory": 92.0,
            "pattern_processing": 88.0,
            "processing_speed": 70.0,
            "spatial_reasoning": 91.0,
            "verification_rigor": 94.0,
        },
    ),
}


def get_archetype(cluster_id: int) -> Archetype:
    """Retrieve archetype metadata by 1-based cluster id (1..9)."""
    if cluster_id not in ARCHETYPES:
        raise ValueError(f"Unknown cluster id: {cluster_id}. Expected integer 1..9.")
    return ARCHETYPES[cluster_id]


def get_archetype_by_code(code: str) -> Archetype:
    """Retrieve archetype metadata by code ('C1'..'C9')."""
    normalized = code.upper().strip()
    for arch in ARCHETYPES.values():
        if arch.code == normalized:
            return arch
    raise ValueError(f"Unknown archetype code: '{code}'. Expected 'C1'..'C9'.")
