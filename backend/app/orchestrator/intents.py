"""Intent definitions and prompt contracts for the Orchestrator Agent."""

from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class OrchestratorIntent(str, Enum):
    BASELINE_DIAGNOSTIC = "BASELINE_DIAGNOSTIC"
    DAILY_TRAINING = "DAILY_TRAINING"
    TELEMETRY_INGEST = "TELEMETRY_INGEST"
    DIAGNOSTIC_MILESTONE = "DIAGNOSTIC_MILESTONE"
    COACHING_REFLECTION = "COACHING_REFLECTION"


class AgentSessionContext(BaseModel):
    """Dynamic context tracked across the Master Reasoning Loop."""
    user_id: str
    session_id: str
    current_intent: OrchestratorIntent
    cognitive_load_index: float = Field(default=0.5, description="Estimated cognitive load [0.0 - 1.0]")
    plasticity_bottleneck: Optional[str] = None
    baseline_t_score: float = 50.0
    recent_accuracy: float = 0.85
    active_difficulty_b: float = 0.0
    affective_state: str = Field(default="FLOW", description="FLOW, OVERLOAD, or FATIGUE")
    reasoning_trace: List[str] = Field(default_factory=list)
