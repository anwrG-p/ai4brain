"""Explainability Injection Engine for Member 2 (AI Coach).

Translates the prototype differential vector Δc = W_eval * (μ_target - μ_active)
and transition signals received from Member 3 into intuitive, human-understandable,
growth-mindset justifications for task adaptations.

Reference:
- README: 'Implement Explainability Injection: ingest the differential vector Δc from Member 3
  to justify recommendations (e.g., "We adjusted task pacing because your working memory stability improved by 20%").'
"""

from __future__ import annotations

from typing import Dict, List, Optional
from ai_coach.schemas import CognitiveDimension, StateBusEvent
from ai_coach.safety_guardrails import SafetyGuardrailEngine

NEUTRAL_RATIONALE = "We adjusted this round to fit your recent results."


class XAIExplainer:
    """Engine for decoding Member 3 prototype deltas into natural-language rationales."""

    def __init__(self, significance_threshold: float = 0.05):
        self.significance_threshold = significance_threshold
        self.safety_guardrail = SafetyGuardrailEngine()

    def generate_adaptation_rationale(
        self,
        delta_vector: Optional[Dict[str, float]],
        active_cluster_id: Optional[int] = None,
        uncertainty: float = 0.0,
    ) -> str:
        """Translate Δc into a user-facing explanation of why tasks or pacing adapted."""
        if not delta_vector:
            return (
                "We maintained your current practice trajectory to reinforce stable baseline "
                "performance across all cognitive dimensions."
            )

        # Filter and sort significant dimension shifts by magnitude
        significant_shifts = [
            (dim, delta)
            for dim, delta in delta_vector.items()
            if abs(delta) >= self.significance_threshold
        ]
        significant_shifts.sort(key=lambda item: abs(item[1]), reverse=True)

        if not significant_shifts:
            return (
                "Your performance shows balanced equilibrium across all tracked cognitive faculties; "
                "pacing remains steady."
            )

        top_dim, top_delta = significant_shifts[0]
        pct_change = abs(round(top_delta * 100))

        dimension_explanations = {
            CognitiveDimension.WORKING_MEMORY.value: {
                "positive": f"We adjusted task pacing and increased item spans because your working memory stability improved by {pct_change}%.",
                "negative": f"We added intermediate recall checkpoints to support working memory consolidation as challenge depth increases.",
            },
            CognitiveDimension.PATTERN_INDUCTION.value: {
                "positive": f"We advanced rule complexity because your matrix pattern induction agility showed a +{pct_change}% acceleration.",
                "negative": f"We scaffolded visual contrast cues to assist in deconstructing intricate matrix transformations.",
            },
            CognitiveDimension.EXECUTIVE_FUNCTION.value: {
                "positive": f"We reduced inter-stimulus intervals to challenge your executive task-switching speed (+{pct_change}% fluidity).",
                "negative": f"We tuned distractor ratios to create optimal focus conditions for task-switching flow.",
            },
            CognitiveDimension.SPATIAL_ORIENTATION.value: {
                "positive": f"We expanded rotational angles in spatial tasks to match your +{pct_change}% spatial orientation progression.",
                "negative": f"We provided directional reference markers to anchor mental rotation pathways.",
            },
            CognitiveDimension.PROCESSING_SPEED.value: {
                "positive": f"We tightened response windows to match your faster, jitter-free cognitive throughput (+{pct_change}%).",
                "negative": f"We extended pacing windows to encourage deliberate, high-accuracy problem analysis.",
            },
            CognitiveDimension.EPISODIC_MEMORY.value: {
                # Exercise-level wording: no improvement claim without a calibrated RCI gate.
                "positive": "We added closer look-alikes. Your last few rounds were steady.",
                "negative": f"We spaced out the look-alikes so each picture is easier to tell apart.",
            },
        }

        dim_key = top_dim.lower().strip()
        direction = "positive" if top_delta >= 0 else "negative"

        if dim_key in dimension_explanations:
            rationale = dimension_explanations[dim_key][direction]
        else:
            trend = "strengthened" if top_delta >= 0 else "is actively calibrating"
            rationale = f"We fine-tuned difficulty parameters because your {top_dim.replace('_', ' ')} {trend} by {pct_change}%."

        # If uncertainty is notable, acknowledge adaptive calibration
        if uncertainty > 0.4:
            rationale += " (Adaptive calibration active: exploratory tolerance widened)."

        # Ensure non-clinical safety: a rationale that trips a banned term (e.g. from an unknown
        # dimension key) is withheld whole, never reworded.
        safe_rationale, _ = self.safety_guardrail.sanitize(rationale, fallback=NEUTRAL_RATIONALE)
        return safe_rationale

    def format_xai_prompt_context(
        self,
        event: Optional[StateBusEvent] = None,
        delta_vector: Optional[Dict[str, float]] = None,
        cluster_id: Optional[int] = None,
    ) -> str:
        """Generate structured XAI context to inject directly into the LLM system/user prompt."""
        deltas = event.delta_vector if event else (delta_vector or {})
        active_k = event.active_cluster_id if event else (cluster_id or 0)
        uncertainty = event.uncertainty if event else 0.0

        rationale = self.generate_adaptation_rationale(deltas, active_k, uncertainty)

        lines = [
            "### EXPLAINABILITY CONTEXT (MEMBER 3 LATENT STATE):",
            f"- Active Cognitive Archetype Index: Cluster {active_k}",
            f"- State Estimation Uncertainty (sigma): {uncertainty:.3f}",
            "- Prototype Differential Vector (Δc):",
        ]

        if deltas:
            for dim, delta in deltas.items():
                sign = "+" if delta >= 0 else ""
                lines.append(f"  * {dim}: {sign}{delta * 100:.1f}%")
        else:
            lines.append("  * (No active differential shift)")

        lines.append(f"- Recommended Task Adaptation Justification: \"{rationale}\"")
        lines.append(
            "- Coach Directive: Seamlessly weave this rationale into your response to explain "
            "why cognitive tasks are dynamically pacing or shifting difficulty."
        )

        return "\n".join(lines)
