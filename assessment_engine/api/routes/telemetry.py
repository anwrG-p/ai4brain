import json
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from telemetry_store import ID_PATTERN, LockTimeout, telemetry_dir, telemetry_lock

Id = Annotated[str, StringConstraints(pattern=ID_PATTERN)]
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
    # 48 so the client item_id `${task_id}:${trial_index}` always fits the 64-char meta string limit.
    task_id: Annotated[str, StringConstraints(min_length=1, max_length=48)]
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
def ingest(body: TelemetryEvent | Batch) -> dict[str, int]:
    # Sync handler, so it runs in the threadpool: waiting on the lock never stalls the event loop.
    events = body if isinstance(body, list) else [body]
    out_dir = telemetry_dir()
    received_at = datetime.now(timezone.utc).isoformat()
    rows = [
        json.dumps({**e.model_dump(mode="json"), "received_at": received_at}, allow_nan=False)
        for e in events
    ]
    # ponytail: one lock for the whole directory; per-user locks only if ingest ever contends.
    try:
        with telemetry_lock(out_dir):
            for e, row in zip(events, rows):
                with open(out_dir / f"{e.user_id}.jsonl", "a", encoding="utf-8") as f:
                    f.write(row + "\n")
    except LockTimeout:
        raise HTTPException(
            status_code=503, detail="telemetry store busy", headers={"Retry-After": "1"}
        )
    return {"accepted": len(events)}
