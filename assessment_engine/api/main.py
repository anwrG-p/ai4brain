from fastapi import FastAPI

from routes.telemetry import router as telemetry_router

app = FastAPI(title="assessment_engine")
app.include_router(telemetry_router)
