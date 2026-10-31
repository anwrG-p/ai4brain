"""Session pillar vectors from telemetry events, for fitting the clusters.

ponytail: stand-in for BE-07's brain_twin_jepa/features.py (the Python port of taskScores.ts and
pillars.ts), which was not on this branch's base. It scores a pillar as 100 x the mean score_norm
of the exercises that feed it (pillars.ts PILLAR_WEIGHTS sources), with no d', RT cost or gates.
Replace `session_pillars` with BE-07's per-session pillar scores once that lands.
"""

from __future__ import annotations

from collections import defaultdict

import numpy as np

from clustering_engine.clustering_gmm import PILLARS

# Exercise schema (task_id "<prefix>-<schema>-...") -> pillars it feeds, after pillars.ts:
# n-back: OSPAN, DCCS; tower: OTS planning/execution; matrix and relational: FluidMatrices;
# Stroop: ANT conflict, SST proxy; MST: LDI; UFOV: SOA, orienting. Rotation feeds none.
SCHEMA_PILLARS: dict[str, tuple[str, ...]] = {
    "nback": ("focus", "agility"),
    "tower": ("focus", "impulse"),
    "matrix": ("focus",),
    "relational": ("focus",),
    "stroop": ("agility", "impulse"),
    "mst": ("memory",),
    "ufov": ("visual",),
}


def _schema(task_id: str) -> str | None:
    parts = task_id.split("-")
    return parts[1] if len(parts) > 1 else None


def session_pillars(events) -> tuple[list[tuple[str, str]], np.ndarray]:
    """(user_id, session_id) keys and a [n, 5] array of 0-100 pillar scores, one row per session
    that has every pillar. Sessions missing a pillar are skipped (no imputed values, R15)."""
    scores: dict[tuple[str, str], dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for e in events:
        schema = _schema(e["task_id"])
        for pillar in SCHEMA_PILLARS.get(schema, ()):
            scores[(e["user_id"], e["session_id"])][(pillar, schema)].append(e["score_norm"])
    keys, rows = [], []
    for key in sorted(scores):
        by_pillar: dict[str, list[float]] = defaultdict(list)
        for (pillar, _schema_id), values in scores[key].items():
            by_pillar[pillar].append(float(np.mean(values)))  # each exercise counts once
        if all(p in by_pillar for p in PILLARS):
            keys.append(key)
            rows.append([100.0 * float(np.mean(by_pillar[p])) for p in PILLARS])
    return keys, np.array(rows, dtype=float).reshape(len(rows), len(PILLARS))
