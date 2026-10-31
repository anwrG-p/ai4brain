import importlib

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient

import app.main  # noqa: F401  (puts the repo root on sys.path, so the module routers below resolve)

# One router per module. app/main.py mounts all of them, so later tickets add routes there, not in main.py.
MODULE_ROUTERS = [
    "app.api.routes.v1_telemetry",
    "app.api.routes.v1_privacy",
    "app.api.routes.v1_auth",
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


@pytest.mark.parametrize("module", ["dynamic_cache.api", "ai_coach.api", "brain_twin_jepa.api"])
def test_module_routes_win_over_the_interop_router(module):
    # BE-04/06/11 add /v1 routes in their module; those must shadow the v1_interop stand-ins.
    router = importlib.import_module(module).router
    router.add_api_route("/v1/clustering/evaluate", lambda: {"from": module}, methods=["POST"])
    try:
        r = TestClient(reload_main().app).post("/v1/clustering/evaluate", json={})
        assert r.json() == {"from": module}
    finally:
        router.routes.pop()
        reload_main()


# (path, method) -> module of a route that intentionally answers instead of its v1_interop stand-in.
# BE-04/06/11 add their entry here when their module route lands, then delete the stand-in.
INTENTIONAL_OVERRIDES: dict[tuple[str, str], str] = {
    ("/v1/coach/chat", "POST"): "ai_coach.api",
    ("/v1/coach/collaboration-score", "GET"): "ai_coach.api",
}


def flat_routes(routes, prefix=""):
    """The app's routes in match order. Included routers stay nested in FastAPI >= 0.16x."""
    for r in routes:
        nested = getattr(r, "original_router", None)
        if nested is not None:
            yield from flat_routes(nested.routes, prefix)
        elif hasattr(r, "methods"):
            yield prefix + r.path, r.methods or set(), r.endpoint.__module__


def test_no_route_shadows_a_v1_interop_stand_in_by_accident():
    from app.api.routes import v1_interop

    ordered = list(flat_routes(reload_main().app.routes))
    stand_ins = [(r.path, m) for r in v1_interop.router.routes for m in r.methods]
    assert stand_ins
    # A route whose stand-in was deleted is still checked: its module must answer it.
    for path, method in [*stand_ins, *INTENTIONAL_OVERRIDES]:
        first = next(mod for p, methods, mod in ordered if p == path and method in methods)
        expected = INTENTIONAL_OVERRIDES.get((path, method), "app.api.routes.v1_interop")
        assert first == expected, f"{method} {path} is answered by {first}, not {expected}"


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
