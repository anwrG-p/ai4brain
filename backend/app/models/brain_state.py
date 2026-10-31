"""Pydantic schemas for the Digital Brain state space and evaluation metrics."""

from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class NodeDelta(BaseModel):
    """Previous, updated, and confidence intervals for a specific cortical node."""
    previous: float = Field(..., description="Previous T-score or capacity estimate (e.g. 50.0)")
    updated: float = Field(..., description="Kalman-smoothed updated T-score (e.g. 52.4)")
    confidence_interval: Tuple[float, float] = Field(..., description="95% CI [lower, upper]")
    drift_rate: Optional[float] = Field(default=None, description="Drift velocity associated with node domain")


class DigitalBrainDelta(BaseModel):
    """The 5 cortical/subcortical target nodes tracked in the Digital Brain."""
    dlPFC: NodeDelta = Field(..., description="Dorsolateral Prefrontal Cortex: Working Memory, Planning, Fluid Reasoning")
    ACC: NodeDelta = Field(..., description="Anterior Cingulate Cortex: Conflict Monitoring, Task Switching, Error Recovery")
    vlPFC_Striatum: NodeDelta = Field(..., description="Ventrolateral Prefrontal Cortex / Striatum: Inhibitory Control, Impulsivity Gating")
    Hippocampus_DG: NodeDelta = Field(..., description="Hippocampus & Dentate Gyrus: Mnemonic Separation, Associative Binding")
    Parieto_Occipital: NodeDelta = Field(..., description="Parieto-Occipital Cortex: Processing Speed, Spatial Orienting")


class TaskSpecificMetrics(BaseModel):
    """Domain-specific psychometric indices."""
    signal_detection_d_prime: Optional[float] = Field(default=None, description="Signal detection sensitivity d'")
    stop_signal_rt_ms: Optional[float] = Field(default=None, description="SSRT in ms via integration method")
    task_switch_cost_ms: Optional[float] = Field(default=None, description="Switch cost (switch RT - repeat RT)")
    lure_discrimination_index: Optional[float] = Field(default=None, description="LDI: P(Sim|Lure) - P(Sim|Foil)")
    reaction_time_jitter_ms: Optional[float] = Field(default=None, description="Standard deviation of reaction times")


class SessionMetrics(BaseModel):
    """Comprehensive computational psychometric results from telemetry engine."""
    ddm_drift_rate_v: float = Field(..., description="EZ-Diffusion drift rate parameter v")
    ddm_boundary_a: float = Field(..., description="EZ-Diffusion boundary separation parameter a")
    ddm_non_decision_t0_ms: float = Field(..., description="EZ-Diffusion non-decision time parameter t0 in ms")
    theta_ability: float = Field(..., description="3PL-IRT latent ability estimate theta in [-3.0, +3.0]")
    t_score: float = Field(..., description="Clinical standardized T-score: 50 + 10 * theta")
    rci_vs_baseline: float = Field(..., description="Reliable Change Index relative to historical baseline")
    statistically_significant: bool = Field(..., description="Whether |RCI| >= 1.96 (p < 0.05)")
    accuracy: float = Field(..., ge=0.0, le=1.0, description="Observed mean accuracy")
    mean_correct_rt_ms: float = Field(..., ge=0.0, description="Mean RT of correct responses")
    task_specific: TaskSpecificMetrics = Field(default_factory=TaskSpecificMetrics)


class DigitalBrainEvaluation(BaseModel):
    """Structured payload communicated from Telemetry Engine to Digital Brain Agent and DB."""
    user_id: str = Field(..., description="User unique identifier")
    session_id: str = Field(..., description="Completed assessment session identifier")
    evaluation_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="UTC timestamp of evaluation")
    session_metrics: SessionMetrics = Field(..., description="Extracted computational psychometric parameters")
    digital_brain_delta: DigitalBrainDelta = Field(..., description="Updates across the 5 cortical nodes")
    plasticity_bottleneck: str = Field(..., description="Target node exhibiting lowest capacity or highest growth room")
