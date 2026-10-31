"""Startup and shutdown hooks for the one FastAPI app.

Modules register plain callables here at import (dynamic_cache.api starts and stops its worker
process); app/main.py runs them from the app's lifespan, so modules never edit main.py.
"""

import logging
from collections.abc import Callable
from contextlib import asynccontextmanager

log = logging.getLogger(__name__)

_startup: dict[str, Callable[[], None]] = {}
_shutdown: dict[str, Callable[[], None]] = {}


def on_startup(name: str, fn: Callable[[], None]) -> None:
    """Run `fn` when the server starts. A name registered again replaces the earlier hook."""
    _startup[name] = fn


def on_shutdown(name: str, fn: Callable[[], None]) -> None:
    """Run `fn` when the server stops, in reverse registration order."""
    _shutdown[name] = fn


@asynccontextmanager
async def lifespan(app):
    for fn in list(_startup.values()):
        fn()
    try:
        yield
    finally:
        for name, fn in reversed(list(_shutdown.items())):
            try:
                fn()
            except Exception as e:  # one failing hook must not keep the others from running
                log.warning("shutdown hook %s failed (%s)", name, type(e).__name__)
