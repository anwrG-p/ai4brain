"""Clustering and Explainability Bridge for Brain Twin JEPA.

Connects the JEPA Context Encoder (Task 2) to the Soft GMM Clustering Engine
and Schmitt-Trigger Hysteresis Gate (Task 3).
"""

from __future__ import annotations

from typing import Any, Dict, Sequence, Union
import numpy as np

from clustering_engine.evaluator import CognitiveEvaluator, EvaluationResult


class BrainTwinClusteringBridge:
    """Bridge consuming JEPA latent vectors s_t and routing to clustering engine."""

    def __init__(self, evaluator: CognitiveEvaluator | None = None) -> None:
        self.evaluator = evaluator or CognitiveEvaluator()

    def process_jepa_state(
        self,
        user_id: str,
        s_t: Union[np.ndarray, Sequence[float]],
    ) -> Dict[str, Any]:
        """Process latent vector s_t output from JEPA encoder."""
        eval_result: EvaluationResult = self.evaluator.evaluate(
            user_id=user_id,
            latent_vector=s_t,
        )
        return eval_result.to_dict()

    def reset_user(self, user_id: str) -> None:
        self.evaluator.reset_user(user_id)
