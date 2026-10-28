"""Cognitive archetypes definition and dynamic registry for AI4Brain clustering engine.

Provides:
- Non-clinical cognitive archetype models
- Configurable and extensible cognitive evaluation dimensions
- ArchetypeRegistry for runtime registration, custom definitions, or auto-generation
- Backward-compatible access to default archetypes and dimensions
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Final, List, Optional, Sequence, Tuple, Union


# Default fallback dimensions (can be replaced with 4, 6, or arbitrary custom dimensions)
DEFAULT_DIMENSIONS: Final[Tuple[str, ...]] = (
    "working_memory",
    "pattern_processing",
    "processing_speed",
    "spatial_reasoning",
    "verification_rigor",
)

# Friendly display names for common cognitive dimensions
DIMENSION_DISPLAY_NAMES: Final[Dict[str, str]] = {
    "working_memory": "working memory stability",
    "pattern_processing": "inductive pattern processing",
    "pattern_induction": "pattern induction",
    "processing_speed": "processing speed",
    "spatial_reasoning": "spatial reasoning agility",
    "spatial_orientation": "spatial orientation",
    "verification_rigor": "verification rigor",
    "executive_function": "executive cognitive control",
    "episodic_memory": "episodic memory recall",
    "verbal_fluency": "verbal fluency",
    "divided_attention": "divided attention",
    "cognitive_flexibility": "cognitive flexibility",
}


def format_dimension_phrase(dimension: str) -> str:
    """Format dimension key into supportive human-readable phrase."""
    cleaned = dimension.lower().strip()
    if cleaned in DIMENSION_DISPLAY_NAMES:
        return DIMENSION_DISPLAY_NAMES[cleaned]
    return cleaned.replace("_", " ")


@dataclass(frozen=True)
class Archetype:
    """Non-clinical cognitive archetype prototype."""

    id: int
    code: str
    name: str
    proficiency_tier: str = "Operational"
    pacing_strategy: str = "Balanced"
    description: str = ""
    growth_focus: str = ""
    target_radar: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert archetype prototype to dictionary."""
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "proficiency_tier": self.proficiency_tier,
            "pacing_strategy": self.pacing_strategy,
            "description": self.description,
            "growth_focus": self.growth_focus,
            "target_radar": dict(self.target_radar),
        }


def _build_default_archetypes_dict() -> Dict[int, Archetype]:
    return {
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
                "verification_rigor": 84.0,
            },
        ),
        7: Archetype(
            id=7,
            code="C7",
            name="Adaptive Strategist",
            proficiency_tier="Strategic",
            pacing_strategy="Fast / Dynamic",
            description="Synthesizes diverse cues rapidly, dynamically shifting strategies with high pattern processing fluency.",
            growth_focus="Sustaining peak verification rigor during prolonged high-demand problem solving.",
            target_radar={
                "working_memory": 82.0,
                "pattern_processing": 88.0,
                "processing_speed": 86.0,
                "spatial_reasoning": 80.0,
                "verification_rigor": 76.0,
            },
        ),
        8: Archetype(
            id=8,
            code="C8",
            name="Systemic Integrator",
            proficiency_tier="Strategic",
            pacing_strategy="Balanced / Systemic",
            description="Maintains comprehensive working memory hold and integrates complex spatial and logical dependencies seamlessly.",
            growth_focus="Refining rapid transition agility across novel domain contexts.",
            target_radar={
                "working_memory": 88.0,
                "pattern_processing": 84.0,
                "processing_speed": 78.0,
                "spatial_reasoning": 86.0,
                "verification_rigor": 85.0,
            },
        ),
        9: Archetype(
            id=9,
            code="C9",
            name="Precision Architect",
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


# Retained for zero-friction backward compatibility
ARCHETYPES: Final[Dict[int, Archetype]] = _build_default_archetypes_dict()
COGNITIVE_DIMENSIONS: Final[Tuple[str, ...]] = DEFAULT_DIMENSIONS


class ArchetypeRegistry:
    """Dynamic, open registry for cognitive archetypes.

    Allows registering arbitrary clusters, loading custom definitions from files/dicts,
    or generating generic archetypes on the fly for any K clusters and dimension sets.
    """

    def __init__(self, archetypes: Optional[Dict[int, Archetype]] = None) -> None:
        self._archetypes: Dict[int, Archetype] = dict(archetypes) if archetypes is not None else {}

    def register(self, archetype: Archetype) -> "ArchetypeRegistry":
        """Register an archetype prototype."""
        self._archetypes[archetype.id] = archetype
        return self

    def register_dynamic_centroid(
        self,
        cluster_id: int,
        name: Optional[str] = None,
        proficiency_tier: str = "Operational",
        pacing_strategy: str = "Adaptive",
        description: str = "",
        growth_focus: str = "",
        target_radar: Optional[Dict[str, float]] = None,
    ) -> Archetype:
        """Dynamically register a newly discovered or spawned centroid archetype."""
        code = f"C{cluster_id}"
        arch_name = name or f"Dynamic Archetype {code}"
        arch = Archetype(
            id=cluster_id,
            code=code,
            name=arch_name,
            proficiency_tier=proficiency_tier,
            pacing_strategy=pacing_strategy,
            description=description or f"Dynamically discovered behavioral cluster {code}.",
            growth_focus=growth_focus or "Continuous multi-dimensional strategy refinement.",
            target_radar=target_radar or {},
        )
        self.register(arch)
        return arch

    def get(self, cluster_id: int) -> Archetype:
        """Retrieve archetype by ID, with dynamic fallback if unmapped."""
        if cluster_id in self._archetypes:
            return self._archetypes[cluster_id]
        # Dynamic fallback for unspecified clusters
        return Archetype(
            id=cluster_id,
            code=f"C{cluster_id}",
            name=f"Cognitive Archetype C{cluster_id}",
            proficiency_tier="Operational",
            pacing_strategy="Adaptive",
            description=f"Dynamic behavioral cluster C{cluster_id}.",
            growth_focus="Expanding multi-dimensional cognitive integration.",
        )

    def get_archetype(self, cluster_id: int) -> Archetype:
        """Alias for get(cluster_id)."""
        return self.get(cluster_id)

    def has_cluster(self, cluster_id: int) -> bool:
        """Check if archetype registry contains a cluster ID."""
        return cluster_id in self._archetypes

    def __contains__(self, cluster_id: int) -> bool:
        """Check if cluster ID is registered."""
        return cluster_id in self._archetypes

    def get_by_code(self, code: str) -> Archetype:
        """Retrieve archetype by code ('C1', 'C2', ...)."""
        normalized = code.upper().strip()
        for arch in self._archetypes.values():
            if arch.code == normalized:
                return arch
        # Parse numeric if possible
        if normalized.startswith("C") and normalized[1:].isdigit():
            c_id = int(normalized[1:])
            return self.get(c_id)
        raise ValueError(f"Unknown archetype code: '{code}'.")

    def all(self) -> Dict[int, Archetype]:
        """Return all registered archetypes."""
        return dict(self._archetypes)

    def __len__(self) -> int:
        return len(self._archetypes)

    @classmethod
    def create_default(cls) -> "ArchetypeRegistry":
        """Create registry initialized with the standard 9 archetypes."""
        return cls(_build_default_archetypes_dict())

    @classmethod
    def generate_for_k(
        cls,
        k: int,
        dimensions: Sequence[str] = DEFAULT_DIMENSIONS,
    ) -> "ArchetypeRegistry":
        """Generate a generic registry for arbitrary K clusters and arbitrary dimensions."""
        if k <= 0:
            raise ValueError(f"K must be positive, got {k}")

        registry = cls()
        tier_names = ["Developing", "Operational", "Strategic", "Advanced", "Mastery"]
        pacing_names = ["Fast / Exploratory", "Balanced / Calibrated", "Deliberate / Methodical"]

        for idx in range(k):
            cluster_id = idx + 1
            tier = tier_names[(idx // len(pacing_names)) % len(tier_names)]
            pacing = pacing_names[idx % len(pacing_names)]
            name = f"Archetype C{cluster_id} ({tier})"

            # Generate target radar base values around 60 - 90
            target_radar = {
                dim: round(60.0 + (idx / max(1, k - 1)) * 30.0, 1)
                for dim in dimensions
            }

            registry.register(
                Archetype(
                    id=cluster_id,
                    code=f"C{cluster_id}",
                    name=name,
                    proficiency_tier=tier,
                    pacing_strategy=pacing,
                    description=f"Behavioral cluster spanning {pacing.lower()} in {tier.lower()} tier.",
                    growth_focus="Continuous growth and strategy calibration.",
                    target_radar=target_radar,
                )
            )
        return registry

    @classmethod
    def load_from_dict(
        cls,
        data: Dict[Union[int, str], Dict],
        dimensions: Sequence[str] = DEFAULT_DIMENSIONS,
    ) -> "ArchetypeRegistry":
        """Load archetype definitions from a dictionary."""
        registry = cls()
        for key, val in data.items():
            digits = "".join(ch for ch in str(key) if ch.isdigit())
            cluster_id = int(digits) if digits else (len(registry) + 1)
            code = val.get("code", f"C{cluster_id}")
            name = val.get("name", f"Archetype {code}")
            tier = val.get("proficiency_tier", "Operational")
            pacing = val.get("pacing_strategy", "Balanced")
            desc = val.get("description", "")
            growth = val.get("growth_focus", "")
            target_radar = val.get("target_radar", {dim: 70.0 for dim in dimensions})

            registry.register(
                Archetype(
                    id=cluster_id,
                    code=code,
                    name=name,
                    proficiency_tier=tier,
                    pacing_strategy=pacing,
                    description=desc,
                    growth_focus=growth,
                    target_radar=target_radar,
                )
            )
        return registry

    @classmethod
    def load_from_json(cls, filepath: Union[str, Path]) -> "ArchetypeRegistry":
        """Load archetype definitions from a JSON file."""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.load_from_dict(data)

    def to_dict(self) -> Dict[str, Dict]:
        """Serialize registered archetypes to dictionary."""
        return {
            f"C{k}": {
                "id": arch.id,
                "code": arch.code,
                "name": arch.name,
                "proficiency_tier": arch.proficiency_tier,
                "pacing_strategy": arch.pacing_strategy,
                "description": arch.description,
                "growth_focus": arch.growth_focus,
                "target_radar": arch.target_radar,
            }
            for k, arch in self._archetypes.items()
        }


def get_archetype(cluster_id: int) -> Archetype:
    """Retrieve archetype metadata by 1-based cluster id (with dynamic fallback)."""
    if cluster_id in ARCHETYPES:
        return ARCHETYPES[cluster_id]
    return Archetype(
        id=cluster_id,
        code=f"C{cluster_id}",
        name=f"Cognitive Archetype C{cluster_id}",
        proficiency_tier="Operational",
        pacing_strategy="Adaptive",
        description=f"Behavioral cluster C{cluster_id}.",
        growth_focus="Expanding multi-dimensional cognitive integration.",
    )


def get_archetype_by_code(code: str) -> Archetype:
    """Retrieve archetype metadata by code ('C1'..'C9')."""
    normalized = code.upper().strip()
    for arch in ARCHETYPES.values():
        if arch.code == normalized:
            return arch
    if normalized.startswith("C") and normalized[1:].isdigit():
        return get_archetype(int(normalized[1:]))
    raise ValueError(f"Unknown archetype code: '{code}'.")
