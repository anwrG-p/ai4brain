"""app/lifecycle.py: modules' startup/shutdown hooks run from the app's lifespan."""

import asyncio

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


def test_a_fatal_startup_hook_stops_the_boot_and_undoes_what_started(hooks, caplog):
    calls = []
    lifecycle.on_startup("first", lambda: calls.append("start first"))
    lifecycle.on_shutdown("first", lambda: calls.append("stop first"))

    def bad_config():
        raise lifecycle.FatalStartupError("RETENTION_DAYS must be at least 1")

    lifecycle.on_startup("bad", bad_config)
    lifecycle.on_startup("never", lambda: calls.append("start never"))
    lifecycle.on_shutdown("never", lambda: calls.append("stop never"))
    with pytest.raises(lifecycle.FatalStartupError):
        with TestClient(app):
            pass
    assert calls == ["start first", "stop first"]  # the later hook neither started nor stopped
    assert "startup hook bad: RETENTION_DAYS must be at least 1; the server does not start" in caplog.text


@pytest.mark.parametrize("interrupt", [asyncio.CancelledError, KeyboardInterrupt])
def test_a_cancelled_startup_still_shuts_down_what_started(hooks, interrupt):
    calls = []
    lifecycle.on_startup("first", lambda: calls.append("start first"))
    lifecycle.on_shutdown("first", lambda: calls.append("stop first"))

    def interrupted():
        raise interrupt()

    lifecycle.on_startup("second", interrupted)
    lifecycle.on_shutdown("second", lambda: calls.append("stop second"))

    async def boot():
        async with lifecycle.lifespan(None):
            calls.append("served")

    with pytest.raises(interrupt):
        asyncio.run(boot())
    # Never served; the interrupted hook is undone too (it may have half started), then the first.
    assert calls == ["start first", "stop second", "stop first"]


def test_a_bad_retention_setting_stops_the_boot(monkeypatch, caplog):
    """Review repro (badret.py): the server booted and answered 500 on every tasks call."""
    monkeypatch.setenv("RETENTION_DAYS", "0")
    with pytest.raises(lifecycle.FatalStartupError):
        with TestClient(app):
            pass
    assert "RETENTION_DAYS must be a whole number of days, at least 1" in caplog.text
    assert "the server does not start" in caplog.text


def test_dynamic_cache_registers_its_worker_hooks():
    import dynamic_cache.api  # noqa: F401

    assert "dynamic_cache" in lifecycle._startup and "dynamic_cache" in lifecycle._shutdown
