"""Workspace-wide test fixtures (every suite in pytest.ini's testpaths)."""

import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "benchmark: wall-clock latency test; budget P99_BUDGET_MS (10 ms, 20 ms when CI is set); "
        'leave out with -m "not benchmark"',
    )


@pytest.fixture(autouse=True)
def _isolated_task_registry(tmp_path_factory, monkeypatch):
    """Every test serves tasks from, and deletes/exports against, a temporary task registry, never
    the real data/processed/task_registry. Subprocesses (the retention CLI) inherit the env var.
    The served dispatcher has no worker process or writer thread, and the rate limit starts empty."""
    registry = tmp_path_factory.mktemp("task_registry")
    monkeypatch.setenv("TASK_REGISTRY_DIR", str(registry))
    try:
        from dynamic_cache import api
    except ImportError:  # a checkout without the server: nothing to isolate
        yield
        return
    dispatcher = api.make_dispatcher(registry_dir=lambda: registry, background=False)
    previous = api.set_dispatcher(dispatcher)
    api.limiter.reset()
    yield
    api.set_dispatcher(previous)
    dispatcher.close()


@pytest.fixture(autouse=True)
def _isolated_coach_store(tmp_path_factory, monkeypatch):
    """Every suite (not only backend/tests) deletes and exports against a temporary coach chat
    history, never the real data/processed/coach: the privacy delete and export cover that store."""
    monkeypatch.setenv("COACH_DIR", str(tmp_path_factory.mktemp("coach")))


@pytest.fixture(autouse=True)
def _isolated_state_bus(tmp_path_factory, monkeypatch):
    """Every test keeps the state bus (BE-11) in a temporary folder, and starts with no clustering
    model and no twin checkpoint: a test that wants one saves it and points the env var at it, so
    no test depends on what `python -m brain_twin_jepa.bootstrap` left in models/."""
    models = tmp_path_factory.mktemp("models")
    monkeypatch.setenv("STATE_BUS_DIR", str(tmp_path_factory.mktemp("state_bus")))
    monkeypatch.setenv("CLUSTER_MODEL_PATH", str(models / "none-gmm.json"))
    monkeypatch.setenv("TWIN_CHECKPOINT", str(models / "none-twin.pt"))
