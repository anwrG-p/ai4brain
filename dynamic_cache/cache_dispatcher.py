"""Task dispatcher behind GET /v1/tasks/next (BE-04).

- Pools: per (archetype, schema_type, theta level), in memory, holding pre-built payloads already
  serialised to JSON. A pop that leaves a pool half empty queues a refill in a worker process, so
  the BE-03 generators (sync, CPU-bound) never run on the event loop, rarely on a request, and
  never hold the GIL against request threads.
  An empty pool falls back to building one task inline, in the request's worker thread.
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
  the user's pillar scores (START_THETA when there are none), and each new task moves it by the
  85% rule over the user's recent accuracy on that schema, read from telemetry. It only moves when
  new trials of that schema arrived since the last move, so tasks fetched and never played do not
  push it around.
- Registry: the Bloom slices, session answers and staircases are one JSON file per user under
  data/processed/task_registry/, written behind the request by a background thread. forget() and
  export() back the privacy delete and export.

Thread safety: a per-user lock serialises one user's calls (so a double GET in the same session
cannot hand out two tasks); one dispatcher lock guards the pools and the user table.
"""

from __future__ import annotations

import json
import logging
import multiprocessing
import os
import random
import re
import threading
import time
from collections import OrderedDict, deque
from collections.abc import Callable, Mapping
from concurrent.futures import Future, ProcessPoolExecutor, ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, NamedTuple

from .bloom import TTL_DAYS, DAY_S, TimedBloom
from .generators import DIMENSION_OF, SCHEMA_TYPES, generate
from .parameter_projector import BOUNDS, START_THETA, clamp, project

log = logging.getLogger(__name__)

NEUTRAL = "neutral"
# Generator options per archetype. Stroop is pinned to the classic inks: cvd_safe needs `black`,
# which Stroop.tsx does not paint yet (BE-03), so it is never served.
ARCHETYPE_OPTIONS: dict[str, dict[str, dict[str, Any]]] = {NEUTRAL: {"stroop": {"inks": "classic"}}}

LEVEL_STEP = 0.1  # pools are keyed by theta snapped to this grid
POOL_SIZE = 16  # payloads kept per pool: a burst of ~8 calls per pool between refills stays warm
SESSIONS_KEPT = 64  # idempotency answers kept per user (and none older than the TTL)
REPLAY_CACHE = 256  # serialised payloads kept for session replays
FRESH_TRIES = 8  # inline builds tried when every pooled task was already seen

# The 85% rule (backend/app/tools/exercise_generator.py) works on an IRT difficulty b in [-2.5, 2.5];
# theta in [0, 1] maps onto it linearly. (A) step 1.0: at 95% accuracy theta rises by 0.04, at 70%
# it falls by 0.06; Hamza's default 0.25 moves theta by at most 0.015 per task.
RULE_STEP = 1.0
MIN_TRIALS = 10  # fewer recent trials of a schema than this: no accuracy, no step
ACCURACY_WINDOW = 60  # the most recent trials of the schema that count
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


class Accuracy(NamedTuple):
    accuracy: float
    trials: int
    marker: str  # identifies the newest trial counted


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


def build_entry(archetype: str, schema_type: str, level: float, seed: int) -> Entry:
    """One payload, built and serialised. Module level, so the worker process can run it."""
    options = ARCHETYPE_OPTIONS.get(archetype, ARCHETYPE_OPTIONS[NEUTRAL]).get(schema_type, {})
    # validate=True (the default): the served schema and the solvers check every payload, and
    # allow_unserved stays False, so no unserved content (black ink) can get through.
    payload = generate(schema_type, level, seed, **options)
    body = json.dumps(payload, separators=(",", ":"), allow_nan=False).encode("utf-8")
    return Entry(payload["task_id"], body, seed)


def _worker_pool() -> ProcessPoolExecutor:
    # spawn everywhere: fork from a threaded server (uvicorn's pool) can deadlock the child, and
    # Python 3.12+ warns about it on Linux.
    return ProcessPoolExecutor(max_workers=1, mp_context=multiprocessing.get_context("spawn"))


def build_entries(archetype: str, schema_type: str, level: float, seeds: list[int]) -> list[Entry]:
    return [build_entry(archetype, schema_type, level, seed) for seed in seeds]


# --- telemetry: recent accuracy per schema --------------------------------------------------------


def schema_of(task_id: str) -> str | None:
    """Generated task ids start with their schema (`{schema}-{seed}-...`); fixture ids do not."""
    head = task_id.split("-", 1)[0]
    return head if head in DIMENSION_OF else None


def accuracy_by_schema(lines: list[str]) -> dict[str, Accuracy]:
    """Recent accuracy (1 - error rate) per schema from JSONL lines, oldest line first.

    Duplicates (a batch resent after a timeout) count once: the key is the trial's item id and
    stream when it has one (as BE-07 dedupes), else (session, task, trial_index).
    """
    seen: set[tuple] = set()
    trials: dict[str, list[tuple[bool, str]]] = {}
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
        trials.setdefault(schema, []).append((e["error_flag"], marker))
    out = {}
    for schema, rows in trials.items():
        recent = rows[-ACCURACY_WINDOW:]
        if len(recent) >= MIN_TRIALS:
            correct = sum(1 for err, _ in recent if not err)
            out[schema] = Accuracy(correct / len(recent), len(recent), recent[-1][1])
    return out


class TelemetryAccuracy:
    """Reads the tail of `{dir}/{key}.jsonl`; cached until the file's size or mtime changes."""

    def __init__(self, directory: Callable[[], Path]) -> None:
        self.directory = directory
        self._cache: dict[str, tuple[tuple[int, int], dict[str, Accuracy]]] = {}
        self._lock = threading.Lock()

    def __call__(self, key: str, schema_type: str) -> Accuracy | None:
        path = self.directory() / f"{key}.jsonl"
        try:
            st = path.stat()
        except OSError:
            return None
        stamp = (st.st_size, st.st_mtime_ns)
        with self._lock:
            hit = self._cache.get(key)
        if hit is None or hit[0] != stamp:
            try:
                with open(path, "rb") as f:
                    f.seek(max(0, st.st_size - TELEMETRY_TAIL_BYTES))
                    raw = f.read(TELEMETRY_TAIL_BYTES)
            except OSError:
                return None
            lines = raw.decode("utf-8", errors="replace").splitlines()
            if st.st_size > TELEMETRY_TAIL_BYTES:
                lines = lines[1:]  # the first line was cut by the seek
            hit = (stamp, accuracy_by_schema(lines))
            with self._lock:
                self._cache[key] = hit
        return hit[1].get(schema_type)

    def forget(self, key: str) -> None:
        with self._lock:
            self._cache.pop(key, None)


# --- per-user registry ---------------------------------------------------------------------------


@dataclass
class UserState:
    seen: TimedBloom = field(default_factory=TimedBloom)
    # idempotency key -> {"schema", "theta", "seed", "task_id", "at"}: enough to rebuild the payload
    sessions: dict[str, dict] = field(default_factory=dict)
    # schema -> {"theta": staircase value, "marker": newest trial already stepped on, "served_at"}
    schemas: dict[str, dict] = field(default_factory=dict)

    def to_json(self) -> dict:
        return {"v": 1, "seen": self.seen.to_json(), "sessions": self.sessions, "schemas": self.schemas}

    @classmethod
    def from_json(cls, doc: Mapping) -> "UserState":
        return cls(TimedBloom.from_json(doc.get("seen")), dict(doc.get("sessions") or {}), dict(doc.get("schemas") or {}))

    def prune(self, now: float) -> None:
        self.seen.expire(now)
        oldest = now - TTL_DAYS * DAY_S
        live = sorted((r["at"], k) for k, r in self.sessions.items() if r.get("at", 0) >= oldest)
        self.sessions = {k: self.sessions[k] for _, k in live[-SESSIONS_KEPT:]}


def default_registry_dir() -> Path:
    env = os.environ.get("TASK_REGISTRY_DIR")
    # dynamic_cache/ -> repo root, whose data/processed/* is gitignored.
    return Path(env) if env else Path(__file__).resolve().parents[1] / "data" / "processed" / "task_registry"


class Dispatcher:
    def __init__(
        self,
        *,
        registry_dir: Callable[[], Path] = default_registry_dir,
        accuracy: Callable[[str, str], Accuracy | None] = lambda key, schema: None,
        pillars: Callable[[str], Mapping[str, float | None] | None] = lambda key: None,
        archetype: Callable[[str], str] = lambda key: NEUTRAL,
        difficulty_rule: Callable[..., float] | None = None,
        clock: Callable[[], float] = time.time,
        seed_source: Callable[[], int] = lambda: random.SystemRandom().randrange(2**32),
        pool_size: int = POOL_SIZE,
        background: bool = True,
    ) -> None:
        self.registry_dir = registry_dir
        self.accuracy = accuracy
        self.pillars = pillars
        self.archetype = archetype
        self.difficulty_rule = difficulty_rule
        self.clock = clock
        self.seed_source = seed_source
        self.pool_size = pool_size

        # Pools, the user table, user locks, the dirty set. Re-entrant: a refill future that is
        # already done runs its callback (which takes the lock) inside _queue_refill.
        self._lock = threading.RLock()
        self._io_lock = threading.Lock()  # registry files
        self._pools: dict[tuple[str, str, float], deque[Entry]] = {}
        self._refilling: set[tuple[str, str, float]] = set()
        self._users: dict[str, UserState] = {}
        self._user_locks: dict[str, threading.Lock] = {}
        self._dirty: set[str] = set()
        self._flush_queued = False
        self._replays: OrderedDict[str, bytes] = OrderedDict()
        # Refills run in a worker process: building is CPU-bound Python, and in a thread it would
        # hold the GIL against the request threads (measured: 20-40 ms requests under uvicorn).
        self._workers = _worker_pool() if background else None
        self._writer = ThreadPoolExecutor(max_workers=1, thread_name_prefix="task-registry") if background else None

    # --- building payloads -----------------------------------------------------------------------

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

    def _queue_refill(self, pool_key: tuple[str, str, float]) -> None:
        """Called with self._lock held: below half full, top the pool up in the worker process."""
        have = len(self._pools.get(pool_key, ()))
        if self._workers is None or pool_key in self._refilling or have * 2 > self.pool_size:
            return
        seeds = [self.seed_source() for _ in range(self.pool_size - have)]
        try:
            future = self._workers.submit(build_entries, *pool_key, seeds)
        except RuntimeError:  # BrokenProcessPool (the worker died) or shut down: start a new one
            self._workers = _worker_pool()
            return
        self._refilling.add(pool_key)
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

    def _path(self, key: str) -> Path:
        if not KEY_RE.fullmatch(key):
            raise ValueError("user key must be telemetry_store.user_key() output")
        return self.registry_dir() / f"{key}.json"

    def _user_lock(self, key: str) -> threading.Lock:
        with self._lock:
            return self._user_locks.setdefault(key, threading.Lock())

    def _state(self, key: str) -> UserState:
        """Called with the user's lock held."""
        with self._lock:
            st = self._users.get(key)
        if st is not None:
            return st
        path = self._path(key)
        st = UserState()
        with self._io_lock:
            if path.is_file():
                try:
                    st = UserState.from_json(json.loads(path.read_text(encoding="utf-8")))
                except (ValueError, TypeError, AttributeError):
                    st = UserState()  # an unreadable registry only forgets what was served
        with self._lock:
            return self._users.setdefault(key, st)

    def _mark_dirty(self, key: str) -> None:
        with self._lock:
            self._dirty.add(key)
            if self._writer is None or self._flush_queued:
                return
            self._flush_queued = True
        self._writer.submit(self.flush)

    def flush(self) -> int:
        """Write every changed user's registry file. Returns how many were written."""
        with self._lock:
            self._flush_queued = False
            todo = [(k, self._users[k], json.dumps(self._users[k].to_json())) for k in self._dirty if k in self._users]
            self._dirty.clear()
        written = 0
        for key, st, text in todo:
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
                    log.warning("task registry write failed for one user: %s", e)
                    with self._lock:
                        self._dirty.add(key)
                    continue
                written += 1
        return written

    def forget(self, key: str) -> int:
        """Drop the user's registry from memory and disk (privacy delete). Returns files removed."""
        path = self._path(key)
        with self._user_lock(key):
            with self._lock:
                st = self._users.pop(key, None)
                self._dirty.discard(key)
                if st is not None:
                    for rec in st.sessions.values():
                        self._replays.pop(rec["task_id"], None)
            if isinstance(self.accuracy, TelemetryAccuracy):
                self.accuracy.forget(key)
            with self._io_lock:
                path.with_suffix(".json.tmp").unlink(missing_ok=True)  # a write cut short
                try:
                    path.unlink()
                except FileNotFoundError:
                    return 0
        return 1

    def export(self, key: str) -> dict | None:
        """The user's registry as stored, or None when nothing is kept for them."""
        with self._user_lock(key):
            with self._lock:
                st = self._users.get(key)
            if st is not None:
                return st.to_json()
            path = self._path(key)
            with self._io_lock:
                try:
                    return json.loads(path.read_text(encoding="utf-8"))
                except FileNotFoundError:
                    return None

    # --- difficulty --------------------------------------------------------------------------------

    def _theta(self, key: str, st: UserState, schema_type: str) -> tuple[float, str | None]:
        """The staircase's next theta for this schema, and the trial marker it stepped on."""
        rec = st.schemas.get(schema_type)
        if rec is not None:
            theta, marker = rec["theta"], rec.get("marker")
        else:
            projected = project(self.pillars(key), schema_type)
            theta, marker = (START_THETA[schema_type] if projected is None else projected), None
        acc = self.accuracy(key, schema_type)
        if acc is not None and acc.trials >= MIN_TRIALS and acc.marker != marker and self.difficulty_rule:
            theta, marker = rule_step(self.difficulty_rule, theta, acc.accuracy), acc.marker
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
        with self._user_lock(key):
            st = self._state(key)
            now = self.clock()
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
                self._queue_refill(pool_key)
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
        """Stop the background threads and write what is pending."""
        for ex in (self._workers, self._writer):
            if ex is not None:
                ex.shutdown(wait=True)
        self.flush()
