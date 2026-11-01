"""Per-user files on disk: where they live, the lock over them, ingest and the privacy operations.

Two built-in stores, one file per user in each, both covered by delete, export and retention:
- telemetry: `{TELEMETRY_DIR}/{user_key}.jsonl` (ingest, below);
- coach chat history: `{COACH_DIR}/{user_key}.jsonl` (written by `ai_coach/chat_store.py`).
Other per-user stores (BE-04's task registry) join delete and export through
`register_user_store()`.

No FastAPI or pydantic here, so the retention CLI and other tools import it as is.
The HTTP routes (`app/api/routes/v1_telemetry.py`, `v1_privacy.py`) are thin wrappers.

User ids are case-insensitive: `user_key()` lowercases them, and every function here goes
through it, so u1 and U1 share `u1.jsonl` on every filesystem.
"""

import json
import logging
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


log = logging.getLogger(__name__)

# Per-user data kept outside the telemetry directory (BE-04's task registry, ...). Each store
# registers here once, so the privacy delete and export cover it:
#   delete(key, directory) -> how many files it removed
#   export(key, directory) -> its record for the user, or None
# key is user_key() output. directory is None for the server's own locations; when a caller
# passes an explicit telemetry directory (a tool, a test), the store keeps to `directory/<name>/`
# and touches nothing elsewhere. Registering a name again replaces the earlier hooks.
StoreDelete = Callable[[str, "Path | None"], int]
StoreExport = Callable[[str, "Path | None"], "dict | None"]
_USER_STORES: dict[str, tuple[StoreDelete, StoreExport]] = {}


def register_user_store(name: str, delete: StoreDelete, export: StoreExport) -> None:
    _USER_STORES[name] = (delete, export)


def _store_dir(directory: Path | None, name: str) -> Path | None:
    return None if directory is None else directory / name


class LockTimeout(TimeoutError):
    """The telemetry lock stayed busy past the timeout. HTTP callers answer 503."""


class StoreUnavailable(Exception):
    """A registered per-user store failed. Every other store was still tried; the operation is
    safe to repeat. HTTP callers answer 503."""


class ExportTooLarge(Exception):
    """The user's file is over EXPORT_MAX_BYTES. HTTP callers answer 413."""


def telemetry_dir() -> Path:
    env = os.environ.get("TELEMETRY_DIR")
    return Path(env) if env else REPO_ROOT / "data" / "raw" / "telemetry"


def coach_dir() -> Path:
    """The coach chat history (only what the user saw and picked). data/processed/* is gitignored."""
    env = os.environ.get("COACH_DIR")
    return Path(env) if env else REPO_ROOT / "data" / "processed" / "coach"


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


def _delete_owned(directory: Path, key: str) -> tuple[int, int]:
    """(JSONL lines, files) removed for `key` in `directory`, under that directory's lock."""
    lines = files = 0
    if not directory.is_dir():
        return 0, 0
    with telemetry_lock(directory):
        # Ids have no dots, so the part before the first dot is the owner: `u1` never matches
        # `u10.jsonl`, and `.lock` (empty owner) is never anyone's.
        for path in list(directory.iterdir()):
            if path.name.split(".", 1)[0].lower() != key or not path.is_file():
                continue
            if path.suffix.lower() == ".jsonl":
                text = path.read_text(encoding="utf-8")
                lines += sum(1 for line in text.splitlines() if line.strip())
            path.unlink()
            files += 1
    return lines, files


def delete_user(
    user_id: str, directory: Path | None = None, coach_directory: Path | None = None
) -> dict[str, int]:
    """Remove `{user_key}.jsonl` and every `{user_key}.*` state file in the telemetry and coach
    stores, then the user's records in every registered store.

    Counts only what was removed: telemetry lines as `deleted_events`, chat-history lines as
    `deleted_chat_turns`, and files from every store (registered ones included) as
    `deleted_files`. Matches file names case-insensitively, so a file written under another
    case before ids were lowercased (possible on Linux) is still found and counted.
    Raises StoreUnavailable if a registered store failed (after trying all of them),
    LockTimeout if a lock stays busy.
    """
    key = user_key(user_id)
    events, files = _delete_owned(directory or telemetry_dir(), key)
    turns, chat_files = _delete_owned(coach_directory or coach_dir(), key)
    files += chat_files
    failed = []
    for name, (delete, _) in list(_USER_STORES.items()):
        try:
            files += delete(key, _store_dir(directory, name))
        except Exception as e:  # best effort: the other stores still go; no id in the log
            log.warning("user store %s: delete failed (%s)", name, type(e).__name__)
            failed.append(name)
    if failed:
        raise StoreUnavailable(f"could not delete from {', '.join(failed)}; retry")
    return {"deleted_events": events, "deleted_chat_turns": turns, "deleted_files": files}


def _read_owned(path: Path, room: int, limit: int) -> bytes | None:
    """The file's bytes, or None. ExportTooLarge if it is over `room`, what is left of `limit`."""
    if not path.is_file():
        return None
    with telemetry_lock(path.parent):
        try:
            if path.stat().st_size > room:
                raise ExportTooLarge(f"the export is over the {limit}-byte limit")
            return path.read_bytes()
        except FileNotFoundError:
            return None


def export_user(
    user_id: str,
    directory: Path | None = None,
    max_bytes: int | None = None,
    coach_directory: Path | None = None,
) -> bytes | None:
    """Everything stored for the user as JSONL, or None if nothing is stored.

    The raw telemetry events as stored, then the coach chat history (rows with
    `"record": "coach_turn"`), then one line per registered store that keeps something for
    them (`{"record": name, "user_id": key, "data": ...}`). Each file is read whole under its
    lock, so the caller can send the result without holding a lock. Raises ExportTooLarge when
    everything together is over `max_bytes` (default EXPORT_MAX_BYTES), LockTimeout if busy,
    StoreUnavailable if a registered store fails.
    """
    key = user_key(user_id)
    limit = EXPORT_MAX_BYTES if max_bytes is None else max_bytes
    telemetry = _read_owned((directory or telemetry_dir()) / f"{key}.jsonl", limit, limit)
    room = limit - len(telemetry or b"")
    chat = _read_owned((coach_directory or coach_dir()) / f"{key}.jsonl", room, limit)
    room -= len(chat or b"")
    records, failed = [], []
    for name, (_, export) in list(_USER_STORES.items()):
        try:
            record = export(key, _store_dir(directory, name))
        except Exception as e:  # an export missing a store would look complete: fail instead
            log.warning("user store %s: export failed (%s)", name, type(e).__name__)
            failed.append(name)
            continue
        if record is not None:
            line = json.dumps({"record": name, "user_id": key, "data": record}, allow_nan=False)
            records.append(line.encode("utf-8") + b"\n")
    if failed:
        raise StoreUnavailable(f"could not export from {', '.join(failed)}; retry")
    extra = b"".join(records)
    if len(extra) > room:
        raise ExportTooLarge(f"the export is over the {limit}-byte limit")
    if telemetry is None and chat is None and not records:
        return None
    return (telemetry or b"") + (chat or b"") + extra
