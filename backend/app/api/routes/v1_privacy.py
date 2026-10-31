from typing import Annotated

from fastapi import APIRouter, Query

from app.api.routes.v1_telemetry import ID_PATTERN, telemetry_dir
from app.memory.template_memory_store import memory_store

# Mounted by app/main.py. Users are anonymous (R13): user_id is the device's anonymous id.
# BE-02 replaces this file with export, 30-day retention and the shared ingest lock.
router = APIRouter()

UserId = Annotated[str, Query(pattern=ID_PATTERN)]


@router.delete("/v1/user/telemetry")
def delete_telemetry(user_id: UserId) -> dict[str, int]:
    """Delete everything stored for this id and say exactly what was removed."""
    path = telemetry_dir() / f"{user_id}.jsonl"
    deleted_events = deleted_files = 0
    if path.is_file():
        with open(path, encoding="utf-8") as f:
            deleted_events = sum(1 for line in f if line.strip())
        path.unlink()
        deleted_files = 1
    return {
        "deleted_events": deleted_events,
        "deleted_files": deleted_files,
        # Session evaluations the in-memory agent store held (/api/telemetry/ingest).
        "deleted_evaluations": memory_store.clear_user_data(user_id),
    }
