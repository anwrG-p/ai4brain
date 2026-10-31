from fastapi import APIRouter

# Mounted by backend/app/main.py. Coach chat and collaboration-score routes land here (BE-06), only
# with the backup crisis classifier (R14); until then the v1_interop stand-ins answer 501.
router = APIRouter()
