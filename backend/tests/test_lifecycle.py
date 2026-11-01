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


def test_a_failing_startup_hook_does_not_block_boot(hooks, caplog):
    calls = []
    lifecycle.on_startup("broken", lambda: 1 / 0)
    lifecycle.on_shutdown("broken", lambda: calls.append("undo broken"))
    lifecycle.on_startup("fine", lambda: calls.append("start fine"))
    lifecycle.on_shutdown("fine", lambda: calls.append("stop fine"))
    with TestClient(app) as c:
        assert c.get("/").status_code == 200  # the server booted
        # The failed hook's shutdown ran at once, to undo what it half started; the next still ran.
        assert calls == ["undo broken", "start fine"]
    assert calls == ["undo broken", "start fine", "stop fine"]  # not undone twice
    assert "startup hook broken failed (ZeroDivisionError)" in caplog.text


def test_startup_hooks_run_off_the_event_loop(hooks):
    import asyncio

    on_loop = []

    def probe():
        try:
            asyncio.get_running_loop()
            on_loop.append(True)  # called straight from the lifespan coroutine
        except RuntimeError:
            on_loop.append(False)  # a worker thread: no loop running here

    lifecycle.on_startup("probe", probe)
    with TestClient(app):
        pass
    assert on_loop == [False]


def test_dynamic_cache_registers_its_worker_hooks():
    import dynamic_cache.api  # noqa: F401

    assert "dynamic_cache" in lifecycle._startup and "dynamic_cache" in lifecycle._shutdown
