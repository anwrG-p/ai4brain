"""Telemetry files on disk: where they live, the lock over them, and the privacy operations.

No FastAPI or pydantic here, so another server can import these functions as they are.
The HTTP routes (`routes/telemetry.py`, `routes/privacy.py`) are thin wrappers.
"""

import os
import re
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path

# The anonymous device id (R13). It is a file name, so no dots or slashes.
ID_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"
LOCK_TIMEOUT_S = 10.0
# 30 days of one user's events is far below this; the ceiling only bounds export memory.
EXPORT_MAX_BYTES = 50 * 1024 * 1024

# api/ -> assessment_engine/ -> repo root, whose data/raw/* is gitignored.
REPO_ROOT = Path(__file__).resolve().parents[2]


class LockTimeout(TimeoutError):
    """The telemetry lock stayed busy past the timeout. HTTP callers answer 503."""


class ExportTooLarge(Exception):
    """The user's file is over EXPORT_MAX_BYTES. HTTP callers answer 413."""


def telemetry_dir() -> Path:
    env = os.environ.get("TELEMETRY_DIR")
    return Path(env) if env else REPO_ROOT / "data" / "raw" / "telemetry"


def check_user_id(user_id: str) -> None:
    if not re.fullmatch(ID_PATTERN, user_id):
        raise ValueError("user_id must match " + ID_PATTERN)


def _try_lock(f) -> bool:
    try:
        if os.name == "nt":
            import msvcrt

            f.seek(0)
            msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        return False
    return True


def _unlock(f) -> None:
    if os.name == "nt":
        import msvcrt

        f.seek(0)
        msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
    else:
        import fcntl

        fcntl.flock(f, fcntl.LOCK_UN)


@contextmanager
def telemetry_lock(
    directory: Path, timeout: float | None = None, on_wait: Callable[[], None] | None = None
) -> Iterator[None]:
    """Exclusive lock over every file in `directory`, across threads and processes.

    Ingest, delete, export and retention all hold it, so a rewrite never drops an append.
    Not re-entrant: taking it again while holding it waits on itself, then raises LockTimeout.
    Raises LockTimeout after `timeout` seconds (default LOCK_TIMEOUT_S). `on_wait` runs once
    if the lock is busy on the first try.
    """
    timeout = LOCK_TIMEOUT_S if timeout is None else timeout
    directory.mkdir(parents=True, exist_ok=True)
    with open(directory / ".lock", "a+b") as f:
        deadline = time.monotonic() + timeout
        if not _try_lock(f):
            if on_wait:
                on_wait()
            while not _try_lock(f):
                if time.monotonic() >= deadline:
                    raise LockTimeout(f"telemetry lock busy for {timeout:g} s")
                time.sleep(0.01)
        try:
            yield
        finally:
            _unlock(f)


def delete_user(user_id: str, directory: Path | None = None) -> dict[str, int]:
    """Remove `{user_id}.jsonl` and every `{user_id}.*` state file. Counts only what was removed."""
    check_user_id(user_id)
    directory = directory or telemetry_dir()
    events = files = 0
    if not directory.is_dir():
        return {"deleted_events": 0, "deleted_files": 0}
    with telemetry_lock(directory):
        # Ids have no dots, so `u1.*` never matches `u10.jsonl`. On a case-insensitive disk
        # `U1.*` matches `u1.jsonl`: count by what the matched file is, not by the asked name.
        for path in directory.glob(f"{user_id}.*"):
            if not path.is_file():
                continue
            if path.suffix.lower() == ".jsonl":
                text = path.read_text(encoding="utf-8")
                events += sum(1 for line in text.splitlines() if line.strip())
            path.unlink()
            files += 1
    return {"deleted_events": events, "deleted_files": files}


def export_user(
    user_id: str, directory: Path | None = None, max_bytes: int | None = None
) -> bytes | None:
    """The user's raw events as stored (JSONL), or None if nothing is stored.

    Read whole under the lock, so the caller can send it without holding the lock.
    """
    check_user_id(user_id)
    limit = EXPORT_MAX_BYTES if max_bytes is None else max_bytes
    path = (directory or telemetry_dir()) / f"{user_id}.jsonl"
    if not path.is_file():
        return None
    with telemetry_lock(path.parent):
        try:
            size = path.stat().st_size
            if size > limit:
                raise ExportTooLarge(f"{size} bytes is over the {limit}-byte export limit")
            return path.read_bytes()
        except FileNotFoundError:
            return None
