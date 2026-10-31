from fastapi import APIRouter

# Mounted by app/main.py. Empty: users are anonymous (R13), so there are no accounts to sign in to.
router = APIRouter()
