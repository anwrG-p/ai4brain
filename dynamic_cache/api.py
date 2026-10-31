from fastapi import APIRouter

# Mounted by backend/app/main.py. GET /v1/tasks/next lands here (BE-04); until then the
# app.api.routes.v1_interop stand-in answers 501.
router = APIRouter()
