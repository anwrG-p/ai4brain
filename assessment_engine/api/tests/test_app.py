import importlib

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

# One router per module. main.py mounts all of them, so later tickets add routes here, not in main.py.
MODULE_ROUTERS = [
    "routes.telemetry",
    "routes.privacy",
    "routes.auth",
    "dynamic_cache.api",
    "ai_coach.api",
    "brain_twin_jepa.api",
]


def test_openapi_lists_telemetry_route(client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    assert "/v1/telemetry/event" in r.json()["paths"]


@pytest.mark.parametrize("module", MODULE_ROUTERS)
def test_module_router_is_mounted(module):
    router = importlib.import_module(module).router
    assert isinstance(router, APIRouter)
    probe = f"/__probe__/{module}"
    router.add_api_route(probe, lambda: {"ok": True})
    try:
        # A fresh import of main mounts the router with the probe on it.
        main = importlib.reload(importlib.import_module("main"))
        assert TestClient(main.app).get(probe).json() == {"ok": True}
    finally:
        router.routes.pop()
        importlib.reload(importlib.import_module("main"))


def test_custom_422_handler_kept(client):
    r = client.post("/v1/telemetry/event", json={"user_id": "u1"})
    assert r.status_code == 422
    assert all("input" not in e for e in r.json()["detail"])
