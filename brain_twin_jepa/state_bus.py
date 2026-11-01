"""The state bus (BE-11): Member 3's per-user cluster state, published to Members 5 and 2.

README "Inter-Subsystem Communication Interfaces":
- to the task service (Member 5): {user_id, active_cluster_id, centroid_vector, confidence}
  (`ClusterState`, topic "tasks"). GET /v1/tasks/next serves from that cluster's pool
  (`task_archetype`) and seeds new staircases from the latest pillar scores (`task_pillars`).
- to the coach (Member 2): {user_id, transition_occurred, delta_vector, uncertainty}
  (`CoachSignal`, topic "coach"). The coach turns Δc into words (`coach_context`); numbers never
  reach the user.

In-process pub/sub: `bus.subscribe(topic, fn)`, delivered synchronously; a failing subscriber is
logged (no user id) and never stops the others. The last event of each topic is also kept per
user (retained), so a consumer that was not listening can read it.

When it runs: lazily. A profile or evaluate request refreshes in full. GET /v1/tasks/next and the
coach chat call `refresh_light`, which only stats the user's JSONL and reads the bytes appended
since the last refresh; it recomputes in full only when a new session started (or the model, or a
deleted/rewritten file, changed). During play that is once per session, not once per request.

Frames. A session is one clustering frame once it is closed: a later session exists, or nothing
arrived for SESSION_IDLE (30 min). Its vector is the latest score of each pillar up to and
including it; with any pillar never scored there is no vector and no step (never imputed, R15).
Each closed session is stepped through the user's HysteresisGate exactly once.

Gate state per user, persisted with the BE-09 model_id. When the served model's id differs (or the
user is new), the gate starts fresh: every closed session counts as seen and the latest one with a
vector is adopted. Component indices mean nothing across models, so a model swap is never a
"transition"; a transition is a change of the active cluster under one model.

Storage: `{STATE_BUS_DIR}/{user_key}.json` (default data/processed/state_bus, gitignored), written
as tmp + replace under a per-user lock. It is per-user data: the privacy delete and export cover it
(`register_user_store`), and the retention CLI drops files idle past RETENTION_DAYS.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import zlib
from collections import defaultdict
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np

from app.privacy.telemetry_store import (
    register_user_store,
    state_bus_dir,
    telemetry_dir,
    telemetry_lock,
    user_key,
)
from brain_twin_jepa import profile
from brain_twin_jepa.profile import PILLARS, SessionSummary
from brain_twin_jepa.telemetry_io import Session, read_sessions

log = logging.getLogger(__name__)

NEUTRAL = "neutral"  # dynamic_cache.cache_dispatcher.NEUTRAL: the pool before any cluster
SESSION_IDLE = timedelta(minutes=30)
FRAMES_KEPT = 200  # seen session ids remembered per user (only the newest one decides what is new)
TRAIL_KEPT = 10
TAIL_MAX_BYTES = 1 << 20  # a light refresh never reads more than this; past it, a full refresh
TOPICS = ("tasks", "coach")


# --- events ----------------------------------------------------------------------------------------


@dataclass(frozen=True)
class ClusterState:
    """Member 3 -> Member 5."""

    user_id: str
    active_cluster_id: int
    centroid_vector: dict[str, float]  # the active cluster's mean, 0-100 per pillar
    confidence: float  # its posterior on the latest frame
    model_id: str
    archetype: str  # the consumer name (model.name)
    pool: str  # the task pool key


@dataclass(frozen=True)
class CoachSignal:
    """Member 3 -> Member 2."""

    user_id: str
    transition_occurred: bool
    delta_vector: dict[str, float]  # Δc = μ_target − μ_active per pillar, μ_target the runner-up
    uncertainty: float  # 1 − the active cluster's posterior on the latest frame
    model_id: str


class StateBus:
    def __init__(self) -> None:
        self._subs: dict[str, list[Callable[[Any], None]]] = defaultdict(list)
        self._lock = threading.Lock()

    def subscribe(self, topic: str, fn: Callable[[Any], None]) -> Callable[[], None]:
        """Calls fn(event) for every event on `topic`. Returns the unsubscribe function."""
        if topic not in TOPICS:
            raise ValueError(f"topic must be one of {TOPICS}")
        with self._lock:
            self._subs[topic].append(fn)

        def unsubscribe() -> None:
            with self._lock:
                if fn in self._subs[topic]:
                    self._subs[topic].remove(fn)

        return unsubscribe

    def publish(self, topic: str, event: Any) -> None:
        with self._lock:
            subscribers = list(self._subs[topic])
        for fn in subscribers:
            try:
                fn(event)
            except Exception as e:  # one consumer's bug never stops the others; no user id logged
                log.warning("state bus: a %s subscriber failed (%s)", topic, type(e).__name__)


bus = StateBus()


# --- per-user state --------------------------------------------------------------------------------


@dataclass
class UserState:
    model_id: str | None = None
    gate: dict | None = None  # dataclasses.asdict(HysteresisGate)
    gamma: list[float] | None = None  # posteriors of the last frame stepped
    frames: list[str] = field(default_factory=list)  # session ids stepped (or skipped), newest last
    open_session: dict | None = None  # {"id", "last_received"}: the newest session, not yet a frame
    telemetry: list[int] | None = None  # [size, mtime_ns] of the JSONL at the last refresh
    pillars: dict[str, float | None] | None = None  # latest score per pillar
    tasks: dict | None = None  # retained ClusterState
    coach: dict | None = None  # retained CoachSignal
    trail: list[dict] = field(default_factory=list)  # adaptation decisions, oldest first

    @classmethod
    def from_json(cls, d: dict) -> "UserState":
        known = {k: d[k] for k in cls.__dataclass_fields__ if k in d}
        return cls(**known)


def state_dir() -> Path:
    return state_bus_dir()


# Striped locks: bounded memory, one user's refreshes and writes serialised. Re-entrant, so a
# helper may take the lock its caller holds.
_locks = [threading.RLock() for _ in range(64)]


def _lock(key: str) -> threading.RLock:
    return _locks[zlib.crc32(key.encode()) % len(_locks)]


def _path(key: str, directory: Path | None = None) -> Path:
    return (directory or state_dir()) / f"{key}.json"


def load(user_id: str) -> UserState | None:
    key = user_key(user_id)
    try:
        text = _path(key).read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    try:
        return UserState.from_json(json.loads(text))
    except (ValueError, TypeError):
        log.warning("state bus: an unreadable state file was reset")
        return None


def _save(key: str, st: UserState) -> None:
    path = _path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(asdict(st), allow_nan=False), encoding="utf-8")
    os.replace(tmp, path)


def _remove(key: str, directory: Path | None = None) -> int:
    removed = 0
    for p in (_path(key, directory), _path(key, directory).with_suffix(".json.tmp")):
        try:
            p.unlink()
            removed += p.suffix == ".json"
        except FileNotFoundError:
            pass
    return removed


# Privacy: the delete removes the file, the export carries it. With an explicit directory (a tool,
# a test), only `directory/state_bus/` is touched.
def _delete(key: str, directory: Path | None) -> int:
    if directory is not None:
        return _remove(key, directory)
    with _lock(key):
        return _remove(key)


def _export(key: str, directory: Path | None) -> dict | None:
    path = _path(key, directory)
    with _lock(key):
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return None
    try:
        return json.loads(text)
    except ValueError:
        return {"unreadable": text}


register_user_store("state_bus", delete=_delete, export=_export)


# --- refresh ---------------------------------------------------------------------------------------


def _now(now: datetime | None) -> datetime:
    return now or datetime.now(timezone.utc)


def _stat(key: str) -> list[int] | None:
    try:
        st = (telemetry_dir() / f"{key}.jsonl").stat()
    except OSError:
        return None
    return [st.st_size, st.st_mtime_ns]


def _closed(summaries: list[SessionSummary], now: datetime) -> list[SessionSummary]:
    """Every session but the newest, and the newest too once it has been idle for SESSION_IDLE."""
    if not summaries:
        return []
    last = summaries[-1]
    return summaries if now - last.last_received >= SESSION_IDLE else summaries[:-1]


def _vectors(summaries: list[SessionSummary], closed_ids: set[str]) -> list[tuple[str, np.ndarray | None]]:
    """(session id, frame vector) for each closed session, in order: the latest score per pillar
    up to and including it."""
    scores: dict[str, float | None] = {p: None for p in PILLARS}
    out = []
    for s in summaries:
        for p in PILLARS:
            if s.pillars.get(p) is not None:
                scores[p] = s.pillars[p]
        if s.session_id in closed_ids:
            out.append((s.session_id, profile.frame_vector(scores)))
    return out


def pool_name(model, k: int) -> str:
    """The task pool of component k: one per named archetype (stable across refits), one per
    unnamed component of this model."""
    aid = None if model.archetype_ids is None else model.archetype_ids[k]
    return f"archetype-{aid}" if aid is not None else f"cluster-{model.model_id}-{k}"


def _events(key: str, model, active: int, gamma: np.ndarray, transition: bool) -> tuple[ClusterState, CoachSignal]:
    means = model.means
    others = [k for k in range(model.k) if k != active]
    if others:
        target = max(others, key=lambda k: gamma[k])
        delta = means[target] - means[active]
    else:  # a one-component model: nothing to compare with
        delta = np.zeros(len(PILLARS))
    task = ClusterState(
        user_id=key,
        active_cluster_id=int(active),
        centroid_vector={p: float(v) for p, v in zip(PILLARS, means[active])},
        confidence=float(gamma[active]),
        model_id=model.model_id,
        archetype=model.name(active),
        pool=pool_name(model, active),
    )
    coach = CoachSignal(
        user_id=key,
        transition_occurred=transition,
        delta_vector={p: float(v) for p, v in zip(PILLARS, delta)},
        uncertainty=float(1.0 - gamma[active]),
        model_id=model.model_id,
    )
    return task, coach


def _add_trail(st: UserState, entry: dict, now: datetime) -> None:
    st.trail.append({"at": now.isoformat(), **entry})
    del st.trail[:-TRAIL_KEPT]


def _step(key: str, st: UserState, summaries: list[SessionSummary], now: datetime) -> list[tuple[str, Any]]:
    """Steps the gate on every closed session not stepped yet. Returns the events to publish."""
    from clustering_engine.hysteresis import HysteresisGate

    model, _ = profile.cluster_model()
    closed = _closed(summaries, now)
    st.pillars = profile.latest_scores(summaries)
    newest = summaries[-1] if summaries else None
    st.open_session = (
        {"id": newest.session_id, "last_received": newest.last_received.isoformat()}
        if newest is not None and newest not in closed
        else None
    )
    if model is None:  # no model: no cluster, and nothing retained from an earlier one
        st.model_id = st.gate = st.gamma = st.tasks = st.coach = None
        st.frames = [s.session_id for s in closed][-FRAMES_KEPT:]
        return []

    frames = _vectors(summaries, {s.session_id for s in closed})
    if st.model_id != model.model_id or st.gate is None:
        # A fresh gate: everything closed counts as seen; adopt the latest frame with a vector.
        st.model_id, gate, st.gamma = model.model_id, HysteresisGate(), None
        if st.tasks and st.tasks.get("model_id") != model.model_id:
            st.tasks = st.coach = None  # another model's indices
        pending = [f for f in frames if f[1] is not None][-1:]
    else:
        gate = HysteresisGate(**st.gate)
        seen = set(st.frames)
        # New frames are the ones after the newest frame already seen, in session order. A late
        # session that sorts before it (an offline device syncing) is history: seen, not stepped.
        last = max((i for i, (sid, _) in enumerate(frames) if sid in seen), default=-1)
        pending = [f for f in frames[last + 1 :] if f[1] is not None]
    st.frames = [sid for sid, _ in frames][-FRAMES_KEPT:]  # every closed session is now seen

    gamma = None
    for _, vec in pending:
        gamma = model.posteriors(vec)
        gate.step(gamma)
    st.gate = asdict(gate)
    if gamma is None:
        return []
    st.gamma = [float(g) for g in gamma]

    before = st.tasks  # same model here (cleared above otherwise)
    transition = before is not None and before["active_cluster_id"] != gate.active
    task, coach = _events(key, model, gate.active, gamma, transition)
    styles = [t for t in st.trail if t.get("kind") == "style"]
    if not styles or styles[-1].get("archetype") != task.archetype:
        _add_trail(st, {"kind": "style", "archetype": task.archetype, "first": not styles}, now)
    st.tasks, st.coach = asdict(task), asdict(coach)
    return [("tasks", task), ("coach", coach)]


def _refresh(key: str, summaries: list[SessionSummary] | None, now: datetime, stat: list[int] | None) -> UserState:
    with _lock(key):
        st = load(key) or UserState()
        if summaries is None:
            stat = _stat(key)  # before the read: a later append makes the next refresh look again
            summaries = [profile.summarize(s) for s in read_sessions(key)]
        if not summaries:
            # Nothing measured (never, or deleted/expired): keep only the decisions already shown.
            st = UserState(trail=st.trail)
            if st.trail:
                _save(key, st)
            else:
                _remove(key)
            return st
        published = _step(key, st, summaries, now)
        st.telemetry = stat
        _save(key, st)
    for topic, event in published:  # outside the lock: subscribers may call back into the bus
        bus.publish(topic, event)
    return st


def refresh(user_id: str, summaries: list[SessionSummary] | None = None, *, now: datetime | None = None) -> UserState:
    """Full refresh: reads the user's sessions (unless given), steps the gate on every closed
    session not stepped yet, saves, and publishes a ClusterState and a CoachSignal when a frame
    was stepped. Raises telemetry_io.EventsTooLarge and telemetry_store.LockTimeout."""
    return _refresh(user_key(user_id), summaries, _now(now), None)


def refresh_full(user_id: str, *, now: datetime | None = None) -> tuple[UserState, list[Session], list[SessionSummary]]:
    """refresh(), also returning the sessions read and their summaries (the profile route needs
    both, and reads the file once). Same errors as refresh()."""
    key = user_key(user_id)
    stat = _stat(key)  # before the read: a later append makes the next refresh look again
    sessions = read_sessions(key)
    summaries = [profile.summarize(s) for s in sessions]
    return _refresh(key, summaries, _now(now), stat), sessions, summaries


def _tail_session_ids(key: str, start: int, end: int) -> tuple[set[str], datetime | None] | None:
    """Session ids and the newest received_at in the bytes appended since `start`. None when that
    cannot be read cheaply (too much, or the file shrank meanwhile)."""
    if end - start > TAIL_MAX_BYTES:
        return None
    directory = telemetry_dir()
    with telemetry_lock(directory):
        try:
            with open(directory / f"{key}.jsonl", "rb") as f:
                f.seek(max(0, start - 1))
                blob = f.read(end - max(0, start - 1))
        except FileNotFoundError:
            return None
    if start > 0 and not blob.startswith(b"\n"):
        # `start` fell inside a line (a stat taken mid-append): that line was not read, so look again in full.
        return None
    ids, newest = set(), None
    for line in blob.splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if isinstance(row, dict):
            ids.add(str(row.get("session_id")))
            r = profile._received(row)
            if r is not None and (newest is None or r > newest):
                newest = r
    return ids, newest


def refresh_light(user_id: str, *, now: datetime | None = None) -> UserState | None:
    """The cheap refresh for hot paths (tasks/next, coach chat): a full refresh only when a new
    session started, the open one went idle, the model changed or the file was rewritten."""
    key, now = user_key(user_id), _now(now)
    with _lock(key):
        st = load(key)
        stat = _stat(key)
        if stat is None and (st is None or st.telemetry is None):
            return st  # nothing measured, nothing derived from it
        model, _ = profile.cluster_model()
        same_model = st is not None and st.model_id == (model.model_id if model else None)
        if same_model and st.telemetry is not None and stat is not None:
            idle = st.open_session is not None and now - datetime.fromisoformat(st.open_session["last_received"]) >= SESSION_IDLE
            if stat == st.telemetry and not idle:
                return st
            if stat[0] > st.telemetry[0] and st.open_session is not None:
                tail = _tail_session_ids(key, st.telemetry[0], stat[0])
                if tail is not None and tail[0] <= {st.open_session["id"]}:
                    if tail[1] is not None:
                        st.open_session["last_received"] = tail[1].isoformat()
                    if now - datetime.fromisoformat(st.open_session["last_received"]) < SESSION_IDLE:
                        st.telemetry = stat
                        _save(key, st)
                        return st
        return _refresh(key, None, now, None)


# --- what the consumers read -----------------------------------------------------------------------


def pool_key(user_id: str) -> str:
    """The user's task pool from the retained ClusterState (no refresh)."""
    st = load(user_id)
    return st.tasks["pool"] if st and st.tasks else NEUTRAL


def task_archetype(key: str) -> str:
    """Dispatcher `archetype=` callback (Member 5). Never fails a task request."""
    try:
        refresh_light(key)
        return pool_key(key)
    except Exception as e:
        log.warning("state bus: archetype lookup failed (%s); neutral pool", type(e).__name__)
        return NEUTRAL


def task_pillars(key: str) -> dict[str, float | None] | None:
    """Dispatcher `pillars=` callback: the latest pillar scores, for a new staircase's seed."""
    try:
        st = refresh_light(key)
        return st.pillars if st else None
    except Exception as e:
        log.warning("state bus: pillar lookup failed (%s); no projection", type(e).__name__)
        return None


def record_step(key: str, schema_type: str, old_level: float, new_level: float) -> None:
    """Dispatcher `on_step=` callback: a staircase moved the served level of one exercise."""
    if new_level == old_level:
        return
    try:
        key = user_key(key)
        with _lock(key):
            st = load(key) or UserState()
            _add_trail(st, {"kind": "harder" if new_level > old_level else "easier", "schema": schema_type}, _now(None))
            _save(key, st)
    except Exception as e:  # the task is still served
        log.warning("state bus: could not record a staircase step (%s)", type(e).__name__)


def coach_context(key: str) -> dict | None:
    """What the coach (Member 2) gets: the retained CoachSignal's Δc and uncertainty, plus the
    latest adaptation reason. None when nothing is known. Never fails a chat turn."""
    try:
        st = refresh_light(key)
    except Exception as e:
        log.warning("state bus: coach context unavailable (%s)", type(e).__name__)
        return None
    if st is None:
        return None
    # A "why" question is about the rounds, so the latest staircase step wins over a style change.
    steps = [t for t in st.trail if t.get("kind") in ("harder", "easier")]
    latest = profile.why_this(steps, limit=1) or profile.why_this(st.trail, limit=1)
    if not st.coach and not latest:
        return None
    return {
        "delta_vector": dict(st.coach["delta_vector"]) if st.coach else None,
        "uncertainty": float(st.coach["uncertainty"]) if st.coach else None,
        "transition_occurred": bool(st.coach["transition_occurred"]) if st.coach else False,
        "adaptation_reason": latest[0]["reason"] if latest else None,
    }
