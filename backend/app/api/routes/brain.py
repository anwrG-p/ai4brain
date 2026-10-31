"""FastAPI Digital Brain State & Longitudinal History Routes."""

from fastapi import APIRouter
from app.memory.template_memory_store import memory_store
from app.tools.digital_brain_updater import DigitalBrainUpdater

router = APIRouter(prefix="/brain", tags=["Digital Brain"])


@router.get("/state/{user_id}")
def get_brain_state(user_id: str):
    """Retrieves current 5-node cortical T-scores, covariance, and active bottleneck."""
    state = memory_store.get_user_brain_state(user_id)
    bottleneck = DigitalBrainUpdater.identify_plasticity_bottleneck(state["means"])
    return {
        "user_id": user_id,
        "nodes": state["means"],
        "variances": state["variances"],
        "plasticity_bottleneck": bottleneck,
        "last_active": state.get("last_active"),
        "session_count": state.get("session_count", 0),
    }


@router.get("/history/{user_id}")
def get_user_history(user_id: str):
    """Returns longitudinal evaluation history with DDM and IRT progression."""
    history = memory_store.get_user_history(user_id)
    return {
        "user_id": user_id,
        "total_evaluations": len(history),
        "history": history,
    }
