"""Pydantic schemas for isomorphic task generation and configuration payloads."""

from typing import Dict, Any, List, Optional
from enum import Enum
from pydantic import BaseModel, Field


class TaskType(str, Enum):
    INTERFERENCE_N_BACK = "INTERFERENCE_N_BACK"
    RELATIONAL_RESPONDING_RFT = "RELATIONAL_RESPONDING_RFT"


class CorticalNode(str, Enum):
    dlPFC = "dlPFC"
    ACC = "ACC"
    vlPFC_Striatum = "vlPFC_Striatum"
    Hippocampus_DG = "Hippocampus_DG"
    Parieto_Occipital = "Parieto_Occipital"


class TaskTimingRules(BaseModel):
    """Sub-millisecond timing constraints for trial presentation."""
    fixation_ms: int = Field(default=500, description="Central fixation cross presentation duration")
    stimulus_duration_ms: int = Field(default=1200, description="Active stimulus display time window")
    inter_stimulus_interval_ms: int = Field(default=400, description="Blank interval before next trial")
    response_deadline_ms: int = Field(default=2000, description="Maximum allowed reaction time before timeout")
    gap_effect_pause_ms: int = Field(default=10000, description="10s scientific Gap Effect consolidation pause")


class TaskTrialBlueprint(BaseModel):
    """Specification of an individual trial generated procedurally."""
    trial_index: int = Field(..., ge=0)
    stimulus_id: str = Field(..., description="Deterministic hash or identifier of stimulus token")
    stimulus_display: Dict[str, Any] = Field(..., description="Renderable visual/relational data payload")
    target_present: bool = Field(..., description="Ground-truth presence of target condition")
    correct_key: str = Field(..., description="Expected keyboard or touch response key: 'MATCH', 'NO_MATCH', etc.")
    is_lure: bool = Field(default=False, description="Whether this trial constitutes a high-familiarity lure")
    lure_type: Optional[str] = Field(default=None, description="E.g. N-1, N+1, rule-conflict")
    item_difficulty_b: float = Field(default=0.0, description="Calibrated item difficulty parameter b in IRT")
    discrimination_a: float = Field(default=1.0, description="Item discrimination parameter a in IRT")
    guessing_c: float = Field(default=0.0, description="Pseudo-guessing parameter c in IRT")


class TaskConfigPayload(BaseModel):
    """Complete structured payload delivered to client runtime and Dynamic UX Sandbox."""
    task_id: str = Field(..., description="Unique generated task instance identifier")
    task_type: TaskType = Field(..., description="Task family identifier")
    task_version: str = Field(default="1.0.0")
    target_node: CorticalNode = Field(..., description="Targeted cortical/subcortical region")
    difficulty_b: float = Field(..., description="Calibrated aggregate difficulty level")
    trials: List[TaskTrialBlueprint] = Field(..., min_length=1, description="Procedurally generated trial blueprints")
    timing_rules: TaskTimingRules = Field(default_factory=TaskTimingRules)
    instructions: List[str] = Field(default_factory=list, description="Non-interruptive instructional prompts")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Generator parameters and graph topology")
