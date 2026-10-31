"""Data models and schemas for Member 2 (AI Coach & Collaboration Engine).

Defines data contracts for:
- State transitions and explainability vectors from Member 3
- Cognitive dimensions and the five consumer pillars
- Dynamic collaboration score calculations (5 dimensions)
- Chat interactions and coaching responses
- Safety guardrail metadata, crisis and health gates
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class CognitiveDimension(str, Enum):
    """Canonical cognitive dimensions monitored by the platform."""
    WORKING_MEMORY = "working_memory"
    PATTERN_INDUCTION = "pattern_induction"
    EXECUTIVE_FUNCTION = "executive_function"
    SPATIAL_ORIENTATION = "spatial_orientation"
    PROCESSING_SPEED = "processing_speed"
    EPISODIC_MEMORY = "episodic_memory"


class PillarId(str, Enum):
    """The five consumer pillars (spec "Five pillars"; frontend/src/features/insights/pillars.ts)."""
    FOCUS = "focus"
    AGILITY = "agility"
    IMPULSE = "impulse"
    MEMORY = "memory"
    VISUAL = "visual"


# Consumer names, the only pillar wording Loti may show (U5). Mirrors PILLAR_LABELS in pillars.ts.
PILLAR_LABELS: Dict[PillarId, str] = {
    PillarId.FOCUS: "Focus & Strategy",
    PillarId.AGILITY: "Mental Agility",
    PillarId.IMPULSE: "Impulse Control",
    PillarId.MEMORY: "Deep Memory",
    PillarId.VISUAL: "Visual Radar",
}


class ArchetypeTier(str, Enum):
    """Categorical progression tier derived from K=9 GMM cluster archetypes."""
    EXPLORER = "explorer"          # Beginners (clusters 0, 1, 2)
    PRACTITIONER = "practitioner"  # Intermediate (clusters 3, 4, 5)
    STRATEGIST = "strategist"      # Advanced / Autonomous (clusters 6, 7, 8)


class StateBusEvent(BaseModel):
    """Data contract for Internal State Bus event from Member 3.
    
    Ref: README Section: Inter-Subsystem Communication Interfaces
    Contract: { user_id, transition_occurred: bool, delta_vector, uncertainty }
    """
    user_id: str
    transition_occurred: bool = False
    active_cluster_id: int = Field(default=0, ge=0, le=8, description="Active cluster index k in 0..8")
    delta_vector: Dict[str, float] = Field(
        default_factory=dict,
        description="Prototype differential vector Δc = W_eval * (μ_target - μ_active)"
    )
    uncertainty: float = Field(
        default=0.0,
        ge=0.0,
        description="Uncertainty / sigma of the state estimation"
    )
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CollaborationDimension(str, Enum):
    """The 5 canonical AI Collaboration dimensions."""
    CLARIFICATION = "clarification"
    CRITICAL_VERIFICATION = "critical_verification"
    ITERATION = "iteration"
    AUTONOMY = "autonomy"
    RESPONSIBLE_USE = "responsible_use"


class DimensionScores(BaseModel):
    """Raw or normalized scores V_i in [0, 100] for each collaboration dimension."""
    clarification: float = Field(default=50.0, ge=0.0, le=100.0)
    critical_verification: float = Field(default=50.0, ge=0.0, le=100.0)
    iteration: float = Field(default=50.0, ge=0.0, le=100.0)
    autonomy: float = Field(default=50.0, ge=0.0, le=100.0)
    responsible_use: float = Field(default=50.0, ge=0.0, le=100.0)

    def to_dict(self) -> Dict[str, float]:
        return {
            CollaborationDimension.CLARIFICATION.value: self.clarification,
            CollaborationDimension.CRITICAL_VERIFICATION.value: self.critical_verification,
            CollaborationDimension.ITERATION.value: self.iteration,
            CollaborationDimension.AUTONOMY.value: self.autonomy,
            CollaborationDimension.RESPONSIBLE_USE.value: self.responsible_use,
        }


class DimensionWeights(BaseModel):
    """Dynamically assigned weights w_i for the collaboration score, summing to 1.0."""
    clarification: float = Field(ge=0.0, le=1.0)
    critical_verification: float = Field(ge=0.0, le=1.0)
    iteration: float = Field(ge=0.0, le=1.0)
    autonomy: float = Field(ge=0.0, le=1.0)
    responsible_use: float = Field(ge=0.0, le=1.0)

    @field_validator("*", mode="after")
    @classmethod
    def round_weight(cls, v: float) -> float:
        return round(v, 4)

    def to_dict(self) -> Dict[str, float]:
        return {
            CollaborationDimension.CLARIFICATION.value: self.clarification,
            CollaborationDimension.CRITICAL_VERIFICATION.value: self.critical_verification,
            CollaborationDimension.ITERATION.value: self.iteration,
            CollaborationDimension.AUTONOMY.value: self.autonomy,
            CollaborationDimension.RESPONSIBLE_USE.value: self.responsible_use,
        }


class CollaborationScoreResult(BaseModel):
    """Full breakdown of the Dynamic AI Collaboration Score S_collab."""
    composite_score: float = Field(ge=0.0, le=100.0, description="Overall S_collab score 0-100")
    archetype_id: int = Field(ge=0, le=8)
    archetype_tier: ArchetypeTier
    dimension_scores: Dict[str, float]
    dimension_weights: Dict[str, float]
    weighted_contributions: Dict[str, float]
    growth_recommendation: str = ""
    calculated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SafetyViolation(BaseModel):
    """Details of a caught non-clinical safety guardrail violation."""
    detected_phrase: str
    rule_category: str
    remediation_applied: str


class SafetyMetadata(BaseModel):
    """Metadata regarding non-clinical safety evaluation."""
    is_safe: bool = True
    clinical_terms_detected: List[str] = Field(default_factory=list)
    sanitized: bool = False
    violations: List[SafetyViolation] = Field(default_factory=list)


class GateResult(BaseModel):
    """Result of a deterministic gate on user text (crisis check, health signpost).

    Same shape as the frontend seam `crisisGate(text) => { hit, reply? }`: `reply` is set only on a hit.
    """
    hit: bool = False
    reply: Optional[str] = None


class ReplySource(str, Enum):
    """Where a coach reply came from. Every fallback is explicit, never silent."""
    LLM = "llm"
    OFFLINE = "offline"                      # no LLM configured
    OFFLINE_AFTER_LLM_ERROR = "offline_after_llm_error"
    OFFLINE_AFTER_LINT = "offline_after_lint"  # LLM reply withheld: it tripped a banned term
    CRISIS = "crisis"
    HEALTH_SIGNPOST = "health_signpost"


class ChatMessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    role: ChatMessageRole
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatRequest(BaseModel):
    """User request payload for the AI Coach Chatbot."""
    user_id: str
    message: str
    session_id: Optional[str] = None
    chat_history: List[ChatMessage] = Field(default_factory=list)
    active_cluster_id: Optional[int] = Field(default=None, ge=0, le=8)
    delta_vector: Optional[Dict[str, float]] = None


class CoachingResponse(BaseModel):
    """Response returned by the AI Coach Chatbot."""
    reply_text: str
    xai_explanation: Optional[str] = None
    suggested_actions: List[str] = Field(default_factory=list)
    collab_score_snapshot: Optional[CollaborationScoreResult] = None
    safety_metadata: SafetyMetadata
    reply_source: ReplySource = ReplySource.OFFLINE
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
