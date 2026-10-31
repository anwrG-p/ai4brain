"""FastAPI Raw Telemetry Ingest & Computational Psychometrics Routes."""

from fastapi import APIRouter, HTTPException
from app.models.telemetry import SessionTelemetryIngest
from app.models.brain_state import DigitalBrainEvaluation
from app.orchestrator.agent import orchestrator

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])


@router.post("/ingest", response_model=DigitalBrainEvaluation)
def ingest_session_telemetry(payload: SessionTelemetryIngest) -> DigitalBrainEvaluation:
    """Ingests raw sub-second trial telemetry, calculates EZ-DDM & 3PL-IRT parameters,

    updates the 5-node Digital Brain via Kalman filtering, and returns updated state.
    """
    try:
        evaluation = orchestrator.ingest_telemetry_and_evaluate(payload)
        return evaluation
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process telemetry: {str(e)}")
