"""V1 stand-ins the frontend calls before each module ships its own route.

Each route here moves to its module's router (main.py mounts those first, so the module wins):
- GET  /v1/tasks/next                -> dynamic_cache.api (BE-04, with the BE-03 generators)
- POST /v1/coach/chat                -> ai_coach.api (BE-06)
- GET  /v1/coach/collaboration-score -> ai_coach.api (BE-06)
- GET  /v1/dashboard/profile         -> brain_twin_jepa.api (BE-11)
- POST /v1/clustering/evaluate       -> brain_twin_jepa.api (BE-11)

Telemetry ingest is app/api/routes/v1_telemetry.py; the user delete is v1_privacy.py.
Payloads use dimension ids only: the internal state nodes are anatomical names, and the
product never claims to measure the brain (spec U5).
"""

import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel

from ai_coach.agent import AICoachAgent
from ai_coach.schemas import ChatRequest
from app.memory.template_memory_store import memory_store
from app.tools.digital_brain_updater import DigitalBrainUpdater

router = APIRouter(prefix="/v1", tags=["V1 Platform Contract"])

# Internal Kalman state node -> (dimensionId, backendDimensionKey, code), as in
# frontend/src/config/dimensions.ts and the telemetry Dimension enum.
NODE_DIMENSIONS: Dict[str, tuple[str, str, str]] = {
    "dlPFC": ("working_memory", "working_memory", "WM"),
    "vlPFC_Striatum": ("inhibition_control", "executive_function", "IC"),
    "ACC": ("cognitive_flexibility", "executive_function", "CF"),
    "Hippocampus_DG": ("episodic_pattern_separation", "episodic_memory", "EP"),
    "Parieto_Occipital": ("divided_perceptual_speed", "processing_speed", "PS"),
}

# The Kalman prior variance (T-score units). A session that observed a node leaves its
# posterior variance below this; one that did not leaves it at or above.
PRIOR_VARIANCE = 16.0


# ----------------------------------------------------
# GET /v1/tasks/next
# ----------------------------------------------------
@router.get("/tasks/next")
def get_next_task(user_id: str = Query("usr_default", description="Anonymous device id")):
    """A 2-back working-memory block. Not adaptive yet: BE-04 serves the BE-03 generators."""
    return {
        "task_id": f"task_{uuid.uuid4().hex[:8]}",
        "dimension": "working_memory",
        "schema_type": "n_back",
        "params": {
            "n": 2,
            "sequence_length": 20,
            "isi_ms": 1200,
            "stimulus_duration_ms": 600,
        },
        "surface_seed": secrets.randbelow(2**31),
    }


# ----------------------------------------------------
# GET /v1/dashboard/profile
# ----------------------------------------------------
def _posterior_variance(evaluation: Dict[str, Any], node: str) -> Optional[float]:
    """Variance behind the 95% CI the Kalman step reported for this node."""
    delta = evaluation.get("digital_brain_delta", {}).get(node)
    if not delta:
        return None
    lower, upper = delta["confidence_interval"]
    return ((upper - lower) / (2 * 1.96)) ** 2


@router.get("/dashboard/profile")
def get_dashboard_profile(user_id: str = Query("usr_default")):
    """Per-dimension estimates from the sessions this server has evaluated.

    Only dimensions a session actually observed are listed; with no sessions the
    answer is "not_enough_data", not a prior dressed up as a score.
    """
    history = memory_store.get_user_history(user_id)
    if not history:
        return {"user_id": user_id, "status": "not_enough_data", "estimates": [], "snapshots": []}

    means = memory_store.get_user_brain_state(user_id)["means"]
    estimates = []
    measured: Dict[str, float] = {}
    for node, (dimension_id, backend_key, code) in NODE_DIMENSIONS.items():
        observed = [
            (e, v) for e in history
            if (v := _posterior_variance(e, node)) is not None and v < PRIOR_VARIANCE
        ]
        if not observed:
            continue
        last_eval, var = observed[-1]

        t_score = measured[node] = float(means[node])
        pct = round(max(0.0, min(100.0, (t_score - 20.0) * 1.666)), 1)
        sigma = round(min(18.0, max(4.0, var * 2.0)), 1)
        confidence = round(max(0.40, min(0.95, 1.0 - (sigma / 30.0))), 2)
        estimates.append({
            "dimensionId": dimension_id,
            "backendDimensionKey": backend_key,
            "code": code,
            "mean": pct,
            "ciLower": round(max(0.0, pct - sigma), 1),
            "ciUpper": round(min(100.0, pct + sigma), 1),
            "uncertaintySigma": sigma,
            "confidence": confidence,
            "isHatched": confidence < 0.60,
            "sampleSize": len(observed),
            "lastAssessedAt": _iso(last_eval.get("evaluation_timestamp")),
        })

    if not measured:
        return {"user_id": user_id, "status": "not_enough_data", "estimates": [], "snapshots": []}
    return {
        "user_id": user_id,
        "status": "ok",
        # The measured dimension with the most room to grow.
        "focus_dimension_id": NODE_DIMENSIONS[DigitalBrainUpdater.identify_plasticity_bottleneck(measured)][0],
        "estimates": estimates,
        "snapshots": [],
    }


def _iso(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.replace(tzinfo=value.tzinfo or timezone.utc).isoformat()
    return value


# ----------------------------------------------------
# POST /v1/coach/chat
# ----------------------------------------------------
class CoachChatRequest(BaseModel):
    user_id: str = "usr_default"
    user_prompt: str
    dimension_context: Optional[str] = None


@router.post("/coach/chat")
def post_coach_chat(req: CoachChatRequest):
    """Relays to the ai_coach module. No canned fallback: if the coach fails, say so."""
    try:
        resp = AICoachAgent().handle_chat(ChatRequest(user_id=req.user_id, message=req.user_prompt))
    except Exception:
        raise HTTPException(status_code=503, detail="coach not available")
    return {
        "reply_text": resp.reply_text,
        "xai_explanation": resp.xai_explanation,
        "suggested_actions": resp.suggested_actions,
        "safety_metadata": resp.safety_metadata.model_dump(),
        "timestamp": resp.timestamp.isoformat(),
    }


# ----------------------------------------------------
# GET /v1/coach/collaboration-score
# ----------------------------------------------------
@router.get("/coach/collaboration-score", status_code=501, responses={501: {}})
def get_collaboration_score(user_id: str = Query("usr_default"), cluster_id: int = Query(3, ge=0, le=8)):
    """ai_coach.CollaborationScorer needs the user's chat history and cluster; neither is stored yet."""
    raise HTTPException(status_code=501, detail="collaboration score not available yet")


# ----------------------------------------------------
# POST /v1/clustering/evaluate
# ----------------------------------------------------
@router.post("/clustering/evaluate", status_code=501, responses={501: {}})
def evaluate_clustering(payload: Dict[str, Any] = Body(...)):
    """The clustering engine has not landed (clustering_engine/ is empty)."""
    raise HTTPException(status_code=501, detail="clustering not available yet")
