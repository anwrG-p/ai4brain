"""Telemetry retention: drop events received more than N days ago.

Run from assessment_engine/api (e.g. daily from cron):  python -m retention --days 30
Prints one JSON line: {"files", "kept", "dropped", "undated", "removed_files"}.
"dropped" counts expired lines; "undated" counts lines with no readable received_at,
which are also removed. No FastAPI here: another server can import purge_expired as is.
"""

import argparse
import json
import os
import sys
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path

from telemetry_store import LockTimeout, telemetry_dir, telemetry_lock

# GDPR Art 5(1)(e) storage limitation; the period README.md promises for raw telemetry.
DEFAULT_DAYS = 30


def _received_at(line: str) -> datetime | None:
    try:
        ts = datetime.fromisoformat(json.loads(line)["received_at"])
    except (ValueError, KeyError, TypeError):
        return None
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def _keep(lines: list[str], cutoff: datetime) -> tuple[list[str], int]:
    """Lines received at or after `cutoff`, and how many lines had no readable date.

    An undated line is not kept: retention must not hold forever what it cannot date.
    """
    kept, undated = [], 0
    for line in lines:
        ts = _received_at(line)
        if ts is None:
            undated += 1
        elif ts >= cutoff:
            kept.append(line)
    return kept, undated


def purge_expired(
    directory: Path,
    days: int,
    now: datetime | None = None,
    on_wait: Callable[[], None] | None = None,
) -> dict[str, int]:
    """Rewrite every `*.jsonl` in `directory` without lines older than `days`.

    Raises LockTimeout if the lock stays busy; files already done stay done.
    """
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=days)
    report = {"files": 0, "kept": 0, "dropped": 0, "undated": 0, "removed_files": 0}
    if not directory.is_dir():
        return report
    for path in sorted(directory.glob("*.jsonl")):
        # One file per lock hold, so ingest waits for one rewrite, not the whole sweep.
        with telemetry_lock(directory, on_wait=on_wait):
            if not path.is_file():  # deleted by the privacy route since the glob
                continue
            lines = [line for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
            kept, undated = _keep(lines, cutoff)
            report["files"] += 1
            report["kept"] += len(kept)
            report["undated"] += undated
            report["dropped"] += len(lines) - len(kept) - undated
            if not kept:
                path.unlink()
                report["removed_files"] += 1
            elif len(kept) < len(lines):
                tmp = path.with_name(path.name + ".tmp")
                tmp.write_text("".join(line + "\n" for line in kept), encoding="utf-8")
                os.replace(tmp, path)
    return report


def _days(value: str) -> int:
    days = int(value)
    if days < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return days


def _say_waiting() -> None:
    print("retention: waiting for the telemetry lock", file=sys.stderr, flush=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m retention", description=__doc__)
    parser.add_argument("--days", type=_days, default=DEFAULT_DAYS)
    args = parser.parse_args(argv)
    try:
        report = purge_expired(telemetry_dir(), args.days, on_wait=_say_waiting)
    except LockTimeout as e:
        print(f"retention: {e}; run again later", file=sys.stderr)
        return 1
    print(json.dumps(report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
