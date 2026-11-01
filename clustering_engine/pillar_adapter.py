"""Session pillar vectors from telemetry events, for fitting the clusters.

Each session is scored by BE-07's brain_twin_jepa/features.py (the Python port of taskScores.ts
and pillars.ts, held to the TS by the golden vectors), after BE-07's dedupe. So the clusters see
the same pillar scores the app shows: d', RT costs, SSRT, PAL and every gate included.
"""

from __future__ import annotations

from collections import defaultdict

import numpy as np

from brain_twin_jepa.features import session_features
from brain_twin_jepa.telemetry_io import dedupe, group_sessions
from clustering_engine.clustering_gmm import PILLARS


def session_pillars(events) -> tuple[list[tuple[str, str]], np.ndarray]:
    """(user_id, session_id) keys, sorted, and a [n, 5] array of 0-100 pillar scores, one row per
    session where every pillar has a score. A pillar below its coverage has none, and that session
    is skipped (no imputed values, R15)."""
    by_user: dict[str, list[dict]] = defaultdict(list)
    for e in events:
        by_user[e["user_id"]].append(e)
    keys, rows = [], []
    for user_id in sorted(by_user):
        for session in sorted(group_sessions(dedupe(by_user[user_id])), key=lambda s: s.session_id):
            pillars = session_features(session.events)["pillars"]
            if all(pillars[p]["score"] is not None for p in PILLARS):
                keys.append((user_id, session.session_id))
                rows.append([float(pillars[p]["score"]) for p in PILLARS])
    return keys, np.array(rows, dtype=float).reshape(len(rows), len(PILLARS))
