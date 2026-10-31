"""Clustering and Explainability Bridge for Brain Twin SAT-JEPA.

Connects Member 1 Telemetry to the SAT-JEPA Context Encoder and routes continuous
latent representations to the Soft GMM Clustering Engine and Schmitt-Trigger Gate.
Also produces forward trajectory forecasts for Member 4 & 5.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Union
import numpy as np

from brain_twin_jepa.sat_jepa import SATJEPAModel
from clustering_engine.evaluator import CognitiveEvaluator, EvaluationResult


class BrainTwinClusteringBridge:
    """End-to-End Bridge orchestrating SAT-JEPA and CognitiveEvaluator."""

    def __init__(
        self,
        model: Optional[SATJEPAModel] = None,
        evaluator: Optional[CognitiveEvaluator] = None,
    ) -> None:
        self.model = model or SATJEPAModel()
        self.evaluator = evaluator or CognitiveEvaluator()

    def process_telemetry(
        self,
        user_id: str,
        event: Union[Dict[str, Any], Any],
    ) -> Dict[str, Any]:
        """Ingest a Member 1 TelemetryEvent, compute latent state s_t, and evaluate clusters."""
        # 1. SAT-JEPA featurizes and steps the context GRU encoder
        s_t = self.model.process_event(user_id, event)

        # 2. CognitiveEvaluator performs temporal smoothing, GMM, hysteresis, and XAI
        eval_result: EvaluationResult = self.evaluator.evaluate(
            user_id=user_id,
            latent_vector=s_t,
        )

        result_dict = eval_result.to_dict()
        result_dict["latent_state"] = [round(float(v), 4) for v in s_t.tolist()]

        dim_name = event.get("dimension") if isinstance(event, dict) else getattr(event, "dimension", None)
        if dim_name:
            result_dict["input_dimension"] = str(dim_name)

        return result_dict

    def process_jepa_state(
        self,
        user_id: str,
        s_t: Union[np.ndarray, Sequence[float]],
    ) -> Dict[str, Any]:
        """Backward-compatible direct latent vector evaluation."""
        eval_result: EvaluationResult = self.evaluator.evaluate(
            user_id=user_id,
            latent_vector=s_t,
        )
        return eval_result.to_dict()

    def predict_trajectory(
        self,
        user_id: str,
        horizon: int = 5,
        target_dimensions: Optional[Sequence[Optional[Union[str, int]]]] = None,
    ) -> Dict[str, Any]:
        """Forecast forward cognitive trajectory steps for Member 4 & 5.

        Returns:
            Dict containing step-by-step forecasted cluster probabilities,
            dominant archetypes, predicted radar scores, and uncertainty ribbons.
        """
        raw_forecast = self.model.forecast_trajectory(
            user_id=user_id,
            horizon=horizon,
            target_dimensions=target_dimensions,
        )

        trajectory_steps: List[Dict[str, Any]] = []

        for h, (s_hat, sigma) in enumerate(raw_forecast, start=1):
            # Evaluate soft GMM probabilities for forecasted state
            probs_by_code = self.evaluator.clusterer.compute_responsibilities(s_hat)
            probs_by_id = self.evaluator.clusterer.get_responsibilities_by_id(s_hat)

            top_cluster_id = max(probs_by_id, key=lambda k: probs_by_id[k])
            arch = self.evaluator.archetype_registry.get(top_cluster_id)
            cluster_name = arch.name if arch else f"Cluster {top_cluster_id}"

            # Calculate predicted radar scores across configured dimensions
            radar_scores = self.evaluator.xai_decoder.compute_radar_scores(
                s_bar=s_hat,
                responsibilities=probs_by_code,
            )

            trajectory_steps.append({
                "step_offset": h,
                "predicted_cluster_id": top_cluster_id,
                "cluster_name": cluster_name,
                "cluster_probabilities": {k: round(float(v), 4) for k, v in probs_by_code.items()},
                "predicted_radar_scores": radar_scores,
                "uncertainty_sigma": round(float(sigma), 4),
                "latent_vector": [round(float(v), 4) for v in s_hat.tolist()],
            })

        return {
            "user_id": user_id,
            "forecast_horizon": horizon,
            "steps": trajectory_steps,
        }

    def reset_user(self, user_id: str) -> None:
        """Clear both SAT-JEPA recurrent memory and evaluator smoother/gate memory."""
        self.model.reset_user(user_id)
        self.evaluator.reset_user(user_id)
