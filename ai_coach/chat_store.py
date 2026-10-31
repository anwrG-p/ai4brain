"""Per-user coach chat history: only what the user saw and picked.

One JSONL file per user, `{COACH_DIR}/{user_key}.jsonl` (default `data/processed/coach/`, gitignored).
The location, the lock, delete, export and retention live in `app.privacy.telemetry_store` and
`app.privacy.retention`, beside the telemetry store, so one DELETE and one export cover both.

What is stored, per exchange that reached the coach:
- the user's turn: the typed text or the clicked choice's label (`kind`), as sent;
- Loti's reply, as returned (and so as shown), with its `reply_source`.
What is NOT stored: the transcript the client sends as context (it was stored when it happened,
or it was scripted and never reached the server), and any turn an input gate answered (crisis,
crisis signpost, health signpost) or that failed closed. Those may be the most sensitive words a
user ever types here; the reply they got is fixed copy, and nothing downstream needs them.

Rows: {"record": "coach_turn", "user_id", "received_at", "from": "you"|"loti", "text",
"kind": "typed"|"choice" (user rows), "reply_source" (Loti rows)}.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from app.privacy.telemetry_store import coach_dir, telemetry_lock, user_key

RECORD = "coach_turn"


def append_exchange(
    user_id: str,
    user_text: str,
    kind: str,
    reply_text: str,
    reply_source: str,
    directory: Optional[Path] = None,
    received_at: Optional[datetime] = None,
    lock_timeout: Optional[float] = None,
) -> int:
    """Append the user's turn and Loti's reply under the store lock.

    Raises LockTimeout if the lock stays busy past `lock_timeout` (default: the store's 10 s).
    """
    key = user_key(user_id)
    directory = directory or coach_dir()
    stamp = (received_at or datetime.now(timezone.utc)).isoformat()
    base = {"record": RECORD, "user_id": key, "received_at": stamp}
    rows = [
        {**base, "from": "you", "kind": kind, "text": user_text},
        {**base, "from": "loti", "reply_source": reply_source, "text": reply_text},
    ]
    with telemetry_lock(directory, timeout=lock_timeout):
        with open(directory / f"{key}.jsonl", "a", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return len(rows)


def read_turns(user_id: str, directory: Optional[Path] = None) -> List[Dict]:
    """Every stored row for the user, oldest first. Unreadable lines are skipped."""
    key = user_key(user_id)
    path = (directory or coach_dir()) / f"{key}.jsonl"
    if not path.is_file():
        return []
    with telemetry_lock(path.parent):
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return []
    rows = []
    for line in text.splitlines():
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if isinstance(row, dict) and row.get("record") == RECORD:
            rows.append(row)
    return rows
