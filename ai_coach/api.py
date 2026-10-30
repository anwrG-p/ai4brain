"""FastAPI Service for Member 2 (AI Coach & Collaboration Engine).

Exposes:
- POST /v1/coach/chat : Conversational chat with XAI explainability and safety guardrails.
- GET  /v1/coach/collaboration-score : Returns dynamic collaboration score breakdown (query params: user_id, cluster_id).
- GET  /v1/coach/collab-score/{user_id} : Returns dynamic collaboration score breakdown (path param).
- POST /v1/coach/state-event : Ingestion endpoint for Member 3's Internal State Bus.
- GET  /v1/coach/learning-path/{user_id} : Returns structured cognitive learning paths.
- POST /v1/coach/verify-safety : Standalone guardrail validator for team services.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import FastAPI, APIRouter, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from ai_coach.agent import AICoachAgent
from ai_coach.collaboration_scorer import CollaborationScorer
from ai_coach.safety_guardrails import SafetyGuardrailEngine
from ai_coach.schemas import (
    ChatRequest,
    CoachingResponse,
    CollaborationScoreResult,
    DimensionScores,
    SafetyMetadata,
    StateBusEvent,
)

# Initialize application
app = FastAPI(
    title="AI4Brain — Member 2: AI Coach Collaboration Engine",
    description="Conversational coaching, explainability injection, dynamic collaboration scoring, and safety guardrails.",
    version="1.0.0",
)

# Enable CORS for frontend integration (Vite dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/v1/coach", tags=["AI Coach & Collaboration Engine"])

# Singleton instances
coach_agent = AICoachAgent()
safety_engine = SafetyGuardrailEngine()
scorer = CollaborationScorer()

# In-memory cache for user state events from Member 3
_user_state_cache: Dict[str, StateBusEvent] = {}


class SafetyVerifyRequest(BaseModel):
    text: str


class SafetyVerifyResponse(BaseModel):
    original_text: str
    sanitized_text: str
    is_safe: bool
    safety_metadata: SafetyMetadata


@router.post(
    "/chat",
    response_model=CoachingResponse,
    status_code=status.HTTP_200_OK,
    summary="Chat with the AI Cognitive Fitness Coach",
)
def chat_with_coach(request: ChatRequest) -> CoachingResponse:
    """Handle conversational turn, inject XAI from latest state, and enforce non-clinical guardrails."""
    # Check if delta vector exists in cache from Member 3 if not in payload
    if not request.delta_vector and request.user_id in _user_state_cache:
        cached_event = _user_state_cache[request.user_id]
        request.delta_vector = cached_event.delta_vector
        if request.active_cluster_id is None:
            request.active_cluster_id = cached_event.active_cluster_id

    return coach_agent.handle_chat(request)


@router.get(
    "/collaboration-score",
    response_model=CollaborationScoreResult,
    status_code=status.HTTP_200_OK,
    summary="Get user's Dynamic AI Collaboration Score breakdown (query params)",
)
def get_collaboration_score_query(
    user_id: str = Query(..., description="User unique identifier"),
    cluster_id: int = Query(default=3, ge=0, le=8, description="Archetype cluster index (0..8)"),
) -> CollaborationScoreResult:
    """Matches frontend apiClient.getCollaborationScore(userId, clusterId)."""
    active_cluster = cluster_id
    if user_id in _user_state_cache and cluster_id == 3:
        active_cluster = _user_state_cache[user_id].active_cluster_id

    baseline_dimensions = DimensionScores()
    return scorer.calculate_score(dimension_scores=baseline_dimensions, cluster_id=active_cluster)


@router.get(
    "/collab-score/{user_id}",
    response_model=CollaborationScoreResult,
    status_code=status.HTTP_200_OK,
    summary="Get user's Dynamic AI Collaboration Score breakdown (path param)",
)
def get_collaboration_score_path(
    user_id: str,
    cluster_id: Optional[int] = Query(default=None, ge=0, le=8),
) -> CollaborationScoreResult:
    """Alternative path param endpoint for dashboard profile consumption."""
    active_cluster = 4
    if cluster_id is not None:
        active_cluster = cluster_id
    elif user_id in _user_state_cache:
        active_cluster = _user_state_cache[user_id].active_cluster_id

    baseline_dimensions = DimensionScores()
    return scorer.calculate_score(dimension_scores=baseline_dimensions, cluster_id=active_cluster)


@router.post(
    "/state-event",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest Member 3 Internal State Bus Event",
)
def ingest_state_event(event: StateBusEvent) -> Dict[str, Any]:
    """Ingest transition events, prototype deltas Δc, and uncertainty signals from Member 3."""
    _user_state_cache[event.user_id] = event
    return {
        "status": "ingested",
        "user_id": event.user_id,
        "transition_occurred": event.transition_occurred,
        "active_cluster_id": event.active_cluster_id,
        "delta_dimension_count": len(event.delta_vector),
    }


@router.get(
    "/learning-path/{user_id}",
    status_code=status.HTTP_200_OK,
    summary="Generate personalized skill-building curriculum",
)
def get_learning_path(
    user_id: str,
    cluster_id: Optional[int] = Query(default=None, ge=0, le=8),
) -> Dict[str, Any]:
    """Generate adaptive cognitive learning path based on active archetype and Δc."""
    active_cluster = 4
    deltas = {}
    if cluster_id is not None:
        active_cluster = cluster_id
    elif user_id in _user_state_cache:
        cached = _user_state_cache[user_id]
        active_cluster = cached.active_cluster_id
        deltas = cached.delta_vector

    return coach_agent.generate_learning_path(
        user_id=user_id,
        cluster_id=active_cluster,
        delta_vector=deltas,
    )


@router.post(
    "/verify-safety",
    response_model=SafetyVerifyResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify and sanitize text against non-clinical guardrails",
)
def verify_safety(request: SafetyVerifyRequest) -> SafetyVerifyResponse:
    """Validate any prompt or text output across the platform to ensure non-clinical compliance."""
    sanitized, meta = safety_engine.sanitize(request.text)
    return SafetyVerifyResponse(
        original_text=request.text,
        sanitized_text=sanitized,
        is_safe=meta.is_safe,
        safety_metadata=meta,
    )


app.include_router(router)


@app.get("/", response_class=HTMLResponse, tags=["Visual Frontend"])
@app.get("/ui", response_class=HTMLResponse, tags=["Visual Frontend"])
def serve_visual_frontend():
    """Serves the standalone Member 2 AI Coach Visual Lab."""
    frontend_path = Path(__file__).resolve().parent.parent / "coach_frontend" / "index.html"
    if frontend_path.is_file():
        return HTMLResponse(content=frontend_path.read_text(encoding="utf-8"))
    return HTMLResponse("<h1>AI Coach Visual Frontend not found</h1>", status_code=404)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "member2-ai-coach"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ai_coach.api:app", host="0.0.0.0", port=8000, reload=True)
