"""Task dispatcher behind GET /v1/tasks/next (BE-04).

- Pools: per (archetype, schema_type, theta level), in memory, holding pre-built payloads already
  serialised to JSON. A pop that leaves a pool half empty queues a refill in a worker process, so
  the BE-03 generators (sync, CPU-bound) never run on the event loop, rarely on a request, and
  never hold the GIL against request threads. An empty pool builds one task inline, in the
  request's worker thread. The worker exits with its parent, even on a hard kill.
- Archetype: until clustering (BE-09/BE-11) assigns one, every user is NEUTRAL.
- No repeats: a per-user TimedBloom (bloom.py) of served task ids; nothing seen in the last 14 days
  is served again.
- Idempotent per (user, session_id, seq, filter): the same call in the same session returns the
  same task, byte for byte. Without a session_id every call is a new task.
- One task_id, one run: apart from that replay, a user is never served a task_id again within the
  TTL, retakes included (the Bloom check above). BE-07 dedupes events on (session_id,
  task_id:trial_index, stream), so a second run under a reused task_id would lose its trials.
  The client must therefore send a new seq (or session_id) for every run, and reuse one only to
  re-ask for the same run (StrictMode's double effect).
- Difficulty: a per-user, per-schema staircase. It starts at the parameter projector's theta from
  the user's pillar scores (START_THETA when there are none). It steps by the 85% rule only once
  MIN_TRIALS trials of the schema arrived since its last step, and only on those trials: each
  trial is counted once, so a single-trial task (matrix, tower) cannot wind it up by re-reading
  the same window after every task, and tasks fetched but never played do not move it.
- Registry: the Bloom slices, session answers and staircases are one JSON file per user under
  data/processed/task_registry/, written behind the request by a background thread. The file is
  the source of truth: memory keeps at most MAX_USERS users and evicts clean, idle ones first.
  A registry idle for `retention_days` is dropped (in memory on next use, on disk by purge_idle,
  which the retention CLI runs). Both read one setting, env RETENTION_DAYS (default 30): the
  server passes it in through dynamic_cache.api, the CLI uses it as its --days default.
  forget() and export() back the privacy delete and export.

Thread safety: a per-user lock serialises one user's calls (so a double GET in the same session
cannot hand out two tasks); one dispatcher lock guards the pools and the user table.
"""

from __future__ import annotations

import json
import logging
import multiprocessing
import multiprocessing.connection
import os
import random
import re
import threading
import time
from collections import OrderedDict, deque
from collections.abc import Callable, Iterator, Mapping, Sequence
from concurrent.futures import Future, ProcessPoolExecutor, ThreadPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, NamedTuple

from .bloom import DAY_S, TTL_DAYS, TimedBloom
from .generators import DIMENSION_OF, SCHEMA_TYPES, generate
from .parameter_projector import BOUNDS, START_THETA, clamp, project

log = logging.getLogger(__name__)

NEUTRAL = "neutral"
# Generator options per archetype. Stroop is pinned to the classic inks: cvd_safe needs `black`,
# which Stroop.tsx does not paint yet (BE-03), so it is never served.
ARCHETYPE_OPTIONS: dict[str, dict[str, dict[str, Any]]] = {NEUTRAL: {"stroop": {"inks": "classic"}}}

LEVEL_STEP = 0.1  # pools are keyed by theta snapped to this grid
POOL_SIZE = 16  # payloads kept per pool
SESSIONS_KEPT = 64  # idempotency answers kept per user (and none older than the TTL)
REPLAY_CACHE = 256  # serialised payloads kept for session replays
FRESH_TRIES = 8  # inline builds tried when every pooled task was already seen
MAX_USERS = 5000  # user registries kept in memory; the files hold the rest
RETENTION_DAYS = 30  # a registry idle this long is dropped (the telemetry retention period)

# The 85% rule (backend/app/tools/exercise_generator.py) works on an IRT difficulty b in [-2.5, 2.5];
# theta in [0, 1] maps onto it linearly. (A) step 1.0: at 95% accuracy theta rises by 0.04, at 70%
# it falls by 0.06; Hamza's default 0.25 moves theta by at most 0.015 per step.
RULE_STEP = 1.0
MIN_TRIALS = 10  # new trials of a schema needed before the staircase steps
ACCURACY_WINDOW = 60  # at most this many of the newest new trials count in one step
KEEP_TRIALS = 500  # trials per schema kept from the telemetry tail
TELEMETRY_TAIL_BYTES = 1 << 20  # only the end of a user's JSONL is read

KEY_RE = re.compile(r"^[a-z0-9_-]{1,64}$")  # telemetry_store.user_key() output


class NoFreshTask(RuntimeError):
    """Every task tried was served to this user within the TTL (practically never: seeds are 32-bit)."""


class Entry(NamedTuple):
    task_id: str
    body: bytes  # the TaskPayload as JSON
    seed: int


class Served(NamedTuple):
    body: bytes
    task_id: str
    schema_type: str
    theta: float  # the pool level served
    replay: bool


class Trial(NamedTuple):
    correct: bool
    marker: str  # "{received_at}|{session_id}|{task_id}|{trial_index}": unique per counted trial


def theta_level(schema_type: str, theta: float) -> float:
    return clamp(schema_type, round(round(theta / LEVEL_STEP) * LEVEL_STEP, 4))


def levels(schema_type: str) -> list[float]:
    lo, hi = BOUNDS[schema_type]
    out = sorted({theta_level(schema_type, lo + k * LEVEL_STEP) for k in range(int(round((hi - lo) / LEVEL_STEP)) + 1)})
    return out or [theta_level(schema_type, lo)]


def schemas_for(schema_type: str | None, dimension: str | None) -> list[str]:
    """The schemas a request allows, in SCHEMA_TYPES order. Empty when the two filters disagree."""
    return [
        s
        for s in SCHEMA_TYPES
        if (schema_type is None or s == schema_type) and (dimension is None or DIMENSION_OF[s] == dimension)
    ]


def rule_step(rule: Callable[..., float], theta: float, accuracy: float) -> float:
    """One step of the 85% rule, from theta through b = 5 * theta - 2.5 and back."""
    b = rule(historical_accuracy=accuracy, current_difficulty_b=5.0 * theta - 2.5, step_size=RULE_STEP)
    return (b + 2.5) / 5.0


# --- building payloads (also in the worker process) -------------------------------------------------


def build_entry(archetype: str, schema_type: str, level: float, seed: int) -> Entry:
    """One payload, built and serialised. Module level, so the worker process can run it."""
    options = ARCHETYPE_OPTIONS.get(archetype, ARCHETYPE_OPTIONS[NEUTRAL]).get(schema_type, {})
    # validate=True (the default): the served schema and the solvers check every payload, and
    # allow_unserved stays False, so no unserved content (black ink) can get through.
    payload = generate(schema_type, level, seed, **options)
    body = json.dumps(payload, separators=(",", ":"), allow_nan=False).encode("utf-8")
    return Entry(payload["task_id"], body, seed)


def build_entries(archetype: str, schema_type: str, level: float, seeds: list[int]) -> list[Entry]:
    return [build_entry(archetype, schema_type, level, seed) for seed in seeds]


def worker_pid() -> int:
    return os.getpid()


def _exit_with_parent() -> None:
    """Worker initializer: a daemon thread ends the worker as soon as its parent is gone, so a
    hard-killed server (no shutdown hook) leaves no orphan process behind."""
    parent = multiprocessing.parent_process()
    if parent is None:
        return

    def watch() -> None:
        multiprocessing.connection.wait([parent.sentinel])
        os._exit(0)

    threading.Thread(target=watch, name="exit-with-parent", daemon=True).start()


def worker_pool() -> ProcessPoolExecutor:
    # spawn everywhere: fork from a threaded server (uvicorn's pool) can deadlock the child, and
    # Python 3.12+ warns about it on Linux.
    return ProcessPoolExecutor(
        max_workers=1, mp_context=multiprocessing.get_context("spawn"), initializer=_exit_with_parent
    )


# --- telemetry: trials per schema ---------------------------------------------------------------------


def schema_of(task_id: str) -> str | None:
    """Generated task ids start with their schema (`{schema}-{seed}-...`); fixture ids do not."""
    head = task_id.split("-", 1)[0]
    return head if head in DIMENSION_OF else None


def trials_by_schema(lines: list[str]) -> dict[str, list[Trial]]:
    """Each schema's trials from JSONL lines, oldest first, the last KEEP_TRIALS of each.

    Duplicates (a batch resent after a timeout) count once: the key is the trial's item id and
    stream when it has one (as BE-07 dedupes), else (session, task, trial_index).
    """
    seen: set[tuple] = set()
    out: dict[str, list[Trial]] = {}
    for line in lines:
        try:
            e = json.loads(line)
            schema = schema_of(e["task_id"])
            if schema is None or not isinstance(e["error_flag"], bool):
                continue
            meta = e.get("trial_meta") or {}
            key = (
                (e["session_id"], meta["item_id"], meta.get("stream"))
                if "item_id" in meta
                else (e["session_id"], e["task_id"], e["trial_index"])
            )
        except (ValueError, KeyError, TypeError, AttributeError):
            continue  # a torn last line or a row this reader does not understand
        if key in seen:
            continue
        seen.add(key)
        marker = f"{e.get('received_at', '')}|{e['session_id']}|{e['task_id']}|{e['trial_index']}"
        out.setdefault(schema, []).append(Trial(not e["error_flag"], marker))
    return {s: rows[-KEEP_TRIALS:] for s, rows in out.items()}


def trials_since(trials: Sequence[Trial], marker: str | None) -> list[Trial]:
    """The trials after the one `marker` names.

    If that trial left the window (retention, the tail limit): the trials received after its
    received_at. When there is no received_at to compare (the marked trial or every trial lacks
    one), the newest ACCURACY_WINDOW trials, so the staircase steps once and re-anchors on a
    marker it can find, instead of freezing for good.
    """
    if marker is None:
        return list(trials)
    for i in range(len(trials) - 1, -1, -1):
        if trials[i].marker == marker:
            return list(trials[i + 1 :])
    received = marker.split("|", 1)[0]
    stamps = [t.marker.split("|", 1)[0] for t in trials]
    if not received or not any(stamps):
        return list(trials[-ACCURACY_WINDOW:])
    return [t for t, stamp in zip(trials, stamps) if stamp > received]


class TelemetryTrials:
    """Reads the tail of `{dir}/{key}.jsonl`; cached until the file's size or mtime changes.
    The cache keeps at most MAX_USERS users."""

    def __init__(self, directory: Callable[[], Path], max_users: int = MAX_USERS) -> None:
        self.directory = directory
        self.max_users = max_users
        self._cache: OrderedDict[str, tuple[tuple[int, int], dict[str, list[Trial]]]] = OrderedDict()
        self._lock = threading.Lock()

    def __call__(self, key: str, schema_type: str) -> list[Trial]:
        path = self.directory() / f"{key}.jsonl"
        try:
            st = path.stat()
        except OSError:
            return []
        stamp = (st.st_size, st.st_mtime_ns)
        with self._lock:
            hit = self._cache.get(key)
        if hit is None or hit[0] != stamp:
            try:
                with open(path, "rb") as f:
                    f.seek(max(0, st.st_size - TELEMETRY_TAIL_BYTES))
                    raw = f.read(TELEMETRY_TAIL_BYTES)
            except OSError:
                return []
            lines = raw.decode("utf-8", errors="replace").splitlines()
            if st.st_size > TELEMETRY_TAIL_BYTES:
                lines = lines[1:]  # the first line was cut by the seek
            hit = (stamp, trials_by_schema(lines))
        with self._lock:
            self._cache[key] = hit
            self._cache.move_to_end(key)
            while len(self._cache) > self.max_users:
                self._cache.popitem(last=False)
        return hit[1].get(schema_type, [])

    def forget(self, key: str) -> None:
        with self._lock:
            self._cache.pop(key, None)


# --- per-user registry ---------------------------------------------------------------------------


@dataclass
class UserState:
    seen: TimedBloom = field(default_factory=TimedBloom)
    # idempotency key -> {"schema", "theta", "seed", "archetype", "task_id", "at"}: enough to rebuild
    sessions: dict[str, dict] = field(default_factory=dict)
    # schema -> {"theta": staircase value, "marker": last trial stepped on, "served_at"}
    schemas: dict[str, dict] = field(default_factory=dict)
    last: float = 0.0  # last time a task was served

    def to_json(self) -> dict:
        return {"v": 1, "seen": self.seen.to_json(), "sessions": self.sessions, "schemas": self.schemas, "last": self.last}

    @classmethod
    def from_json(cls, doc: Mapping) -> "UserState":
        return cls(
            TimedBloom.from_json(doc.get("seen")),
            dict(doc.get("sessions") or {}),
            dict(doc.get("schemas") or {}),
            float(doc.get("last") or 0.0),
        )

    def prune(self, now: float) -> None:
        self.seen.expire(now)
        oldest = now - TTL_DAYS * DAY_S
        live = sorted((r["at"], k) for k, r in self.sessions.items() if r.get("at", 0) >= oldest)
        self.sessions = {k: self.sessions[k] for _, k in live[-SESSIONS_KEPT:]}


def default_registry_dir() -> Path:
    env = os.environ.get("TASK_REGISTRY_DIR")
    # dynamic_cache/ -> repo root, whose data/processed/* is gitignored.
    return Path(env) if env else Path(__file__).resolve().parents[1] / "data" / "processed" / "task_registry"


def purge_idle(directory: Path, days: int = RETENTION_DAYS, now: float | None = None) -> int:
    """Delete the registry files nobody touched for `days` (the file is rewritten on every change,
    so its mtime is the user's last activity). Returns how many were removed."""
    cutoff = (time.time() if now is None else now) - days * DAY_S
    removed = 0
    if not directory.is_dir():
        return 0
    for path in directory.iterdir():
        if not (path.name.endswith(".json") or path.name.endswith(".json.tmp")) or not path.is_file():
            continue
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink()
                removed += path.name.endswith(".json")
        except FileNotFoundError:
            pass  # deleted meanwhile (privacy delete, a live write's replace)
    return removed


class Dispatcher:
    def __init__(
        self,
        *,
        registry_dir: Callable[[], Path] = default_registry_dir,
        trials: Callable[[str, str], Sequence[Trial]] = lambda key, schema: [],
        pillars: Callable[[str], Mapping[str, float | None] | None] = lambda key: None,
        archetype: Callable[[str], str] = lambda key: NEUTRAL,
        difficulty_rule: Callable[..., float] | None = None,
        clock: Callable[[], float] = time.time,
        seed_source: Callable[[], int] = lambda: random.SystemRandom().randrange(2**32),
        pool_size: int = POOL_SIZE,
        max_users: int = MAX_USERS,
        retention_days: int = RETENTION_DAYS,
        background: bool = True,
    ) -> None:
        self.registry_dir = registry_dir
        self.trials = trials
        self.pillars = pillars
        self.archetype = archetype
        self.difficulty_rule = difficulty_rule
        self.clock = clock
        self.seed_source = seed_source
        self.pool_size = pool_size
        self.max_users = max_users
        self.retention_days = retention_days  # the server passes RETENTION_DAYS from the env

        # Pools, the user table, pins, the dirty set. Re-entrant: a refill future that is already
        # done runs its callback (which takes the lock) in the submitting thread.
        self._lock = threading.RLock()
        self._io_lock = threading.Lock()  # registry files
        self._pools: dict[tuple[str, str, float], deque[Entry]] = {}
        self._refilling: set[tuple[str, str, float]] = set()
        self._users: OrderedDict[str, UserState] = OrderedDict()  # least recently used first
        self._user_locks: dict[str, threading.Lock] = {}  # only for users with a call in flight
        self._pins: dict[str, int] = {}  # calls in flight per user
        self._dirty: dict[str, int] = {}  # user -> generation not yet written
        self._flush_queued = False
        self._closed = False
        self._replays: OrderedDict[str, bytes] = OrderedDict()
        # Refills run in a worker process: building is CPU-bound Python, and in a thread it would
        # hold the GIL against the request threads (measured: 20-40 ms requests under uvicorn).
        self._workers = worker_pool() if background else None
        self._writer = ThreadPoolExecutor(max_workers=1, thread_name_prefix="task-registry") if background else None

    # --- building payloads -----------------------------------------------------------------------

    def start(self) -> Future | None:
        """Spawn the worker process now (server startup), so no request pays for it. Does not
        wait: the returned future resolves to the worker's pid. If the worker cannot start, the
        dispatcher logs it and builds every task inline from then on, rather than failing."""
        with self._lock:
            workers = self._workers
        if workers is None:
            return None
        try:
            future = workers.submit(worker_pid)
        except Exception as e:  # spawn refused outright (shut down, no processes allowed, ...)
            self._no_workers(e)
            return None
        future.add_done_callback(lambda f: f.cancelled() or f.exception() is None or self._no_workers(f.exception()))
        return future

    def _no_workers(self, error: BaseException) -> None:
        log.warning("task worker process unavailable (%s); building tasks inline", type(error).__name__)
        with self._lock:
            workers, self._workers = self._workers, None
            self._refilling.clear()
        if workers is not None:
            workers.shutdown(wait=False, cancel_futures=True)

    def _fill(self, pool_key: tuple[str, str, float]) -> None:
        """Top the pool up in the caller's thread (warm-up)."""
        archetype, schema_type, level = pool_key
        while True:
            with self._lock:
                if len(self._pools.setdefault(pool_key, deque())) >= self.pool_size:
                    return
            entry = build_entry(archetype, schema_type, level, self.seed_source())  # outside the lock
            with self._lock:
                self._pools[pool_key].append(entry)

    def _refill_job(self, pool_key: tuple[str, str, float]) -> tuple | None:
        """Called with self._lock held: the refill to submit (after releasing it) when the pool is
        half empty and none is in flight."""
        have = len(self._pools.get(pool_key, ()))
        if self._workers is None or self._closed or pool_key in self._refilling or have * 2 > self.pool_size:
            return None
        self._refilling.add(pool_key)
        return pool_key, [self.seed_source() for _ in range(self.pool_size - have)]

    def _submit(self, job: tuple | None) -> None:
        """Outside self._lock: the first submit spawns the worker process, which takes a while."""
        if job is None:
            return
        pool_key, seeds = job
        with self._lock:
            workers = self._workers
        if workers is None:  # gone inline meanwhile
            with self._lock:
                self._refilling.discard(pool_key)
            return
        try:
            future = workers.submit(build_entries, *pool_key, seeds)
        except BrokenProcessPool:  # the worker died: the next refill uses a new one
            with self._lock:
                self._refilling.discard(pool_key)
                if not self._closed and self._workers is workers:
                    self._workers = worker_pool()
            return
        except Exception as e:  # shut down, or a new worker cannot be spawned: serve inline
            with self._lock:
                self._refilling.discard(pool_key)
                closed = self._closed
            if not closed:
                self._no_workers(e)
            return
        future.add_done_callback(lambda f: self._refilled(pool_key, f))

    def _refilled(self, pool_key: tuple[str, str, float], future: Future) -> None:
        with self._lock:
            self._refilling.discard(pool_key)
            if not future.cancelled() and future.exception() is None:
                pool = self._pools.setdefault(pool_key, deque())
                pool.extend(future.result()[: max(0, self.pool_size - len(pool))])
        # A failed refill leaves the pool short; the next pop queues another, and an empty pool
        # builds inline, so a generator bug surfaces there as a 503 instead of passing silently.

    def warm(
        self,
        archetypes: tuple[str, ...] = (NEUTRAL,),
        schema_types: tuple[str, ...] = SCHEMA_TYPES,
        at: float | None = None,
    ) -> int:
        """Fill the pools now, in the caller's thread: every level, or only the one theta `at` falls
        on. Returns how many payloads the pools hold."""
        for archetype in archetypes:
            for schema_type in schema_types:
                for level in levels(schema_type) if at is None else [theta_level(schema_type, at)]:
                    self._fill((archetype, schema_type, level))
        with self._lock:
            return sum(len(p) for p in self._pools.values())

    # --- user state ------------------------------------------------------------------------------

    def _path(self, key: str, directory: Path | None = None) -> Path:
        if not KEY_RE.fullmatch(key):
            raise ValueError("user key must be telemetry_store.user_key() output")
        return (directory or self.registry_dir()) / f"{key}.json"

    @contextmanager
    def _held(self, key: str) -> Iterator[None]:
        """The user's lock, pinned so eviction leaves the user alone while a call is in flight."""
        with self._lock:
            self._pins[key] = self._pins.get(key, 0) + 1
            lock = self._user_locks.setdefault(key, threading.Lock())
        try:
            with lock:
                yield
        finally:
            with self._lock:
                self._pins[key] -= 1
                if not self._pins[key]:
                    del self._pins[key]
                    del self._user_locks[key]

    def _evict(self) -> None:
        """Called with self._lock held: drop least recently used users over max_users. Only clean
        (written) users with no call in flight go; the file still holds them."""
        excess = len(self._users) - self.max_users
        if excess <= 0:
            return
        for key in list(self._users):
            if excess <= 0:
                break
            if key in self._dirty or key in self._pins:
                continue
            del self._users[key]
            excess -= 1

    def _read(self, path: Path) -> UserState | None:
        # No _io_lock: the caller holds the user, which already serialises it with forget(), and a
        # user is only read when not in memory, which a user still being written always is (it
        # stays dirty, so unevictable, until its write lands). Waiting for the writer thread here
        # put its disk time (antivirus scans of the new file included) on the request path.
        try:
            return UserState.from_json(json.loads(path.read_text(encoding="utf-8")))
        except FileNotFoundError:
            return None
        except (ValueError, TypeError, AttributeError):
            return UserState()  # an unreadable registry only forgets what was served

    def _state(self, key: str, now: float) -> UserState:
        """Called with the user held."""
        with self._lock:
            st = self._users.get(key)
            if st is not None:
                self._users.move_to_end(key)
        if st is None:
            st = self._read(self._path(key)) or UserState()
        if st.last and now - st.last > self.retention_days * DAY_S:
            st = UserState()  # idle past retention: start afresh (the next write replaces the file)
        with self._lock:
            self._users[key] = st
            self._users.move_to_end(key)
            self._evict()
            return st

    def _mark_dirty(self, key: str) -> None:
        with self._lock:
            self._dirty[key] = self._dirty.get(key, 0) + 1  # a new generation to write
            if self._writer is None or self._flush_queued or self._closed:
                return
            self._flush_queued = True
        self._writer.submit(self.flush)

    def flush(self) -> int:
        """Write every changed user's registry file. Returns how many were written.

        A user stays dirty (so never evicted) until the generation written is its latest: a write
        that fails, or a change made while it ran, keeps it for the next flush.

        Each user is serialised under its own lock, the one next_task mutates it under, so a
        serve running meanwhile cannot change its dicts mid-dump; the disk write happens after."""
        with self._lock:
            self._flush_queued = False
            for k in [k for k in self._dirty if k not in self._users]:
                del self._dirty[k]  # nothing in memory to write
            keys = list(self._dirty)
        written = 0
        for key in keys:
            with self._held(key):
                with self._lock:
                    st, gen = self._users.get(key), self._dirty.get(key)
                if st is None or gen is None:
                    continue  # forgotten, or written by another flush, meanwhile
                text = json.dumps(st.to_json())
            path = self._path(key)
            with self._io_lock:
                with self._lock:
                    if self._users.get(key) is not st:
                        continue  # forgotten (or reloaded) meanwhile: writing would undo a delete
                try:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    tmp = path.with_suffix(".json.tmp")
                    tmp.write_text(text, encoding="utf-8")
                    os.replace(tmp, path)
                except OSError as e:
                    # Memory still holds the state, so serving goes on; the next change retries.
                    # Loud, because a registry that never lands forgets the seen filter on restart.
                    log.warning("task registry write failed for one user (%s)", type(e).__name__)
                    continue
                with self._lock:
                    if self._dirty.get(key) == gen:
                        del self._dirty[key]
                written += 1
        with self._lock:
            self._evict()  # users that were only kept because they were dirty
        return written

    def forget(self, key: str, directory: Path | None = None) -> int:
        """Drop the user's registry (privacy delete). Returns files removed.

        With `directory`, only that directory's file is touched (a tool or test working on its own
        copy); without, memory and the dispatcher's own registry.
        """
        path = self._path(key, directory)
        if directory is not None:
            try:
                path.unlink()
                return 1
            except FileNotFoundError:
                return 0
        with self._held(key):
            with self._lock:
                st = self._users.pop(key, None)
                self._dirty.pop(key, None)
                if st is not None:
                    for rec in st.sessions.values():
                        self._replays.pop(rec["task_id"], None)
            if isinstance(self.trials, TelemetryTrials):
                self.trials.forget(key)
            with self._io_lock:
                path.with_suffix(".json.tmp").unlink(missing_ok=True)  # a write cut short
                try:
                    path.unlink()
                except FileNotFoundError:
                    return 0
        return 1

    def export(self, key: str, directory: Path | None = None) -> dict | None:
        """The user's registry as stored, or None when nothing is kept for them. A file that is not
        valid JSON is exported as its raw text, so the rest of the export still goes out."""
        path = self._path(key, directory)
        if directory is None:
            with self._held(key):
                with self._lock:
                    st = self._users.get(key)
                if st is not None:
                    return st.to_json()
        with self._io_lock:
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except FileNotFoundError:
                return None
        try:
            return json.loads(text)
        except ValueError:
            return {"unreadable": text}

    # --- difficulty --------------------------------------------------------------------------------

    def _theta(self, key: str, st: UserState, schema_type: str) -> tuple[float, str | None]:
        """The staircase's next theta for this schema, and the last trial it has stepped on."""
        rec = st.schemas.get(schema_type)
        if rec is not None:
            theta, marker = rec["theta"], rec.get("marker")
        else:
            projected = project(self.pillars(key), schema_type)
            theta, marker = (START_THETA[schema_type] if projected is None else projected), None
        new = trials_since(self.trials(key, schema_type), marker)
        if self.difficulty_rule and len(new) >= MIN_TRIALS:
            window = new[-ACCURACY_WINDOW:]
            accuracy = sum(t.correct for t in window) / len(window)
            theta, marker = rule_step(self.difficulty_rule, theta, accuracy), new[-1].marker
        return clamp(schema_type, theta), marker

    # --- serving ---------------------------------------------------------------------------------

    def _replay(self, rec: dict) -> bytes | None:
        with self._lock:
            body = self._replays.get(rec["task_id"])
            if body is not None:
                self._replays.move_to_end(rec["task_id"])
                return body
        try:
            entry = build_entry(rec.get("archetype", NEUTRAL), rec["schema"], rec["theta"], rec["seed"])
        except (KeyError, TypeError, ValueError, RuntimeError):
            return None
        # Byte-identical rebuilds are promised on one CPython minor only (BE-03): a mismatch means
        # the runtime changed under us, and the session gets a new task instead of a different one.
        return entry.body if entry.task_id == rec["task_id"] else None

    def _remember(self, task_id: str, body: bytes) -> None:
        with self._lock:
            self._replays[task_id] = body
            while len(self._replays) > REPLAY_CACHE:
                self._replays.popitem(last=False)

    def next_task(
        self,
        key: str,
        *,
        schema_type: str | None = None,
        dimension: str | None = None,
        session_id: str | None = None,
        seq: int = 0,
    ) -> Served:
        """The next task for user `key` (telemetry_store.user_key() output).

        Raises ValueError when the filters match no schema, NoFreshTask when nothing unseen is left.
        """
        candidates = schemas_for(schema_type, dimension)
        if not candidates:
            raise ValueError("schema_type and dimension match no schema")
        self._path(key)  # checks the key before anything is kept for it
        with self._held(key):
            now = self.clock()
            st = self._state(key, now)
            ikey = f"{session_id}|{seq}|{schema_type or ''}|{dimension or ''}" if session_id else None
            if ikey and ikey in st.sessions:
                rec = st.sessions[ikey]
                body = self._replay(rec)
                if body is not None:
                    return Served(body, rec["task_id"], rec["schema"], rec["theta"], True)

            # The schema served longest ago (never served first), ties in SCHEMA_TYPES order.
            chosen = min(candidates, key=lambda s: (st.schemas.get(s, {}).get("served_at", -1.0), SCHEMA_TYPES.index(s)))
            theta, marker = self._theta(key, st, chosen)
            level = theta_level(chosen, theta)
            archetype = self.archetype(key)
            pool_key = (archetype, chosen, level)

            entry = None
            with self._lock:
                pool = self._pools.setdefault(pool_key, deque())
                skipped = []
                while pool:
                    e = pool.popleft()
                    if st.seen.seen(e.task_id, now):
                        skipped.append(e)  # someone else may still use it
                    else:
                        entry = e
                        break
                pool.extendleft(reversed(skipped))
                job = self._refill_job(pool_key)
            self._submit(job)
            tries = 0
            while entry is None:
                if tries == FRESH_TRIES:
                    raise NoFreshTask(f"no unseen {chosen} task after {FRESH_TRIES} tries")
                tries += 1
                e = build_entry(archetype, chosen, level, self.seed_source())
                if not st.seen.seen(e.task_id, now):
                    entry = e

            st.seen.add(entry.task_id, now)
            st.schemas[chosen] = {"theta": theta, "marker": marker, "served_at": now}
            st.last = now
            if ikey:
                st.sessions[ikey] = {
                    "schema": chosen,
                    "theta": level,
                    "seed": entry.seed,
                    "archetype": archetype,
                    "task_id": entry.task_id,
                    "at": now,
                }
                self._remember(entry.task_id, entry.body)
            st.prune(now)
            self._mark_dirty(key)
            return Served(entry.body, entry.task_id, chosen, level, False)

    def close(self) -> None:
        """Stop the worker process and the writer, and write what is pending. Idempotent."""
        with self._lock:
            self._closed = True
        for ex in (self._workers, self._writer):
            if ex is not None:
                ex.shutdown(wait=True, cancel_futures=True)
        self.flush()
