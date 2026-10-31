"""Telemetry files on disk: where they live, the lock over them, ingest and the privacy operations.

No FastAPI or pydantic here, so the retention CLI and other tools import it as is.
The HTTP routes (`app/api/routes/v1_telemetry.py`, `v1_privacy.py`) are thin wrappers.

User ids are case-insensitive: `user_key()` lowercases them, and every function here goes
through it, so u1 and U1 share `u1.jsonl` on every filesystem.
"""

import json
import os
import re
import time
from collections.abc import Callable, Iterable, Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

# The anonymous device id (R13). It is a file name, so no dots or slashes.
ID_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"
LOCK_TIMEOUT_S = 10.0
# 30 days of one user's events is far below this; the ceiling only bounds export memory.
EXPORT_MAX_BYTES = 50 * 1024 * 1024

# privacy/ -> app/ -> backend/ -> repo root, whose data/raw/* is gitignored.
REPO_ROOT = Path(__file__).resolve().parents[3]


class LockTimeout(TimeoutError):
    """The telemetry lock stayed busy past the timeout. HTTP callers answer 503."""


class ExportTooLarge(Exception):
    """The user's file is over EXPORT_MAX_BYTES. HTTP callers answer 413."""


def telemetry_dir() -> Path:
    env = os.environ.get("TELEMETRY_DIR")
    return Path(env) if env else REPO_ROOT / "data" / "raw" / "telemetry"


def check_user_id(user_id: str) -> None:
    if not isinstance(user_id, str) or not re.fullmatch(ID_PATTERN, user_id):
        raise ValueError("user_id must match " + ID_PATTERN)


def user_key(user_id: str) -> str:
    """The one place ids are normalised: checked, then lowercased. It names the user's files."""
    check_user_id(user_id)
    return user_id.lower()


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


def append_events(
    events: Iterable[dict], directory: Path | None = None, received_at: datetime | None = None
) -> int:
    """Append already-validated events (JSON-ready dicts) to `{user_key}.jsonl` under the lock.

    Each row gets `received_at` and its lowercased `user_id`. Every id is checked before
    anything is written, so a bad id writes nothing. Raises LockTimeout if the lock stays busy.
    """
    directory = directory or telemetry_dir()
    stamp = (received_at or datetime.now(timezone.utc)).isoformat()
    rows = []
    for event in events:
        key = user_key(event["user_id"])
        row = {**event, "user_id": key, "received_at": stamp}
        rows.append((key, json.dumps(row, allow_nan=False)))
    if not rows:
        return 0
    # ponytail: one lock for the whole directory; per-user locks only if ingest ever contends.
    with telemetry_lock(directory):
        for key, row in rows:
            with open(directory / f"{key}.jsonl", "a", encoding="utf-8") as f:
                f.write(row + "\n")
    return len(rows)


def delete_user(user_id: str, directory: Path | None = None) -> dict[str, int]:
    """Remove `{user_key}.jsonl` and every `{user_key}.*` state file. Counts only what was removed.

    Matches file names case-insensitively, so a file written under another case before ids
    were lowercased (possible on Linux) is still found and counted.
    """
    key = user_key(user_id)
    directory = directory or telemetry_dir()
    events = files = 0
    if not directory.is_dir():
        return {"deleted_events": 0, "deleted_files": 0}
    with telemetry_lock(directory):
        # Ids have no dots, so the part before the first dot is the owner: `u1` never matches
        # `u10.jsonl`, and `.lock` (empty owner) is never anyone's.
        for path in list(directory.iterdir()):
            if path.name.split(".", 1)[0].lower() != key or not path.is_file():
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
    Raises ExportTooLarge above `max_bytes` (default EXPORT_MAX_BYTES), LockTimeout if busy.
    """
    key = user_key(user_id)
    limit = EXPORT_MAX_BYTES if max_bytes is None else max_bytes
    path = (directory or telemetry_dir()) / f"{key}.jsonl"
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
