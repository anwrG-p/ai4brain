"""FastAPI Session Initialization & Exercise Generation Routes."""

from typing import Optional
from fastapi import APIRouter, Query, Response
from pydantic import BaseModel, Field

from app.orchestrator.agent import orchestrator
from app.memory.template_memory_store import memory_store

router = APIRouter(prefix="/session", tags=["Session"])


class SessionInitRequest(BaseModel):
    user_id: str = Field(..., description="Unique user identifier")
    intent: Optional[str] = Field(default=None, description="BASELINE_DIAGNOSTIC, DAILY_TRAINING, etc.")
    difficulty_b: Optional[float] = Field(default=None, description="Optional custom IRT difficulty override")


@router.post("/init")
def init_session_post(req: SessionInitRequest):
    """Initializes session, evaluates plasticity bottleneck, and procedurally generates isomorphic task."""
    return orchestrator.initialize_session(
        user_id=req.user_id,
        requested_intent=req.intent,
        custom_difficulty_b=req.difficulty_b,
    )


@router.get("/init")
def init_session_get(
    user_id: str = Query("usr_default", description="Unique user identifier"),
    intent: Optional[str] = Query(None, description="Intent override"),
    difficulty_b: Optional[float] = Query(None, description="IRT difficulty override"),
):
    """GET version for frictionless browser/iframe startup."""
    return orchestrator.initialize_session(
        user_id=user_id,
        requested_intent=intent,
        custom_difficulty_b=difficulty_b,
    )


@router.get("/sandbox/{session_id}")
def get_sandbox_html(session_id: str):
    """Renders raw sandboxed HTML viewport for an active session."""
    session_data = memory_store.get_session(session_id)
    if not session_data or "task_payload" not in session_data:
        # Fallback dummy session
        init_res = orchestrator.initialize_session(user_id="usr_sandbox")
        return Response(content=init_res["sandbox_html"], media_type="text/html")
    from app.models.task_schema import TaskConfigPayload
    from app.tools.ux_sandbox_renderer import UXSandboxRenderer
    payload = TaskConfigPayload.model_validate(session_data["task_payload"])
    html = UXSandboxRenderer.render_sandboxed_runtime_html(payload)
    return Response(content=html, media_type="text/html")
