"""Profile service (BE-11): what GET /v1/dashboard/profile says about one user.

Every value comes from the user's own telemetry or is left out with a reason (R15):
- pillars: BE-07's `session_features` per session (the Python port of taskScores.ts + pillars.ts).
  For each of the 5 pillars: the latest session's score and uncertainty, the average over every
  session that scored it, and how many did.
- uncertainty: the app's own method (pillars.ts, ported in features.pillar_scores): a 95%
  half-width from the worst-case binomial SE of each input, weighted, divided by coverage, capped
  at 50. Hamza's Kalman filter (app/tools/digital_brain_updater.py) is NOT used: its noise terms
  are fixed constants on a T-score scale (R = 2.25, a 1.5-point SD per session, far tighter than
  the ~11 points a 20-trial binomial input allows) with no data behind them, its transition matrix
  pulls every node toward a cross-node mean, and its observation map is per cortical node, with
  rows marked "not an estimate". Its sigma would claim precision nobody measured.
- archetype: the state bus's gated cluster (BE-09 GMM + hysteresis), or null with a reason.
- forecast: BE-10's twin in shadow mode (R17): `validated: false` and its calibration source, or
  null with a reason. The UI shows measured values only.
- collaboration: BE-06's scorer on the stored chat history. Its archetype weights are NOT applied:
  they assume cluster ids 0-8 ordered from beginner to advanced, and BE-09's ids are practice
  styles (6 is "Fresh starter"), so the weights would rank users by an order that does not exist.
- why_this: the last adaptation decisions (staircase steps, practice-style changes) as plain
  reasons with no numbers.

Brain-region names never appear (U5); keys are pillar ids.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import warnings
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from brain_twin_jepa.features import PILLAR_IDS, session_features
from brain_twin_jepa.telemetry_io import Session, client_time

log = logging.getLogger(__name__)

PILLARS: tuple[str, ...] = PILLAR_IDS
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CLUSTER_MODEL = REPO_ROOT / "models" / "clustering" / "gmm.json"
DEFAULT_TWIN_CHECKPOINT = REPO_ROOT / "models" / "checkpoints" / "sat_jepa.pt"

# The clustering model must be fitted on the features the profile computes (BE-07's per-session
# pillar scores). bootstrap.py tags what it saves; a model without the tag is refused.
FEATURES_SOURCE = "be07"
PROFILE_MIN_SESSIONS = 1  # sessions that scored at least one pillar
FORECAST_H_MAX = 6  # brain_twin_jepa.jepa_model.H_MAX, without importing torch here
TRAIL_SHOWN = 5

# Consumer exercise names (frontend/src/features/assessment/names.ts).
EXERCISE_NAME = {
    "relational": "Logic Web",
    "n_back": "Memory Gauntlet",
    "tower": "Strategic Blueprint",
    "ufov": "Perceptual Radar",
    "mst": "Precision Archive",
    "stroop": "Color Clash",
    "matrix": "Pattern Puzzle",
    "mental_rotation": "Shape Turn",
}


# --- sessions --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class SessionSummary:
    """One session as the profile and the state bus read it."""

    session_id: str
    started_at: datetime
    last_received: datetime  # when its newest event reached the server (client time if unknown)
    pillars: dict[str, float | None]  # 0-100, None below the coverage floor
    uncertainty: dict[str, float]  # 95% half-width in points (pillars.ts)


def _received(e: dict) -> datetime | None:
    try:
        ts = datetime.fromisoformat(str(e["received_at"]))
    except (KeyError, ValueError):
        return None
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def summarize(session: Session) -> SessionSummary:
    pillars = session_features(session.events)["pillars"]
    received = [r for r in map(_received, session.events) if r is not None]
    return SessionSummary(
        session_id=session.session_id,
        started_at=session.started_at,
        last_received=max(received) if received else max(client_time(e) for e in session.events),
        pillars={p: pillars[p]["score"] for p in PILLARS},
        uncertainty={p: pillars[p]["uncertainty"] for p in PILLARS},
    )


def latest_scores(summaries: list[SessionSummary]) -> dict[str, float | None]:
    """The most recent score of each pillar (None if none scored it)."""
    out: dict[str, float | None] = {p: None for p in PILLARS}
    for s in summaries:
        for p in PILLARS:
            if s.pillars.get(p) is not None:
                out[p] = s.pillars[p]
    return out


def pillar_profile(summaries: list[SessionSummary]) -> dict[str, dict | None]:
    out: dict[str, dict | None] = {}
    for p in PILLARS:
        scored = [s for s in summaries if s.pillars.get(p) is not None]
        if not scored:
            out[p] = None
            continue
        values = [s.pillars[p] for s in scored]
        out[p] = {
            "latest": round(values[-1], 1),
            "uncertainty": round(scored[-1].uncertainty[p], 1),
            "average": round(sum(values) / len(values), 1),
            "sessions": len(values),
        }
    return out


# --- models: loaded once per file version; a missing or bad file is a reason, never a value -------

_models_lock = threading.Lock()
_cluster_cache: dict[str, Any] = {}
_twin_cache: dict[str, Any] = {}


def cluster_model_path() -> Path:
    return Path(os.environ.get("CLUSTER_MODEL_PATH") or DEFAULT_CLUSTER_MODEL)


def twin_checkpoint_path() -> Path:
    return Path(os.environ.get("TWIN_CHECKPOINT") or DEFAULT_TWIN_CHECKPOINT)


def _version(path: Path) -> tuple | None:
    try:
        st = path.stat()
    except OSError:
        return None
    return (str(path), st.st_size, st.st_mtime_ns)


def cluster_model():
    """(ClusterModel, None) or (None, reason): "no_model" when the file is missing, "invalid_model"
    when it fails BE-09's validated load, is not a 5-pillar model, or is not tagged as fitted on
    BE-07 features (`"features_source": "be07"`, written by bootstrap.save_cluster_model)."""
    path = cluster_model_path()
    version = _version(path)
    if version is None:
        return None, "no_model"
    with _models_lock:
        if _cluster_cache.get("version") == version:
            return _cluster_cache["model"], _cluster_cache["reason"]
        from clustering_engine.clustering_gmm import ClusterModel

        model, reason = None, None
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(doc, dict) or doc.get("features_source") != FEATURES_SOURCE:
                raise ValueError("the clustering model is not tagged as fitted on BE-07 features")
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always")
                model = ClusterModel.from_dict(doc)
            for w in caught:
                log.warning("clustering model: %s", w.message)
            if list(model.features) != list(PILLARS):
                raise ValueError("the served model must be fitted on the 5 pillar scores")
        except (ValueError, OSError, KeyError, TypeError) as e:
            log.warning("clustering model %s not usable (%s)", path.name, type(e).__name__)
            model, reason = None, "invalid_model"
        _cluster_cache.update(version=version, model=model, reason=reason)
        return model, reason


def twin():
    """(BrainTwin, None) or (None, reason): "no_model" (no checkpoint), "outdated_model" (saved
    before the calibrated-triangle format, BE-10), "not_installed" (no torch)."""
    path = twin_checkpoint_path()
    version = _version(path)
    if version is None:
        return None, "no_model"
    with _models_lock:
        if _twin_cache.get("version") == version:
            return _twin_cache["twin"], _twin_cache["reason"]
        loaded, reason = None, None
        try:
            from brain_twin_jepa.jepa_model import BrainTwin

            loaded = BrainTwin.load(path)
        except ImportError:
            reason = "not_installed"
        except FileNotFoundError:
            reason = "no_model"
        except ValueError:
            reason = "outdated_model"
        except Exception as e:  # a corrupt file: no forecast, the profile still answers
            log.warning("twin checkpoint %s not usable (%s)", path.name, type(e).__name__)
            reason = "invalid_model"
        _twin_cache.update(version=version, twin=loaded, reason=reason)
        return loaded, reason


def forecast_section(sessions: list[Session], h: int) -> tuple[dict | None, str | None]:
    """BE-10's forecast for the session h sessions ahead, in shadow mode (R17)."""
    model, reason = twin()
    if model is None:
        return None, reason
    from brain_twin_jepa.jepa_model import forecast, session_record

    out = forecast([session_record(s) for s in sessions], h, twin=model)  # ValueError on a bad h
    # R17: "shadow" while the twin is not validated (always, until validate.py promotes the
    # checkpoint on real users); "live" only after that.
    out["mode"] = "live" if out.get("validated") is True else "shadow"
    if out.get("status") == "ok":
        out["source"] = out["calibration"]["source"]
    return out, None


# --- collaboration ---------------------------------------------------------------------------------


def collaboration_section(key: str) -> dict:
    """BE-06's score from the stored typed turns (equal weights; see the module docstring)."""
    from ai_coach import chat_store
    from ai_coach.collaboration_scorer import CollaborationScorer
    from app.privacy.telemetry_store import LockTimeout

    try:
        rows = chat_store.read_turns(key, timeout=1.0)
    except LockTimeout:
        return {"status": "unavailable"}
    typed = [
        r["text"]
        for r in rows
        if r.get("from") == "you" and r.get("kind") == "typed" and isinstance(r.get("text"), str)
    ]
    return CollaborationScorer().score_stored_history(typed)


# --- why this: adaptation decisions as plain reasons -----------------------------------------------


def trail_reason(entry: dict) -> str | None:
    kind = entry.get("kind")
    if kind in ("harder", "easier"):
        name = EXERCISE_NAME.get(entry.get("schema", ""))
        if name is None:
            return None
        if kind == "harder":
            return f"{name} got a little harder because your recent rounds went well."
        return f"{name} got a little easier because your recent rounds were tough."
    if kind == "style" and entry.get("archetype"):
        verb = "reads as" if entry.get("first") else "now reads as"
        return f"Your practice style {verb} {entry['archetype']}."
    return None


def why_this(trail: list[dict], limit: int = TRAIL_SHOWN) -> list[dict]:
    """The newest decisions first, each {kind, reason, at}. No numbers."""
    out = []
    for entry in reversed(trail):
        reason = trail_reason(entry)
        if reason:
            out.append({"kind": entry["kind"], "reason": reason, "at": entry["at"]})
        if len(out) == limit:
            break
    return out


# --- the profile -----------------------------------------------------------------------------------


def archetype_section(state, model, model_reason: str | None) -> tuple[dict | None, str | None]:
    if model is None:
        return None, model_reason
    if state is None or not state.tasks or state.model_id != model.model_id:
        return None, "not_enough_data"
    t = state.tasks
    return {"name": t["archetype"], "confidence": round(float(t["confidence"]), 2), "model_id": t["model_id"]}, None


def build(key: str, sessions: list[Session], summaries: list[SessionSummary], state, h: int) -> dict:
    scored = [s for s in summaries if any(v is not None for v in s.pillars.values())]
    if len(scored) < PROFILE_MIN_SESSIONS:
        return {"user_id": key, "status": "not_enough_data", "sessions": len(sessions), "min_sessions": PROFILE_MIN_SESSIONS}
    model, model_reason = cluster_model()
    archetype, archetype_reason = archetype_section(state, model, model_reason)
    forecast, forecast_reason = forecast_section(sessions, h)
    return {
        "user_id": key,
        "status": "ok",
        "sessions": len(sessions),
        "min_sessions": PROFILE_MIN_SESSIONS,
        "pillars": pillar_profile(summaries),
        "archetype": archetype,
        "archetype_reason": archetype_reason,
        "forecast": forecast,
        "forecast_reason": forecast_reason,
        "collaboration": collaboration_section(key),
        "why_this": why_this(state.trail if state is not None else []),
    }


def frame_vector(scores: dict[str, float | None]) -> np.ndarray | None:
    """The 5 pillar scores in PILLARS order, or None when any is unknown (never imputed, R15)."""
    if any(scores.get(p) is None for p in PILLARS):
        return None
    return np.array([scores[p] for p in PILLARS], dtype=float)
