"""FastAPI AI Coach & Explainability Guidance Routes."""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.models.brain_state import DigitalBrainEvaluation
from app.orchestrator.agent import orchestrator

router = APIRouter(prefix="/coach", tags=["AI Coach"])


class ReflectionRequest(BaseModel):
    evaluation: DigitalBrainEvaluation
    affective_state: str = Field(default="FLOW", description="FLOW, OVERLOAD, or FATIGUE")


@router.post("/reflection")
def generate_coaching_reflection(req: ReflectionRequest):
    """Generates non-clinical natural-language feedback and dynamic collaboration score."""
    return orchestrator.generate_coaching_reflection(
        evaluation=req.evaluation,
        affective_state=req.affective_state,
    )
