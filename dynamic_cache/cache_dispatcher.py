"""Task dispatcher behind GET /v1/tasks/next (BE-04).

- Pools: per (archetype, schema_type, theta level, Stroop inks), in memory, holding pre-built payloads already
  serialised to JSON, refilled by WORKERS worker processes, so the BE-03 generators (sync,
  CPU-bound) never run on the event loop, rarely on a request, and never hold the GIL against
  request threads. An empty pool builds one task inline, in the request's worker thread. The
  workers exit with their parent, even on a hard kill.
  - Each pool is sized to its demand: a decaying per-pool pop rate sets its target to cover
    POOL_HORIZON_S of demand, up to POOL_MAX. Its floor is POOL_SIZE while the pool is in use
    (popped or warmed within POOL_IDLE_S) and 0 once idle; stock above the target is trimmed, so a
    wave's growth is handed back and idle pools empty out.
  - Memory: all pools together never hold more than POOL_BYTES_MAX (a hard cap, every archetype
    included). It is split in two: the floors get POOL_BYTES_MAX - POOL_GROWTH_BYTES, and when
    the pools in use would need more, the least recently used ones give their floor up (popped
    again, a pool gets it back); POOL_GROWTH_BYTES stays for stock above the floors, so a hot pool
    can always grow, however many pools are in use.
  - Low-water refill: a pool at or under half its target is topped back up to it, in small jobs
    (about BATCH_S of build time each), so results come back and priorities are re-weighed often.
  - Priority: the free worker takes the latest pool: the one whose stock runs out soonest
    compared with the time it takes to rebuild its whole deficit (lateness = stock / pop rate -
    deficit x build time), so a hot pool of a slow schema (MST, mental rotation) is not stuck
    behind cheap refills. Build times are learned per schema.
  - Failures: a refill that raises puts its pool on an exponential back-off (BACKOFF_FIRST_S
    doubling to BACKOFF_MAX_S); a worker pool that breaks (a dead or hung worker, a job past
    JOB_TIMEOUT_S, a spawn that fails) is replaced after the same kind of back-off, the server
    building inline meanwhile. A new worker pool gets SPAWN_TIMEOUT_S to answer its first job
    before it counts as hung, so spawn time is not held against JOB_TIMEOUT_S. Warnings are
    rate-limited. Callbacks from the process pool, and the kill of a hung pool, only hand over to
    the pumper thread: the pool's manager thread runs callbacks holding its own locks.
- Archetype: the state bus (BE-11) names the user's pool. Every cluster maps to NEUTRAL until
  per-style generator options exist (see state_bus.pool_name).
- Stroop inks: the caller picks the preset ("classic" or "cvd_safe", the colour-blind-safe set the
  frontend's setting asks for). It is part of the pool key and of the session's idempotency key,
  so a classic pool never hands out a cvd_safe block or the other way round. The other schemas
  have no inks: their key holds "" and their pools are shared by both kinds of user.
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
- LLM variants (BE-13, llm_worker.py): offer() puts already-validated entries with a non-procedural
  `source` into pools in use, at the front (served first, never trimmed first), within the pool's
  demand target and the byte caps, replacing procedural stock when the pool is full. Their
  session recipe records that source, and a replay looks the body up through `variants` (they
  cannot be rebuilt from a seed).

Thread safety: a per-user lock serialises one user's calls (so a double GET in the same session
cannot hand out two tasks); one dispatcher lock guards the pools and the user table.
"""

from __future__ import annotations

import json
import logging
import math
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
# Stroop ink presets a caller may ask for (generators/stroop.py INK_PRESETS, both served).
INKS: tuple[str, ...] = ("classic", "cvd_safe")
DEFAULT_INKS = "classic"
# (archetype, schema_type, theta level, inks); inks is "" for every schema but Stroop.
PoolKey = tuple[str, str, float, str]
# Generator options per archetype, as the LLM worker's reference payloads use them (the default-inks
# pools). Only NEUTRAL: per-style options don't exist yet (see brain_twin_jepa.state_bus.pool_name).
ARCHETYPE_OPTIONS: dict[str, dict[str, dict[str, Any]]] = {NEUTRAL: {"stroop": {"inks": DEFAULT_INKS}}}


def pool_inks(schema_type: str, inks: str) -> str:
    """The inks part of a pool key: the preset for Stroop, "" for the schemas that have none."""
    if inks not in INKS:
        raise ValueError(f"inks must be one of {INKS}, got {inks!r}")
    return inks if schema_type == "stroop" else ""

LEVEL_STEP = 0.1  # pools are keyed by theta snapped to this grid
POOL_SIZE = 16  # the floor of a pool in use
POOL_MAX = 128  # the largest target one hot pool grows to
POOL_IDLE_S = 600.0  # a pool not popped (or warmed) for this long has floor 0: it is trimmed empty
POOL_HORIZON_S = 2.0  # a pool's target covers this many seconds of its recent pop rate
DEMAND_TAU_S = 2.0  # time constant of the per-pool pop-rate estimate
POOL_BYTES_MAX = 96 << 20  # hard cap on all pooled payloads, every archetype together
POOL_GROWTH_BYTES = 32 << 20  # of which, at most this much above the pools' floors
# Refill processes: two, but never more than the cores left beside the server (one on 2 vCPUs).
WORKERS = max(1, min(2, (os.cpu_count() or 2) - 1))
BATCH_S = 0.03  # build time per refill job: short, so priorities are re-weighed often
JOB_TIMEOUT_S = 10.0  # a refill job this late means a hung worker: the pool is replaced
SPAWN_TIMEOUT_S = 60.0  # the same, for a worker pool that has not answered once yet (spawning)
BACKOFF_FIRST_S = 0.5  # first back-off after a failed refill or a broken worker pool
BACKOFF_MAX_S = 30.0  # back-offs double up to this
LOG_EVERY_S = 30.0  # one warning of a kind per this many seconds, with a count of the rest
SWEEP_EVERY_S = 0.25  # trimming, the growth tally and the hung-job check run this often
# Seconds to build and validate one payload (CPython 3.13, dev laptop); learned at run time.
BUILD_COST_S: dict[str, float] = {
    "mst": 0.007,
    "mental_rotation": 0.006,
    "relational": 0.003,
    "ufov": 0.002,
    "n_back": 0.0012,
    "stroop": 0.0007,
    "matrix": 0.0003,
    "tower": 0.0003,
    "stop_signal": 0.0003,
    "pal": 0.0001,
    "flanker": 0.0002,
}
ENTRY_BYTES_GUESS = 16_000  # payload size before any is seen for a schema (MST ~18 KB, tower ~0.3 KB)
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
    seed: int  # meaningless unless source == PROCEDURAL
    source: str = "procedural"  # or "llm" (BE-13): not rebuildable from the seed


PROCEDURAL = "procedural"


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


def build_entry(archetype: str, schema_type: str, level: float, inks: str, seed: int) -> Entry:
    """One payload, built and serialised. Module level, so the worker process can run it.
    `inks` is the pool key's: a Stroop preset, or "" for the other schemas. The archetype does not
    change the payload yet (no per-archetype options until BE-11)."""
    options = {"inks": inks} if inks else {}
    # validate=True (the default): the served schema and the solvers check every payload.
    payload = generate(schema_type, level, seed, **options)
    body = json.dumps(payload, separators=(",", ":"), allow_nan=False).encode("utf-8")
    return Entry(payload["task_id"], body, seed)


def build_entries(archetype: str, schema_type: str, level: float, inks: str, seeds: list[int]) -> tuple[list[Entry], float]:
    """The payloads for `seeds`, and the seconds it took (the dispatcher learns build costs)."""
    t = time.perf_counter()
    entries = [build_entry(archetype, schema_type, level, inks, seed) for seed in seeds]
    return entries, time.perf_counter() - t


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


def worker_pool(workers: int = WORKERS) -> ProcessPoolExecutor:
    # spawn everywhere: fork from a threaded server (uvicorn's pool) can deadlock the child, and
    # Python 3.12+ warns about it on Linux.
    return ProcessPoolExecutor(
        max_workers=workers, mp_context=multiprocessing.get_context("spawn"), initializer=_exit_with_parent
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
        variants: Callable[[str], bytes | None] = lambda task_id: None,
        on_step: Callable[[str, str, float, float], None] | None = None,
        difficulty_rule: Callable[..., float] | None = None,
        clock: Callable[[], float] = time.time,
        seed_source: Callable[[], int] = lambda: random.SystemRandom().randrange(2**32),
        pool_size: int = POOL_SIZE,
        max_users: int = MAX_USERS,
        retention_days: int = RETENTION_DAYS,
        pool_max: int = POOL_MAX,
        pool_bytes_max: int = POOL_BYTES_MAX,
        workers: int = WORKERS,
        background: bool = True,
    ) -> None:
        self.registry_dir = registry_dir
        self.trials = trials
        self.pillars = pillars
        self.archetype = archetype
        self.variants = variants  # task_id -> body of a non-procedural entry (session replays)
        self.on_step = on_step  # (key, schema_type, old level, new level) when a staircase moves the served level
        self.difficulty_rule = difficulty_rule
        self.clock = clock
        self.seed_source = seed_source
        self.pool_size = pool_size
        self.max_users = max_users
        self.retention_days = retention_days  # the server passes RETENTION_DAYS from the env
        self.pool_max = max(pool_size, pool_max)
        self.pool_bytes_max = pool_bytes_max
        self.workers = workers

        # Pools, the user table, pins, the dirty set. Re-entrant: a refill future that is already
        # done runs its callback (which takes the lock) in the submitting thread.
        self._lock = threading.RLock()
        self._io_lock = threading.Lock()  # registry files
        self._pools: dict[PoolKey, deque[Entry]] = {}
        self._key_bytes: dict[PoolKey, int] = {}  # payload bytes per pool
        self._active_at: dict[PoolKey, float] = {}  # last pop or warm, per pool
        self._topping: set[PoolKey] = set()  # pools being topped up to their target
        self._inflight: dict[PoolKey, int] = {}  # payloads being built, per pool
        self._running: dict[Future, tuple] = {}  # job -> (executor, pool, n, started, bytes guess)
        self._demand: dict[PoolKey, tuple[float, float]] = {}  # pool -> (pops/s, at)
        self._cost: dict[str, float] = dict(BUILD_COST_S)  # seconds per payload, learned
        self._entry_bytes: dict[str, float] = {}  # payload size per schema, learned
        self._pool_bytes = 0
        self._inflight_bytes = 0  # guessed size of what the running jobs will bring
        self._growth_bytes = 0  # bytes above the pools' floors (tallied by the sweep)
        self._floor_bytes = 0  # bytes within the pools' floors (tallied by the sweep)
        self._no_floor: set[PoolKey] = set()  # in use, but floor given up (LRU)
        self._workers_ready = False  # the current worker pool has answered a job
        self._busy = 0  # refill jobs in flight
        self._refills_done = 0  # jobs whose payloads came back from a worker
        self._key_retry: dict[PoolKey, tuple[float, int]] = {}  # pool -> (retry at, failures)
        self._respawn_at = 0.0  # no new worker pool before this (monotonic)
        self._pool_failures = 0  # consecutive broken worker pools
        self._swept_at = 0.0
        self._warned: dict[object, tuple[float, int]] = {}  # warning kind -> (logged at, suppressed)
        self._mono = time.monotonic  # tests replace it to move pool time
        self.pool_growth_bytes = POOL_GROWTH_BYTES
        self.pool_idle_s = POOL_IDLE_S
        self.job_timeout_s = JOB_TIMEOUT_S
        self._background = background
        self._users: OrderedDict[str, UserState] = OrderedDict()  # least recently used first
        self._user_locks: dict[str, threading.Lock] = {}  # only for users with a call in flight
        self._pins: dict[str, int] = {}  # calls in flight per user
        self._dirty: dict[str, int] = {}  # user -> generation not yet written
        self._flush_queued = False
        self._closed = False
        self._replays: OrderedDict[str, bytes] = OrderedDict()
        # Refills run in worker processes: building is CPU-bound Python, and in a thread it would
        # hold the GIL against the request threads (measured: 20-40 ms requests under uvicorn).
        self._workers = worker_pool(workers) if background else None
        # Everything the process pool calls back is handed over to this thread.
        self._pumper = ThreadPoolExecutor(max_workers=1, thread_name_prefix="task-pool") if background else None
        self._writer = ThreadPoolExecutor(max_workers=1, thread_name_prefix="task-registry") if background else None

    # --- building payloads -----------------------------------------------------------------------

    def start(self) -> Future | None:
        """Spawn the worker processes now (server startup), so no request pays for it. Does not
        wait: the returned future resolves to the workers' pids. A spawn that fails is handled
        like any broken worker pool: logged, tasks built inline, a new pool tried after back-off."""
        with self._lock:
            workers = self._workers
        if workers is None:
            return None
        try:
            # One call per process: the pool spawns a new process while none is idle.
            futures = [workers.submit(worker_pid) for _ in range(self.workers)]
        except Exception as e:  # spawn refused outright (shut down, no processes allowed, ...)
            self._worker_failed(workers, e)
            return None
        done: Future = Future()
        left = [len(futures)]

        def one_done(f: Future) -> None:  # on the pumper thread
            error = None if f.cancelled() else f.exception()
            if error is not None:
                self._worker_failed(workers, error)
            elif not f.cancelled():
                with self._lock:
                    if workers is self._workers:
                        self._workers_ready = True
            left[0] -= 1
            if left[0] == 0 and not done.done():
                errors = [g.exception() for g in futures if not g.cancelled() and g.exception()]
                if errors:
                    done.set_exception(errors[0])
                else:
                    done.set_result([g.result() for g in futures if not g.cancelled()])

        for f in futures:
            f.add_done_callback(lambda f: self._hand_over(one_done, f))
        return done

    def _hand_over(self, fn: Callable, *args) -> None:
        """A process-pool callback: it runs on the pool's manager thread, which holds the pool's
        own locks (shutdown included), so all real work goes to the pumper thread."""
        try:
            self._pumper.submit(fn, *args)
        except RuntimeError:
            pass  # closing

    def _warn(self, kind: object, message: str, *args: object) -> None:
        """log.warning, at most once per LOG_EVERY_S per kind, with how many were held back."""
        now = self._mono()
        with self._lock:
            last, held = self._warned.get(kind, (-math.inf, 0))
            if now - last < LOG_EVERY_S:
                self._warned[kind] = (last, held + 1)
                return
            self._warned[kind] = (now, 0)
        log.warning(message + (f" ({held} more since the last warning)" if held else ""), *args)

    def _worker_failed(self, executor: object, error: BaseException) -> None:
        """A worker pool broke (spawn failed, a worker died or hung). If it is still the current
        one, drop it, build inline, and allow a new one after an exponential back-off. A stale
        report about a pool already replaced changes nothing. Never call on the manager thread."""
        with self._lock:
            if executor is not self._workers:
                return
            self._workers = None
            self._reset_jobs()
            self._pool_failures += 1
            delay = min(BACKOFF_MAX_S, BACKOFF_FIRST_S * 2 ** (self._pool_failures - 1))
            self._respawn_at = self._mono() + delay
        self._warn(
            "workers",
            "task worker process unavailable (%s); building tasks inline, new workers in %.1f s",
            type(error).__name__,
            delay,
        )
        for proc in list(getattr(executor, "_processes", None) or {}):
            try:
                executor._processes[proc].kill()  # a hung worker must go; a dead one is a no-op
            except Exception:  # noqa: BLE001 - already gone
                pass
        shutdown = getattr(executor, "shutdown", None)
        if shutdown is not None:
            shutdown(wait=False, cancel_futures=True)

    def _reset_jobs(self) -> None:
        """Called with self._lock held, when the worker pool goes away: forget its jobs."""
        self._busy = 0
        self._inflight.clear()
        self._running.clear()
        self._inflight_bytes = 0

    def _add(self, pool_key: PoolKey, entry: Entry) -> bool:
        """Called with self._lock held: stock one payload, unless that would pass POOL_BYTES_MAX."""
        size = len(entry.body)
        if self._pool_bytes + size > self.pool_bytes_max:
            return False
        self._pools.setdefault(pool_key, deque()).append(entry)
        self._key_bytes[pool_key] = self._key_bytes.get(pool_key, 0) + size
        self._pool_bytes += size
        old = self._entry_bytes.get(pool_key[1], size)
        self._entry_bytes[pool_key[1]] = 0.8 * old + 0.2 * size
        return True

    def _take(self, pool_key: PoolKey, entry: Entry) -> None:
        """Called with self._lock held: account for a payload leaving the pool."""
        self._key_bytes[pool_key] -= len(entry.body)
        self._pool_bytes -= len(entry.body)

    def _fill(self, pool_key: PoolKey) -> None:
        """Top the pool up to POOL_SIZE in the caller's thread (warm-up); it counts as in use."""
        archetype, schema_type, level, inks = pool_key
        with self._lock:
            self._active_at[pool_key] = self._mono()
            self._no_floor.discard(pool_key)
        while True:
            with self._lock:
                if len(self._pools.setdefault(pool_key, deque())) >= self.pool_size:
                    return
            entry = build_entry(archetype, schema_type, level, inks, self.seed_source())  # outside the lock
            with self._lock:
                if not self._add(pool_key, entry):
                    return  # the byte cap

    # Demand: an exponentially decaying event-rate estimate per pool. Each pop adds 1/tau; between
    # pops it decays by e^(-dt/tau), so at a steady rate it settles on that rate (pops per second).

    def _rate(self, pool_key: PoolKey, now: float) -> float:
        rate, at = self._demand.get(pool_key, (0.0, now))
        return rate * math.exp(-(now - at) / DEMAND_TAU_S)

    def _note_pop(self, pool_key: PoolKey, now: float) -> None:
        """Called with self._lock held."""
        self._demand[pool_key] = (self._rate(pool_key, now) + 1.0 / DEMAND_TAU_S, now)
        self._active_at[pool_key] = now
        self._no_floor.discard(pool_key)  # in use again: it gets its floor back

    def _floor(self, pool_key: PoolKey, now: float) -> int:
        """POOL_SIZE while the pool is in use, 0 once idle for pool_idle_s (or never used), or
        while it has given its floor up to more recently used pools."""
        if pool_key in self._no_floor:
            return 0
        return self.pool_size if now - self._active_at.get(pool_key, -math.inf) <= self.pool_idle_s else 0

    @property
    def floor_bytes_max(self) -> int:
        """The floors' share of the cap; the rest is kept for growth."""
        return self.pool_bytes_max - self.pool_growth_bytes

    def _avg_bytes(self, pool_key: PoolKey) -> float:
        pool = self._pools.get(pool_key)
        if pool:
            return self._key_bytes[pool_key] / len(pool)
        return self._entry_bytes.get(pool_key[1], ENTRY_BYTES_GUESS)

    def _want(self, pool_key: PoolKey, now: float) -> int:
        """Called with self._lock held: the demand-based target, POOL_HORIZON_S of pops within
        [floor, pool_max]. Stock above it is trimmed."""
        # Rounded, not ceiled: a rate decayed to almost nothing must not keep one payload alive.
        want = math.floor(self._rate(pool_key, now) * POOL_HORIZON_S + 0.5)
        return max(self._floor(pool_key, now), min(self.pool_max, want))

    def _target(self, pool_key: PoolKey, now: float) -> int:
        """Called with self._lock held: what refills aim for. Growth above the floor only while the
        growth budget has room."""
        floor = self._floor(pool_key, now)
        if self._growth_bytes >= self.pool_growth_bytes:
            return floor
        return self._want(pool_key, now)

    def _check_low_water(self, pool_key: PoolKey, now: float) -> None:
        """Called with self._lock held: at or under half its target, the pool is topped up
        (unless it is backing off after a failed refill)."""
        if now < self._key_retry.get(pool_key, (0.0, 0))[0]:
            return
        if len(self._pools.get(pool_key, ())) * 2 <= self._target(pool_key, now):
            self._topping.add(pool_key)

    def _sweep(self, now: float) -> object | None:
        """Called with self._lock held, at most every SWEEP_EVERY_S: trim stock above each pool's
        demand target (handing a wave's growth back, emptying idle pools), tally the bytes above
        the floors, and return the worker pool if one of its jobs is past job_timeout_s."""
        if now - self._swept_at < SWEEP_EVERY_S:
            return None
        self._swept_at = now
        # The floors of the pools in use, least recently used first: past floor_bytes_max, the
        # oldest give theirs up, so the growth share always stays free for a hot pool.
        floors = sorted(
            (at, pool_key)
            for pool_key, at in self._active_at.items()
            if pool_key not in self._no_floor and now - at <= self.pool_idle_s
        )
        need = sum(self.pool_size * self._avg_bytes(k) for _, k in floors)
        for _, pool_key in floors:
            if need <= self.floor_bytes_max:
                break
            need -= self.pool_size * self._avg_bytes(pool_key)
            self._no_floor.add(pool_key)
        growth = held_floor = 0
        for pool_key, pool in list(self._pools.items()):
            want = self._want(pool_key, now)
            while len(pool) > want:
                self._take(pool_key, pool.pop())
            if want == 0:
                self._topping.discard(pool_key)  # idle: nothing to top up
            if not pool and pool_key not in self._topping and not self._inflight.get(pool_key):
                del self._pools[pool_key]
                self._key_bytes.pop(pool_key, None)
                continue
            if not pool:
                continue  # kept for a refill in flight: holds nothing yet
            held = self._key_bytes.get(pool_key, 0)
            within = held * min(len(pool), self._floor(pool_key, now)) // len(pool)
            held_floor += within
            growth += held - within
        self._growth_bytes = growth
        self._floor_bytes = held_floor
        limit = self.job_timeout_s if self._workers_ready else max(self.job_timeout_s, SPAWN_TIMEOUT_S)
        for executor, _, _, started, _ in self._running.values():
            if now - started > limit and executor is self._workers:
                return executor
        return None

    def _jobs(self, now: float) -> list[tuple]:
        """Called with self._lock held: the refill jobs to start now, latest pool first, as long as
        a worker is free and the byte cap has room. Lateness = the time until the stock runs out
        minus the time to rebuild the pool's whole deficit, so with equal stock a slow schema goes
        first, and a slow pool with a little stock can still go before an empty cheap one."""
        if self._closed or not self._background:
            return []
        if self._workers is None:
            if now < self._respawn_at:
                return []
            self._workers = worker_pool(self.workers)  # after the back-off: try again
            self._workers_ready = False
        jobs = []
        while self._busy < self.workers:
            ranked = []
            for pool_key in list(self._topping):
                have = len(self._pools.get(pool_key, ()))
                inflight = self._inflight.get(pool_key, 0)
                deficit = self._target(pool_key, now) - have - inflight
                if deficit <= 0:
                    if not inflight:
                        self._topping.discard(pool_key)  # topped up
                    continue
                cost = self._cost.get(pool_key[1], 0.005)
                lateness = (have + inflight) / max(self._rate(pool_key, now), 1e-3) - deficit * cost
                ranked.append((lateness, pool_key, deficit, cost))
            ranked.sort(key=lambda r: r[0])
            room_bytes = self.pool_bytes_max - self._pool_bytes - self._inflight_bytes
            for _, pool_key, deficit, cost in ranked:
                size = self._entry_bytes.get(pool_key[1], ENTRY_BYTES_GUESS)
                n = min(deficit, max(1, math.ceil(BATCH_S / cost)), room_bytes // max(1, int(size)))
                if n > 0:
                    break  # the latest pool that fits under the cap (a smaller payload may)
            else:
                break  # nothing fits: nothing more is built until stock is used or trimmed
            guess = int(n * size)
            self._inflight[pool_key] = self._inflight.get(pool_key, 0) + n
            self._inflight_bytes += guess
            self._busy += 1
            jobs.append((pool_key, [self.seed_source() for _ in range(n)], guess))
        return jobs

    def _pump(self) -> None:
        """Housekeeping, then start the refill jobs that are due. Outside self._lock: the first
        submit spawns a worker process, which takes a while."""
        with self._lock:
            now = self._mono()
            hung = self._sweep(now)
        if hung is not None:
            # Killing processes and shutting a pool down is slow: never on a request thread.
            self._hand_over(self._worker_failed, hung, TimeoutError("a refill job ran over its time limit"))
            return
        with self._lock:
            jobs = self._jobs(self._mono())
            workers = self._workers
        for i, (pool_key, seeds, guess) in enumerate(jobs):
            try:
                future = workers.submit(build_entries, *pool_key, seeds)
            except Exception as e:  # a dead pool (BrokenProcessPool), or no worker can be spawned
                self._worker_failed(workers, e)  # resets every job of this pool, the rest unsubmitted
                return
            with self._lock:
                if workers is self._workers:
                    self._running[future] = (workers, pool_key, len(seeds), self._mono(), guess)
            future.add_done_callback(lambda f, w=workers, k=pool_key: self._hand_over(self._refilled, w, k, f))

    def _refilled(self, executor: object, pool_key: PoolKey, future: Future) -> None:
        """On the pumper thread: stock a job's payloads, learn costs, or handle its failure."""
        error = None if future.cancelled() else future.exception()
        backoff = None
        with self._lock:
            job = self._running.pop(future, None)
            if job is not None:  # still this pool's job: release its slot
                _, _, n, _, guess = job
                self._busy -= 1
                self._inflight_bytes -= guess
                left = self._inflight.get(pool_key, 0) - n
                if left > 0:
                    self._inflight[pool_key] = left
                else:
                    self._inflight.pop(pool_key, None)
            stocked = None
            capped = False  # payloads came back but the caps had no room: back-pressure, not a fault
            if not future.cancelled() and error is None:
                entries, seconds = future.result()
                now = self._mono()
                floor = self._floor(pool_key, now)
                stocked = 0
                for entry in entries:
                    if len(self._pools.get(pool_key, ())) >= self.pool_max:
                        break
                    above = len(self._pools.get(pool_key, ())) >= floor
                    if above and self._growth_bytes + len(entry.body) > self.pool_growth_bytes:
                        break  # the growth share
                    if not above and self._floor_bytes + len(entry.body) > self.floor_bytes_max:
                        break  # the floors' share (the sweep frees it from the least recently used)
                    if not self._add(pool_key, entry):
                        break  # the hard cap
                    stocked += 1
                    if above:
                        self._growth_bytes += len(entry.body)
                    else:
                        self._floor_bytes += len(entry.body)
                capped = bool(entries) and stocked == 0
                if entries:
                    old = self._cost.get(pool_key[1], seconds / len(entries))
                    self._cost[pool_key[1]] = 0.8 * old + 0.2 * seconds / len(entries)
                    self._refills_done += 1
                if executor is self._workers:
                    self._pool_failures = 0  # this worker pool works
                    self._workers_ready = True
            failed = error is not None and not isinstance(error, BrokenProcessPool)
            # A job that raised, or stocked nothing (no payloads back, or no room under the caps),
            # would be resubmitted at once and forever: the pool waits instead, doubling.
            if job is not None and (failed or stocked == 0):
                _, failures = self._key_retry.get(pool_key, (0.0, 0))
                backoff = min(BACKOFF_MAX_S, BACKOFF_FIRST_S * 2**failures)
                self._key_retry[pool_key] = (self._mono() + backoff, failures + 1)
                self._topping.discard(pool_key)
            elif stocked:
                self._key_retry.pop(pool_key, None)
        if isinstance(error, BrokenProcessPool):
            self._worker_failed(executor, error)
        elif backoff is not None and not capped:
            # A generator bug: the pool stays short, an empty pool builds inline, and the bug
            # surfaces there as a 503 instead of passing silently.
            self._warn(
                ("refill", pool_key[1]),
                "task refill for %s %s; that pool retries in %.1f s",
                pool_key[1],
                f"failed ({type(error).__name__})" if error is not None else "stocked nothing",
                backoff,
            )
        self._pump()

    def warm(
        self,
        archetypes: tuple[str, ...] = (NEUTRAL,),
        schema_types: tuple[str, ...] = SCHEMA_TYPES,
        at: float | None = None,
        inks: tuple[str, ...] = (DEFAULT_INKS,),
    ) -> int:
        """Fill the pools to POOL_SIZE now, in the caller's thread: every level, or only the one
        theta `at` falls on; Stroop once per preset in `inks`. Returns how many payloads the pools
        hold."""
        for archetype in archetypes:
            for schema_type in schema_types:
                for level in levels(schema_type) if at is None else [theta_level(schema_type, at)]:
                    for ink in sorted({pool_inks(schema_type, i) for i in inks}):
                        self._fill((archetype, schema_type, level, ink))
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
        if rec.get("source", PROCEDURAL) != PROCEDURAL:
            return self.variants(rec["task_id"])  # None: the session gets a new task
        try:
            entry = build_entry(rec.get("archetype", NEUTRAL), rec["schema"], rec["theta"], rec.get("inks", ""), rec["seed"])
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
        inks: str = DEFAULT_INKS,
    ) -> Served:
        """The next task for user `key` (telemetry_store.user_key() output). `inks` picks the
        Stroop preset; it only matters when Stroop is the schema served.

        Raises ValueError when the filters match no schema or `inks` is unknown, NoFreshTask when
        nothing unseen is left.
        """
        candidates = schemas_for(schema_type, dimension)
        if not candidates:
            raise ValueError("schema_type and dimension match no schema")
        pool_inks("stroop", inks)  # an unknown preset is the caller's error, whatever is chosen
        self._path(key)  # checks the key before anything is kept for it
        with self._held(key):
            now = self.clock()
            st = self._state(key, now)
            # The default inks keep the key the registry files already hold.
            ink_part = "" if inks == DEFAULT_INKS else f"|{inks}"
            ikey = f"{session_id}|{seq}|{schema_type or ''}|{dimension or ''}{ink_part}" if session_id else None
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
            ink = pool_inks(chosen, inks)
            pool_key = (archetype, chosen, level, ink)

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
                        self._take(pool_key, e)
                        break
                pool.extendleft(reversed(skipped))
                mono = self._mono()
                self._note_pop(pool_key, mono)  # demand counts inline builds too
                self._check_low_water(pool_key, mono)
            self._pump()
            tries = 0
            while entry is None:
                if tries == FRESH_TRIES:
                    raise NoFreshTask(f"no unseen {chosen} task after {FRESH_TRIES} tries")
                tries += 1
                e = build_entry(archetype, chosen, level, ink, self.seed_source())
                if not st.seen.seen(e.task_id, now):
                    entry = e

            st.seen.add(entry.task_id, now)
            previous = st.schemas.get(chosen)
            st.schemas[chosen] = {"theta": theta, "marker": marker, "served_at": now}
            if self.on_step is not None and previous is not None:
                # Only the 85% rule moves a seeded staircase, so a new served level is its decision.
                old_level = theta_level(chosen, previous["theta"])
                if old_level != level:
                    self.on_step(key, chosen, old_level, level)
            st.last = now
            if ikey:
                st.sessions[ikey] = {
                    "schema": chosen,
                    "theta": level,
                    "seed": entry.seed,
                    "source": entry.source,
                    "archetype": archetype,
                    "inks": ink,
                    "task_id": entry.task_id,
                    "at": now,
                }
                self._remember(entry.task_id, entry.body)
            st.prune(now)
            self._mark_dirty(key)
            return Served(entry.body, entry.task_id, chosen, level, False)

    # --- LLM variants (BE-13) ----------------------------------------------------------------------

    def offer(self, archetype: str, schema_type: str, level: float, entries: Sequence[Entry]) -> int:
        """Stock validated non-procedural entries (BE-13 LLM variants) in a pool in use; returns how
        many went in. The caller (llm_worker) has already run the served schema, the solvers and
        the content checks.

        - Only a pool that exists and is in use (floor > 0) takes offers.
        - The pool never passes its demand target (_want): when it is full, an LLM entry takes the
          place of a procedural one (the rightmost), and stops when only paid entries are left.
        - Every entry goes through _add, so the byte tallies and POOL_BYTES_MAX hold; the first
          refusal stops the offer. As in _refilled, an entry above the floor counts into the growth
          share and one within it into the floors' share (floor_bytes_max).
        - LLM entries go to the left: served first, and never the ones _sweep trims (it pops from
          the right).
        Demand, activity and in-flight counts are not touched: an offer is not a pop.
        """
        # ponytail: LLM variants go to the default-inks pools only (cvd_safe Stroop stays procedural);
        # add an inks argument here and in pool_stock when the worker validates per ink preset.
        pool_key = (archetype, schema_type, theta_level(schema_type, level), pool_inks(schema_type, DEFAULT_INKS))
        with self._lock:
            now = self._mono()
            pool = self._pools.get(pool_key)
            if self._closed or pool is None or self._floor(pool_key, now) == 0:
                return 0
            floor, want = self._floor(pool_key, now), self._want(pool_key, now)
            taken = 0
            for entry in entries:
                if entry.source == PROCEDURAL:
                    continue
                evict = len(pool) >= want
                if evict and (not pool or pool[-1].source != PROCEDURAL):
                    break  # full of paid entries already
                # Every check before the eviction, so a refused offer never costs a procedural entry.
                size, out = len(entry.body), len(pool[-1].body) if evict else 0
                above = len(pool) - evict >= floor
                freed = out if evict and len(pool) > floor else 0  # the evicted entry sat above the floor
                out_within = out if evict and len(pool) <= floor else 0  # ... or within it
                if above and self._growth_bytes - freed + size > self.pool_growth_bytes:
                    break  # the growth share
                if not above and self._floor_bytes - out_within + size > self.floor_bytes_max:
                    break  # the floors' share
                if self._pool_bytes - out + size > self.pool_bytes_max:
                    break  # the hard cap
                if evict:
                    self._take(pool_key, pool.pop())
                    self._growth_bytes -= freed
                    self._floor_bytes -= out_within
                if not self._add(pool_key, entry):
                    break  # the hard cap (not reached: checked above)
                pool.appendleft(pool.pop())  # _add appended it on the right
                if above:
                    self._growth_bytes += size
                else:
                    self._floor_bytes += size
                taken += 1
            return taken

    def pool_stock(self) -> dict[tuple[str, str, float], tuple[int, int]]:
        """The pools in use (floor > 0) as (entries, non-procedural entries), so the LLM worker
        fills only pools that serve someone. Keys are (archetype, schema, level): only the
        default-inks pools are listed, the ones offer() stocks."""
        with self._lock:
            now = self._mono()
            return {
                k[:3]: (len(p), sum(e.source != PROCEDURAL for e in p))
                for k, p in self._pools.items()
                if self._floor(k, now) > 0 and k[3] == pool_inks(k[1], DEFAULT_INKS)
            }

    def close(self) -> None:
        """Stop the worker processes, the pumper and the writer, and write what is pending.
        Idempotent."""
        with self._lock:
            self._closed = True
            workers = self._workers
        for ex in (workers, self._pumper, self._writer):
            shutdown = getattr(ex, "shutdown", None)
            if shutdown is not None:
                shutdown(wait=True, cancel_futures=True)
        self.flush()
