"""Pydantic schemas for raw trial telemetry ingestion."""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class DeviceTelemetry(BaseModel):
    """Client device telemetry captured during task execution."""
    input_type: str = Field(default="keyboard", description="Input method: keyboard, touch, mouse")
    frame_drops: int = Field(default=0, description="Dropped animation frames during stimulus interval")
    blur_events: int = Field(default=0, description="Window or tab blur count during trial")
    audio_latency_ms: Optional[float] = Field(default=None, description="Web Audio API output latency in ms")


class StimulusFeatures(BaseModel):
    """Per-trial stimulus attributes and conflict parameters."""
    spatial_pos: Optional[int] = Field(default=None, description="Grid or spatial coordinate (e.g., 0-8 for 3x3)")
    is_lure: bool = Field(default=False, description="Whether the trial presents a proactive or conflict lure")
    lure_offset: Optional[int] = Field(default=None, description="Offset for lure in N-back (e.g. -1 for N-1, +1 for N+1)")
    relation_type: Optional[str] = Field(default=None, description="Relational responding relation: GREATER, LESS, OPPOSITE, EQUAL")
    node_depth: Optional[int] = Field(default=None, description="Graph transitive chain distance in RFT tasks")
    rule_switched: bool = Field(default=False, description="Whether the dimensional rule switched on this trial")
    extra_meta: Dict[str, Any] = Field(default_factory=dict, description="Additional custom task metadata")


class TrialTelemetry(BaseModel):
    """Sub-second telemetry captured for an individual trial event."""
    trial_index: int = Field(..., ge=0, description="Sequential 0-indexed trial number")
    stimulus_id: str = Field(..., description="Unique deterministic identifier of the stimulus token/graph")
    stimulus_features: StimulusFeatures = Field(default_factory=StimulusFeatures)
    target_present: bool = Field(..., description="Ground-truth presence of target criterion")
    user_response: bool = Field(..., description="Binary or categorical response provided by user")
    is_correct: bool = Field(..., description="Whether user response matched ground-truth key")
    reaction_time_ms: float = Field(..., ge=0.0, description="Millisecond-accurate response latency via performance.now()")
    non_decision_time_est_ms: Optional[float] = Field(default=None, description="Client or preliminary non-decision latency")
    device_telemetry: DeviceTelemetry = Field(default_factory=DeviceTelemetry)


class SessionTelemetryIngest(BaseModel):
    """Complete raw trial array sent from client runtime to the psychometric telemetry engine."""
    session_id: str = Field(..., description="Unique active session identifier")
    user_id: str = Field(..., description="Unique user identifier")
    task_type: str = Field(..., description="E.g., INTERFERENCE_N_BACK, RELATIONAL_RESPONDING_RFT")
    task_version: str = Field(default="1.0.0", description="Semantic version of task generator")
    trials: List[TrialTelemetry] = Field(..., min_length=1, description="Sequential array of sub-second trial events")
