import importlib

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

import app.main  # noqa: F401  (puts the repo root on sys.path, so the module routers below resolve)

# One router per module. app/main.py mounts all of them, so later tickets add routes there, not in main.py.
MODULE_ROUTERS = [
    "app.api.routes.v1_telemetry",
    "app.api.routes.v1_privacy",
    "dynamic_cache.api",
    "ai_coach.api",
    "brain_twin_jepa.api",
]


def reload_main():
    return importlib.reload(importlib.import_module("app.main"))


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
        assert TestClient(reload_main().app).get(probe).json() == {"ok": True}
    finally:
        router.routes.pop()
        reload_main()


# (path, method) -> the module that answers a route the v1_interop stand-ins once held. Every
# stand-in is deleted (BE-04, BE-06, BE-11), and with them v1_interop.py.
INTENTIONAL_OVERRIDES: dict[tuple[str, str], str] = {
    ("/v1/tasks/next", "GET"): "dynamic_cache.api",  # BE-04; the stand-in is deleted
    ("/v1/coach/chat", "POST"): "ai_coach.api",  # BE-06; the stand-in is deleted
    ("/v1/coach/collaboration-score", "GET"): "ai_coach.api",  # BE-06; the stand-in is deleted
    ("/v1/dashboard/profile", "GET"): "brain_twin_jepa.api",  # BE-11; the stand-in is deleted
    ("/v1/clustering/evaluate", "POST"): "brain_twin_jepa.api",  # BE-11; the stand-in is deleted
}


def flat_routes(routes, prefix=""):
    """The app's routes in match order. Included routers stay nested in FastAPI >= 0.16x."""
    for r in routes:
        nested = getattr(r, "original_router", None)
        if nested is not None:
            yield from flat_routes(nested.routes, prefix)
        elif hasattr(r, "methods"):
            yield prefix + r.path, r.methods or set(), r.endpoint.__module__


def test_the_stand_ins_are_gone_and_each_route_is_declared_once():
    import importlib.util

    assert importlib.util.find_spec("app.api.routes.v1_interop") is None
    ordered = list(flat_routes(reload_main().app.routes))
    for path, method in INTENTIONAL_OVERRIDES:
        owners = [mod for p, methods, mod in ordered if p == path and method in methods]
        assert len(owners) == 1, f"{method} {path} is declared by {owners}"


def test_intentional_overrides_are_answered_by_their_module():
    ordered = list(flat_routes(reload_main().app.routes))
    for (path, method), module in INTENTIONAL_OVERRIDES.items():
        first = next(mod for p, methods, mod in ordered if p == path and method in methods)
        assert first == module, f"{method} {path} is answered by {first}, not {module}"


def test_custom_422_handler_kept(client):
    r = client.post("/v1/telemetry/event", json={"user_id": "u1"})
    assert r.status_code == 422
    assert all("input" not in e for e in r.json()["detail"])


def test_telemetry_event_is_the_strict_ingest(client):
    # Ingest is v1_telemetry.ingest (strict TelemetryEvent model), not the old loose stand-in.
    op = client.get("/openapi.json").json()["paths"]["/v1/telemetry/event"]
    assert list(op) == ["post"]
    assert op["post"]["operationId"].startswith("ingest_")
    assert "TelemetryEvent" in str(op["post"]["requestBody"])
