from fastapi import APIRouter

# Mounted by backend/app/main.py. Profile and clustering routes land here (BE-11); they then
# shadow the stand-ins in backend/app/api/routes/v1_interop.py, which BE-11 deletes.
router = APIRouter()
