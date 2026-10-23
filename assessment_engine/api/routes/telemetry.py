import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Id = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{1,64}$")]
MetaKey = Annotated[str, StringConstraints(pattern=r"^[a-z0-9_]{1,32}$")]
MetaValue = Annotated[str, StringConstraints(max_length=64)] | int | float | bool

Dimension = Literal[
    "working_memory",
    "pattern_induction",
    "executive_function",
    "spatial_orientation",
    "processing_speed",
    "episodic_memory",
]


class TelemetryEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    user_id: Id
    session_id: Id
    task_id: Annotated[str, StringConstraints(min_length=1, max_length=128)]
    trial_index: Annotated[int, Field(ge=0)]
    dimension: Dimension
    score_norm: Annotated[float, Field(ge=0, le=1)]
    response_time_ms: Annotated[float, Field(ge=0, le=600_000)]
    error_flag: bool
    error_burst: Annotated[int, Field(ge=0)]
    hesitation_jitter: Annotated[float, Field(ge=0)]
    keystroke_latency_ms: Annotated[float, Field(ge=0)] | None = None
    trial_meta: Annotated[dict[MetaKey, MetaValue], Field(max_length=16)] = {}
    voice_opt_in: bool = False
    voice_latency_ms: Annotated[float, Field(ge=0)] | None = None
    vocal_pace_hz: Annotated[float, Field(ge=0)] | None = None
    client_ts: datetime

    @model_validator(mode="after")
    def voice_requires_opt_in(self):
        if not self.voice_opt_in and (
            self.voice_latency_ms is not None or self.vocal_pace_hz is not None
        ):
            raise ValueError("voice fields require voice_opt_in")
        return self


Batch = Annotated[list[TelemetryEvent], Field(max_length=100)]

router = APIRouter()


@router.post("/v1/telemetry/event", status_code=202)
async def ingest(body: TelemetryEvent | Batch) -> dict[str, int]:
    events = body if isinstance(body, list) else [body]
    out_dir = Path(os.environ.get("TELEMETRY_DIR", "data/raw/telemetry"))
    out_dir.mkdir(parents=True, exist_ok=True)
    received_at = datetime.now(timezone.utc).isoformat()
    # ponytail: sync appends inside an async handler are serialized on the event loop, so lines
    # never interleave within one uvicorn worker; Redis Streams if multiple workers.
    for e in events:
        line = json.dumps(
            {**e.model_dump(mode="json"), "received_at": received_at}, allow_nan=False
        )
        with open(out_dir / f"{e.user_id}.jsonl", "a", encoding="utf-8") as f:
            f.write(line + "\n")
    return {"accepted": len(events)}
