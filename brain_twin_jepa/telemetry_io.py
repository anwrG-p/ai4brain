"""Reading one user's stored telemetry: dedupe, then sessions.

The store (`backend/app/privacy/telemetry_store.py`) appends every accepted event to
`{user_key}.jsonl`. The client retries a batch until the server acknowledges it, so storage is
at least once: the same trial can be stored twice. `read_events` drops those repeats.

Dedupe key: (session_id, trial_meta.item_id, trial_meta.stream), first row kept. The client sets
item_id to `${task_id}:${trial_index}` (tracker.ts), and n-back logs one event per stream under one
item_id, hence the stream. A row without item_id falls back to task_id:trial_index. The frontend
itself never dedupes before scoring (its events never leave the page twice); the same rule is in
`scripts/golden/make_golden.mjs`, which scores the golden cases after it.

A session is one `session_id` (the client mints one per page load and stamps every event with it).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.privacy.telemetry_store import telemetry_dir, telemetry_lock, user_key

Event = dict[str, Any]


def dedupe_key(e: Event) -> tuple[Any, Any, Any]:
    m = e.get("trial_meta") or {}
    item = m.get("item_id")
    if item is None:
        item = f"{e.get('task_id')}:{e.get('trial_index')}"
    return (e.get("session_id"), item, m.get("stream"))


def dedupe(events: list[Event]) -> list[Event]:
    """Drops repeats of dedupe_key(), keeping the first, in the original order."""
    seen: set[tuple[Any, Any, Any]] = set()
    out = []
    for e in events:
        key = dedupe_key(e)
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    return out


def read_events(user_id: str, directory: Path | None = None) -> list[Event]:
    """The user's stored events in append order, deduplicated. [] when nothing is stored.

    Reads under the telemetry lock, so a delete or retention rewrite is never seen half done.
    Raises ValueError for a bad id (user_key) and LockTimeout when the lock stays busy. A line
    that is not a JSON object (a torn write) is skipped: it is not an event.
    """
    key = user_key(user_id)
    directory = directory or telemetry_dir()
    path = directory / f"{key}.jsonl"
    if not path.is_file():
        return []
    with telemetry_lock(directory):
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError:  # deleted between the check and the lock
            return []
    events = []
    for line in text.splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(row, dict):
            events.append(row)
    return dedupe(events)


def client_time(e: Event) -> datetime:
    """The event's client_ts as an aware datetime. The client may omit the offset; that is UTC."""
    ts = datetime.fromisoformat(str(e["client_ts"]))
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


@dataclass
class Session:
    session_id: str
    events: list[Event] = field(default_factory=list)

    @property
    def started_at(self) -> datetime:
        return min(client_time(e) for e in self.events)

    @property
    def ended_at(self) -> datetime:
        return max(client_time(e) for e in self.events)

    @property
    def task_ids(self) -> list[str]:
        return list(dict.fromkeys(e["task_id"] for e in self.events))


def group_sessions(events: list[Event]) -> list[Session]:
    """Events grouped by session_id, each in append order; sessions ordered by start time
    (ties keep first appearance)."""
    by_id: dict[str, Session] = {}
    for e in events:
        sid = e["session_id"]
        by_id.setdefault(sid, Session(sid)).events.append(e)
    return sorted(by_id.values(), key=lambda s: s.started_at)


def read_sessions(user_id: str, directory: Path | None = None) -> list[Session]:
    """read_events() grouped into sessions."""
    return group_sessions(read_events(user_id, directory))
