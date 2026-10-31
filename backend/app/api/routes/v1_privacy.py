from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response

from app.privacy.telemetry_store import (
    EXPORT_MAX_BYTES,
    ID_PATTERN,
    ExportTooLarge,
    LockTimeout,
    delete_user,
    export_user,
)

# Mounted by app/main.py. Thin wrappers: the logic lives in app.privacy.telemetry_store (no
# FastAPI there). Users are anonymous (R13): user_id is the device's anonymous id, checked with
# the ingest regex and lowercased by the store, like ingest.
router = APIRouter()

UserId = Annotated[str, Query(pattern=ID_PATTERN)]


def busy() -> HTTPException:
    return HTTPException(status_code=503, detail="telemetry store busy", headers={"Retry-After": "1"})


@router.delete("/v1/user/telemetry", responses={503: {}})
def delete_telemetry(user_id: UserId) -> dict[str, int]:
    """Delete everything stored for this id and say exactly what was removed."""
    try:
        return delete_user(user_id)
    except LockTimeout:
        raise busy()


@router.get(
    "/v1/user/export",
    response_class=Response,
    responses={404: {}, 413: {"description": f"export over {EXPORT_MAX_BYTES} bytes"}, 503: {}},
)
def export_telemetry(user_id: UserId) -> Response:
    """The raw events stored for this id, as JSONL."""
    try:
        data = export_user(user_id)
    except LockTimeout:
        raise busy()
    except ExportTooLarge as e:
        raise HTTPException(status_code=413, detail=str(e))
    if data is None:
        raise HTTPException(status_code=404, detail="no telemetry stored for this id")
    return Response(
        data,
        media_type="application/x-ndjson",
        headers={
            "Content-Disposition": f'attachment; filename="{user_id.lower()}-telemetry.jsonl"'
        },
    )
