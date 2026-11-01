"""Startup and shutdown hooks for the one FastAPI app.

Modules register plain callables here at import (dynamic_cache.api starts and stops its worker
process); app/main.py runs them from the app's lifespan, so modules never edit main.py.

- Startup hooks run in a worker thread (off the event loop), one after another. One that raises is
  logged, its own shutdown hook runs at once to undo what it half started, and boot goes on: a
  module that cannot start must not take the whole server down.
- At shutdown, in reverse registration order: the shutdown hook of every module whose startup ran
  (or that has no startup hook). Each failure is logged; the others still run.
"""

import logging
from collections.abc import Callable
from contextlib import asynccontextmanager

from starlette.concurrency import run_in_threadpool

log = logging.getLogger(__name__)

_startup: dict[str, Callable[[], None]] = {}
_shutdown: dict[str, Callable[[], None]] = {}


def on_startup(name: str, fn: Callable[[], None]) -> None:
    """Run `fn` when the server starts. A name registered again replaces the earlier hook."""
    _startup[name] = fn


def on_shutdown(name: str, fn: Callable[[], None]) -> None:
    """Run `fn` when the server stops, in reverse registration order."""
    _shutdown[name] = fn


def _stop(name: str) -> None:
    fn = _shutdown.get(name)
    if fn is None:
        return
    try:
        fn()
    except Exception as e:  # one failing hook must not keep the others from running
        log.warning("shutdown hook %s failed (%s)", name, type(e).__name__)


async def _start(name: str, fn: Callable[[], None]) -> bool:
    try:
        await run_in_threadpool(fn)
        return True
    except Exception as e:
        log.warning("startup hook %s failed (%s); serving without it", name, type(e).__name__)
        await run_in_threadpool(_stop, name)  # undo what it half started
        return False


@asynccontextmanager
async def lifespan(app):
    failed = set()
    for name, fn in list(_startup.items()):
        if not await _start(name, fn):
            failed.add(name)
    try:
        yield
    finally:
        for name in reversed(list(_shutdown)):
            if name not in failed:  # a failed start was already shut down
                await run_in_threadpool(_stop, name)
