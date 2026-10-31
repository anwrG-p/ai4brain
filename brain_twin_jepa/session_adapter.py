"""Telemetry events -> one record per session (pillar scores, coverage, start time) for the twin.

ponytail: a minimal local stand-in for BE-07 (`brain_twin_jepa/telemetry_io.py` + `features.py`),
which was not on this branch's base. Replace `read_jsonl_dir` with BE-07's `read_events` (it dedupes
on session_id, item_id and stream; this does not) and `_task_scores` / `_pillar_scores` with BE-07's
golden-vector port of frontend/src/features/insights/taskScores.ts and pillars.ts. This subset
follows those files but leaves out DCCS_SwitchCost and ErrorRecovery (agility is ANT_Conflict
alone, coverage .4), so its agility and the coverages differ from the frontend's.
The twin only needs `sessions(events) -> list[SessionRecord]`; nothing else imports this file.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from statistics import NormalDist

PILLARS = ("focus", "agility", "impulse", "memory", "visual")

# pillars.ts PILLAR_WEIGHTS, MIN_COVERAGE (verbatim).
PILLAR_WEIGHTS = {
    "focus": {"OSPAN": 0.45, "OTS_Planning": 0.3, "FluidMatrices": 0.25},
    "agility": {"ANT_Conflict": 0.4, "DCCS_SwitchCost": 0.4, "ErrorRecovery": 0.2},
    "impulse": {"SST_SSRT": 0.5, "OTS_Execution": 0.3, "DDM_Caution": 0.2},
    "memory": {"MST_LDI": 0.55, "PAL_FirstTrialMemory": 0.45},
    "visual": {"UFOV_SOA": 0.5, "ANT_Orienting": 0.5},
}
MIN_COVERAGE = 0.3

# taskScores.ts anchors (assumptions there, copied here).
D_PRIME_MAX = 4
STROOP_COST_MAX_MS = 300
STROOP_CHANCE = 0.25
PLAN_SHARE = 0.8
PLAN_TIME_MAX_MS = 30_000
UFOV_MIN_MS, UFOV_MAX_MS = 17, 500


@dataclass(frozen=True)
class SessionRecord:
    session_id: str
    started_at: datetime
    pillars: dict[str, float | None]  # 0-100, None below MIN_COVERAGE
    coverage: dict[str, float]  # 0-1, the doc-weight share with data


def read_jsonl_dir(directory: str | Path) -> dict[str, list[dict]]:
    """{user_id: events} from DIR/<user_id>.jsonl (the telemetry store and BE-08 layout)."""
    out: dict[str, list[dict]] = {}
    for path in sorted(Path(directory).glob("*.jsonl")):
        with open(path, encoding="utf-8") as f:
            out[path.stem] = [json.loads(line) for line in f if line.strip()]
    return out


def sessions(events: list[dict]) -> list[SessionRecord]:
    """One record per session_id, in order of the session's first client_ts."""
    by: dict[str, list[dict]] = {}
    for e in events:
        by.setdefault(e["session_id"], []).append(e)
    records = []
    for sid, es in by.items():
        start = min(_ts(e["client_ts"]) for e in es)
        pillars, coverage = _pillar_scores(_task_scores(es))
        records.append(SessionRecord(sid, start, pillars, coverage))
    return sorted(records, key=lambda r: r.started_at)


def _ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _schema(e: dict) -> str | None:
    m = e.get("trial_meta") or {}
    for key, schema in (("stream", "n_back"), ("congruent", "stroop"), ("angle_deg", "mental_rotation"),
                        ("hops", "relational"), ("l_min", "tower"), ("shown_ms", "ufov"), ("kind", "mst")):
        if key in m:
            return schema
    return "matrix" if e.get("dimension") == "pattern_induction" else None


def _clamp01(x: float) -> float:
    return min(1.0, max(0.0, x))


def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs)


def _ok(e: dict) -> bool:
    return not e["error_flag"]


def _share(es: list[dict], f) -> float:
    return sum(1 for e in es if f(e)) / len(es)


def _task_scores(events: list[dict]) -> dict[str, float]:
    """The doc's inputs, 0-100 (subset; see the module docstring)."""
    by: dict[str, list[dict]] = {}
    for e in events:
        s = _schema(e)
        if s:
            by.setdefault(s, []).append(e)
    get = lambda s: by.get(s, [])  # noqa: E731
    meta = lambda e, k: (e.get("trial_meta") or {}).get(k)  # noqa: E731
    out: dict[str, float] = {}

    # n-back d' on the rule stream, switch trials left out, log-linear correction, floored at 0.
    nb = [e for e in get("n_back") if meta(e, "stream") == meta(e, "rule") and meta(e, "trial_type") != "switch"]
    signal = [e for e in nb if meta(e, "trial_type") == "target"]
    noise = [e for e in nb if meta(e, "trial_type") != "target"]
    if signal and noise:
        hits, fas = sum(map(_ok, signal)), sum(not _ok(e) for e in noise)
        z = NormalDist().inv_cdf
        d = 0.0
        if hits / len(signal) > fas / len(noise):
            d = max(0.0, z((hits + 0.5) / (len(signal) + 1)) - z((fas + 0.5) / (len(noise) + 1)))
        out["OSPAN"] = 100 * _clamp01(d / D_PRIME_MAX)

    st = get("stroop")
    inc = [e for e in st if meta(e, "congruent") is False]
    inc_ok = [e for e in inc if _ok(e)]
    con_ok = [e for e in st if meta(e, "congruent") is True and _ok(e)]
    gate = _clamp01((_share(st, _ok) - STROOP_CHANCE) / (1 - STROOP_CHANCE)) if st else 0.0
    if inc_ok and con_ok:
        cost = _mean([e["response_time_ms"] for e in inc_ok]) - _mean([e["response_time_ms"] for e in con_ok])
        out["ANT_Conflict"] = 100 * _clamp01(1 - cost / STROOP_COST_MAX_MS) * gate
    elif st and gate == 0:
        out["ANT_Conflict"] = 0.0
    if inc:
        out["SST_SSRT"] = 100 * _share(inc, _ok)

    tw = [e for e in get("tower") if meta(e, "l_min") is not None and meta(e, "l_user") is not None]
    if tw:
        solved = lambda e: meta(e, "solved") is True  # noqa: E731
        out["OTS_Execution"] = 100 * _mean([min(1, meta(e, "l_min") / max(1, meta(e, "l_user"))) if solved(e) else 0.0 for e in tw])
        perfect = [e for e in tw if solved(e) and meta(e, "l_user") <= meta(e, "l_min")]
        speed = _mean([_clamp01(1 - (meta(e, "planning_time_ms") or PLAN_TIME_MAX_MS) / PLAN_TIME_MAX_MS) for e in perfect]) if perfect else 0.0
        out["OTS_Planning"] = 100 * _clamp01(PLAN_SHARE * len(perfect) / len(tw) + (1 - PLAN_SHARE) * speed)

    mx, rel = get("matrix"), get("relational")
    parts = []
    if mx:
        parts.append(_share(mx, _ok))
    if rel:
        hops = lambda e: max(1, meta(e, "hops") or 1)  # noqa: E731
        parts.append(sum(hops(e) for e in rel if _ok(e)) / sum(hops(e) for e in rel))
    if parts:
        out["FluidMatrices"] = 100 * _clamp01(_mean(parts))

    ms = get("mst")
    lures = [e for e in ms if meta(e, "kind") == "lure"]
    news = [e for e in ms if meta(e, "kind") == "new"]
    if lures and news:
        similar = lambda e: meta(e, "response") == "similar"  # noqa: E731
        out["MST_LDI"] = 100 * _clamp01(_share(lures, similar) - _share(news, similar))

    uf = get("ufov")
    thresholds = [t for t in (meta(e, "quest_threshold_ms") for e in uf) if isinstance(t, (int, float))]
    if thresholds:
        out["UFOV_SOA"] = 100 * _clamp01((UFOV_MAX_MS - _mean(thresholds)) / (UFOV_MAX_MS - UFOV_MIN_MS))
    if uf:
        out["ANT_Orienting"] = 100 * _share(uf, lambda e: meta(e, "peripheral_ok") is True)
    return out


def _pillar_scores(inputs: dict[str, float]) -> tuple[dict[str, float | None], dict[str, float]]:
    """pillars.ts pillarScores: weights renormalised over the inputs present; None below MIN_COVERAGE."""
    scores, coverage = {}, {}
    for p in PILLARS:
        cov = sum(w for k, w in PILLAR_WEIGHTS[p].items() if k in inputs)
        total = sum(w * inputs[k] for k, w in PILLAR_WEIGHTS[p].items() if k in inputs)
        coverage[p] = round(cov, 6)
        scores[p] = total / cov if cov >= MIN_COVERAGE else None
    return scores, coverage
