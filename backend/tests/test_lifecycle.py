"""app/lifecycle.py: modules' startup/shutdown hooks run from the app's lifespan."""

import pytest
from fastapi.testclient import TestClient

from app import lifecycle
from app.main import app


@pytest.fixture
def hooks(monkeypatch):
    monkeypatch.setattr(lifecycle, "_startup", {})
    monkeypatch.setattr(lifecycle, "_shutdown", {})


def test_hooks_run_once_each_shutdown_in_reverse(hooks):
    calls = []
    lifecycle.on_startup("a", lambda: calls.append("start a"))
    lifecycle.on_shutdown("a", lambda: calls.append("stop a"))
    lifecycle.on_shutdown("b", lambda: calls.append("stop b"))
    with TestClient(app):
        assert calls == ["start a"]
    assert calls == ["start a", "stop b", "stop a"]


def test_a_failing_shutdown_hook_does_not_stop_the_others(hooks, caplog):
    calls = []
    lifecycle.on_shutdown("first", lambda: calls.append("first"))
    lifecycle.on_shutdown("broken", lambda: 1 / 0)
    with TestClient(app):
        pass
    assert calls == ["first"] and "broken" in caplog.text


def test_dynamic_cache_registers_its_worker_hooks():
    import dynamic_cache.api  # noqa: F401

    assert "dynamic_cache" in lifecycle._startup and "dynamic_cache" in lifecycle._shutdown
