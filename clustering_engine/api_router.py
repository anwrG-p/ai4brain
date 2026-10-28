"""FastAPI router providing HTTP interface for cognitive evaluation and dynamic centroid management."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from clustering_engine.evaluator import CognitiveEvaluator

router = APIRouter(prefix="/v1/clustering", tags=["clustering"])

# Shared singleton evaluator instance
_evaluator = CognitiveEvaluator()


def get_evaluator() -> CognitiveEvaluator:
    return _evaluator


def set_evaluator(evaluator: CognitiveEvaluator) -> None:
    """Override the active evaluator instance (useful for tests or custom K/dimensions)."""
    global _evaluator
    _evaluator = evaluator


# ============================================================================
# Pydantic Schemas
# ============================================================================


class LatentEvaluationRequest(BaseModel):
    user_id: str = Field(..., description="Unique user session identifier", min_length=1)
    latent_vector: List[float] = Field(..., description="Latent state vector")


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


class SpawnCentroidRequest(BaseModel):
    centroid: List[float] = Field(..., description="Centroid vector matching evaluator latent dimension")
    name: Optional[str] = Field(None, description="Optional archetype display name")
    proficiency_tier: str = Field("Operational", description="Cognitive tier category")
    pacing_strategy: str = Field("Adaptive", description="Behavioral pacing description")
    description: str = Field("", description="Narrative summary")
    growth_focus: str = Field("", description="Supportive growth direction")
    target_radar: Optional[Dict[str, float]] = Field(None, description="Target radar scores")


class SpawnCentroidResponse(BaseModel):
    cluster_id: int
    cluster_code: str
    name: str
    total_k: int


class CentroidAdaptRequest(BaseModel):
    adaptive_centroids: Optional[bool] = Field(None, description="Enable or disable online centroid adaptation")
    centroid_lr: Optional[float] = Field(None, description="Learning rate for soft online centroid updates", ge=0.0)
    novelty_threshold: Optional[float] = Field(None, description="Responsibility threshold for novelty spawning", ge=0.0, le=1.0)


class CentroidsStatusResponse(BaseModel):
    k: int
    adaptive_centroids: bool
    centroid_lr: float
    novelty_threshold: Optional[float]
    cluster_codes: List[str]
    centroids: Dict[str, List[float]]
    archetypes: Dict[str, Dict[str, Any]]


class DiscoverKRequest(BaseModel):
    samples: List[List[float]] = Field(..., description="List of latent vectors to cluster", min_length=2)
    k_min: int = Field(2, ge=2, description="Minimum number of clusters to consider")
    k_max: int = Field(12, ge=2, description="Maximum number of clusters to consider")


class DiscoverKResponse(BaseModel):
    discovered_k: int
    cluster_codes: List[str]


# ============================================================================
# API Endpoints
# ============================================================================


@router.post(
    "/evaluate",
    response_model=EvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate cognitive state, archetype cluster, and XAI explanations",
)
def evaluate_latent_state(
    payload: LatentEvaluationRequest,
    evaluator: CognitiveEvaluator = Depends(get_evaluator),
) -> Dict[str, Any]:
    """Evaluate latent vector through smoother, soft GMM, hysteresis gate, and XAI decoder."""
    if len(payload.latent_vector) != evaluator.dim:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Latent vector must have length {evaluator.dim}, got {len(payload.latent_vector)}",
        )

    try:
        result = evaluator.evaluate(
            user_id=payload.user_id,
            latent_vector=payload.latent_vector,
        )
        return result.to_dict()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
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
def reset_user_state(
    user_id: str,
    evaluator: CognitiveEvaluator = Depends(get_evaluator),
) -> Dict[str, str]:
    evaluator.reset_user(user_id)
    return {"status": "ok", "message": f"State reset for user '{user_id}'"}


@router.get(
    "/centroids",
    response_model=CentroidsStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current dynamic centroids and clustering parameters",
)
def get_centroids_status(
    evaluator: CognitiveEvaluator = Depends(get_evaluator),
) -> Dict[str, Any]:
    """Retrieve all current dynamic centroids, archetype metadata, and online learning parameters."""
    all_centroids = evaluator.get_dynamic_centroids()
    centroids_dict: Dict[str, List[float]] = {
        evaluator.clusterer.cluster_codes[cid - 1]: c_vec.tolist()
        for cid, c_vec in all_centroids.items()
    }
    archetypes_dict: Dict[str, Dict[str, Any]] = {
        code: evaluator.archetype_registry.get_archetype(cid).to_dict()
        for cid, code in enumerate(evaluator.clusterer.cluster_codes, start=1)
        if evaluator.archetype_registry.has_cluster(cid)
    }

    return {
        "k": evaluator.k,
        "adaptive_centroids": evaluator.adaptive_centroids,
        "centroid_lr": evaluator.centroid_lr,
        "novelty_threshold": evaluator.novelty_threshold,
        "cluster_codes": list(evaluator.clusterer.cluster_codes),
        "centroids": centroids_dict,
        "archetypes": archetypes_dict,
    }


@router.post(
    "/centroids/spawn",
    response_model=SpawnCentroidResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dynamically spawn and register a new centroid",
)
def spawn_dynamic_centroid(
    payload: SpawnCentroidRequest,
    evaluator: CognitiveEvaluator = Depends(get_evaluator),
) -> Dict[str, Any]:
    """Dynamically register a new centroid in the clusterer, expand K, and register its archetype."""
    if len(payload.centroid) != evaluator.dim:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Centroid dimension must equal {evaluator.dim}, got {len(payload.centroid)}",
        )

    try:
        new_id = evaluator.add_dynamic_centroid(
            centroid=payload.centroid,
            name=payload.name,
            proficiency_tier=payload.proficiency_tier,
            pacing_strategy=payload.pacing_strategy,
            description=payload.description,
            growth_focus=payload.growth_focus,
            target_radar=payload.target_radar,
        )
        code = evaluator.clusterer.cluster_codes[new_id - 1]
        arch = evaluator.archetype_registry.get_archetype(new_id)

        return {
            "cluster_id": new_id,
            "cluster_code": code,
            "name": arch.name,
            "total_k": evaluator.k,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to spawn dynamic centroid: {exc}",
        ) from exc


@router.post(
    "/centroids/adapt",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    summary="Configure online centroid adaptation parameters",
)
def configure_centroid_adaptation(
    payload: CentroidAdaptRequest,
    evaluator: CognitiveEvaluator = Depends(get_evaluator),
) -> Dict[str, Any]:
    """Toggle online adaptation and tune learning rate or novelty threshold."""
    if payload.adaptive_centroids is not None:
        evaluator.adaptive_centroids = payload.adaptive_centroids
    if payload.centroid_lr is not None:
        evaluator.centroid_lr = payload.centroid_lr
    if payload.novelty_threshold is not None:
        evaluator.novelty_threshold = payload.novelty_threshold

    return {
        "adaptive_centroids": evaluator.adaptive_centroids,
        "centroid_lr": evaluator.centroid_lr,
        "novelty_threshold": evaluator.novelty_threshold,
    }


@router.post(
    "/centroids/discover",
    response_model=DiscoverKResponse,
    status_code=status.HTTP_200_OK,
    summary="Discover optimal K and fit centroids using Bayesian Information Criterion (BIC)",
)
def discover_optimal_k_endpoint(
    payload: DiscoverKRequest,
    evaluator: CognitiveEvaluator = Depends(get_evaluator),
) -> Dict[str, Any]:
    """Dynamically determine optimal K from observed sample vectors using BIC."""
    arr = np.array(payload.samples, dtype=np.float64)
    if arr.ndim != 2 or arr.shape[1] != evaluator.dim:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Sample vectors must have shape (N, {evaluator.dim}), got {arr.shape}",
        )
    if arr.shape[0] < payload.k_min:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Number of samples ({arr.shape[0]}) must be >= k_min ({payload.k_min})",
        )

    try:
        discovered_k = evaluator.discover_k_from_samples(
            X=arr,
            k_min=payload.k_min,
            k_max=payload.k_max,
        )
        return {
            "discovered_k": discovered_k,
            "cluster_codes": list(evaluator.clusterer.cluster_codes),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dynamic K discovery failed: {exc}",
        ) from exc
