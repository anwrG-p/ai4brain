from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from routes.telemetry import ID_PATTERN, telemetry_dir, telemetry_lock

# Mounted by main.py. Users are anonymous (R13): user_id is the device's anonymous id.
router = APIRouter()

UserId = Annotated[str, Query(pattern=ID_PATTERN)]
CHUNK = 64 * 1024


@router.delete("/v1/user/telemetry")
def delete_telemetry(user_id: UserId) -> dict[str, int]:
    """Remove `{user_id}.jsonl` and every `{user_id}.*` state file. Counts only what was removed."""
    directory = telemetry_dir()
    events = files = 0
    if not directory.is_dir():
        return {"deleted_events": 0, "deleted_files": 0}
    with telemetry_lock(directory):
        # Ids have no dots, so `u1.*` never matches `u10.jsonl`.
        for path in directory.glob(f"{user_id}.*"):
            if not path.is_file():
                continue
            if path.name == f"{user_id}.jsonl":
                text = path.read_text(encoding="utf-8")
                events = sum(1 for line in text.splitlines() if line.strip())
            path.unlink()
            files += 1
    return {"deleted_events": events, "deleted_files": files}


@router.get("/v1/user/export")
def export_telemetry(user_id: UserId) -> StreamingResponse:
    """The user's raw events as stored, one JSON object per line (GDPR Art 15 and 20)."""
    path = telemetry_dir() / f"{user_id}.jsonl"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="no telemetry stored for this id")
    # Snapshot under the lock, then stream: a slow download never blocks ingest or retention.
    with telemetry_lock(path.parent):
        try:
            data = path.read_bytes()
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="no telemetry stored for this id")
    return StreamingResponse(
        (data[i : i + CHUNK] for i in range(0, len(data), CHUNK)),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{user_id}-telemetry.jsonl"'},
    )
