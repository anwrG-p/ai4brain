from typing import Annotated

from fastapi import APIRouter, Query

from app.api.routes.v1_telemetry import ID_PATTERN, telemetry_dir

# Mounted by app/main.py. Users are anonymous (R13): user_id is the device's anonymous id.
# BE-02 replaces this file with export, 30-day retention and the shared ingest lock.
router = APIRouter()

UserId = Annotated[str, Query(pattern=ID_PATTERN)]


@router.delete("/v1/user/telemetry")
def delete_telemetry(user_id: UserId) -> dict[str, int]:
    """Delete the stored telemetry for this id and say exactly what was removed.

    The JSONL file is the only per-user data the server holds.
    """
    path = telemetry_dir() / f"{user_id}.jsonl"
    if not path.is_file():
        return {"deleted_events": 0, "deleted_files": 0}
    with open(path, encoding="utf-8") as f:
        deleted_events = sum(1 for line in f if line.strip())
    path.unlink()
    return {"deleted_events": deleted_events, "deleted_files": 1}
