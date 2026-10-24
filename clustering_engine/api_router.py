"""FastAPI router providing HTTP interface for cognitive evaluation."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from clustering_engine.evaluator import CognitiveEvaluator

router = APIRouter(prefix="/v1/clustering", tags=["clustering"])

# Shared singleton evaluator instance
_evaluator = CognitiveEvaluator()


def get_evaluator() -> CognitiveEvaluator:
    return _evaluator


class LatentEvaluationRequest(BaseModel):
    user_id: str = Field(..., description="Unique user session identifier", min_length=1)
    latent_vector: List[float] = Field(..., description="64-dimensional latent state vector")


class TransitionEventModel(BaseModel):
    from_cluster: int
    to_cluster: int
    confidence_margin: float
    delta_vector: Dict[str, float]
    dominant_driver: str
    xai_explanation: str


class EvaluationResponse(BaseModel):
    user_id: str
    active_cluster_id: int
    cluster_name: str
    cluster_probabilities: Dict[str, float]
    has_transitioned: bool
    transition_event: Optional[TransitionEventModel] = None
    radar_scores: Dict[str, float]
    uncertainty_band: float


@router.post(
    "/evaluate",
    response_model=EvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate cognitive state, archetype cluster, and XAI explanations",
)
def evaluate_latent_state(payload: LatentEvaluationRequest) -> Dict[str, Any]:
    """Evaluate latent vector through smoother, soft GMM, hysteresis gate, and XAI decoder."""
    if len(payload.latent_vector) != _evaluator.dim:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Latent vector must have length {_evaluator.dim}, got {len(payload.latent_vector)}",
        )

    try:
        result = _evaluator.evaluate(
            user_id=payload.user_id,
            latent_vector=payload.latent_vector,
        )
        return result.to_dict()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Evaluation failed: {exc}",
        ) from exc


@router.post(
    "/reset/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Reset user tracking state",
)
def reset_user_state(user_id: str) -> Dict[str, str]:
    _evaluator.reset_user(user_id)
    return {"status": "ok", "message": f"State reset for user '{user_id}'"}
