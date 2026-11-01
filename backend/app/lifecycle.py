"""Startup and shutdown hooks for the one FastAPI app.

Modules register plain callables here at import (dynamic_cache.api starts and stops its worker
processes); app/main.py runs them from the app's lifespan, so modules never edit main.py.

- Startup hooks run in a worker thread (off the event loop), one after another. One that raises is
  logged, its own shutdown hook runs at once to undo what it half started, and boot goes on: a
  module that cannot start must not take the whole server down.
- Except on purpose: a hook that raises FatalStartupError (a configuration that cannot work, such
  as a bad RETENTION_DAYS) stops the boot, its message logged, instead of a server that answers
  500 on every call. A boot stopped that way, or cancelled (CancelledError, Ctrl-C), still shuts
  down every hook that had started.
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


class FatalStartupError(RuntimeError):
    """Raised by a startup hook to stop the boot; the message is logged (keep user data out)."""


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


def _running_names(failed: set[str], pending: set[str]) -> list[str]:
    """Shutdown order: reverse registration, leaving out hooks that failed (already undone) or
    whose startup never ran."""
    return [n for n in reversed(list(_shutdown)) if n not in failed and n not in pending]


@asynccontextmanager
async def lifespan(app):
    failed: set[str] = set()
    pending = set(_startup)
    try:
        for name, fn in list(_startup.items()):
            try:
                await run_in_threadpool(fn)
            except FatalStartupError as e:
                log.error("startup hook %s: %s; the server does not start", name, e)
                failed.add(name)
                _stop(name)
                raise
            except Exception as e:
                log.warning("startup hook %s failed (%s); serving without it", name, type(e).__name__)
                failed.add(name)
                await run_in_threadpool(_stop, name)  # undo what it half started
            finally:
                pending.discard(name)
    except BaseException:
        # The boot is stopped (a fatal hook, a cancelled task, Ctrl-C): undo what did start.
        # Synchronous on purpose: the task may be cancelled, so nothing here may await.
        for name in _running_names(failed, pending):
            _stop(name)
        raise
    try:
        yield
    finally:
        for name in _running_names(failed, set()):
            await run_in_threadpool(_stop, name)
