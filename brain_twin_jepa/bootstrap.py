"""Fit the clustering model and train the twin when they are missing (BE-11).

    python -m brain_twin_jepa.bootstrap [--force] [--cluster-users 200] [--cluster-sessions 6]

Run from the repo root, once, before the server (scripts/run_dev.ps1 and the Docker build do).
Both models are fitted on BE-08 synthetic users only (about a minute on a laptop CPU), because no
real users exist yet:
- clustering: BE-09's GMM (K = 9) on BE-07's per-session pillar scores, the same features the
  profile and the state bus compute, so a user's posteriors are computed in the units the model
  was fitted in. Saved to CLUSTER_MODEL_PATH (default models/clustering/gmm.json).
  (clustering_engine/fit.py still fits on its interim pillar adapter; the served model does not.)
- twin: BE-10's `brain_twin_jepa.train` defaults, saved to TWIN_CHECKPOINT (default
  models/checkpoints/sat_jepa.pt) with `validated: false`. It stays in shadow mode (R17) until
  `python -m brain_twin_jepa.validate` passes on real users.

A model that exists and loads is kept (unless --force). One that is missing or fails to load is
refitted. Without this step the server still runs: the profile says `archetype: null` and
`forecast: null` with a reason, and POST /v1/clustering/evaluate answers 501 (never fake values).
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

_BACKEND = str(Path(__file__).resolve().parents[1] / "backend")
if _BACKEND not in sys.path:  # telemetry_io imports the server's store (`app`)
    sys.path.insert(0, _BACKEND)

import numpy as np  # noqa: E402

from brain_twin_jepa import profile  # noqa: E402
from brain_twin_jepa.features import session_features  # noqa: E402
from brain_twin_jepa.telemetry_io import dedupe, group_sessions  # noqa: E402

CLUSTER_USERS, CLUSTER_SESSIONS, CLUSTER_DATA_SEED = 200, 6, 0


def synthetic_pillar_rows(users: int, sessions: int, data_seed: int) -> np.ndarray:
    """[n, 5] BE-07 pillar scores, one row per synthetic session that scored all five pillars."""
    from data.synthetic.generate import simulate_user

    rows = []
    for i in range(users):
        for s in group_sessions(dedupe(simulate_user(data_seed, i, sessions)[0])):
            pillars = session_features(s.events)["pillars"]
            vec = profile.frame_vector({p: pillars[p]["score"] for p in profile.PILLARS})
            if vec is not None:
                rows.append(vec)
    return np.array(rows, dtype=float).reshape(len(rows), len(profile.PILLARS))


def fit_cluster_model(users: int = CLUSTER_USERS, sessions: int = CLUSTER_SESSIONS, data_seed: int = CLUSTER_DATA_SEED):
    from clustering_engine.clustering_gmm import fit_gmm

    return fit_gmm(synthetic_pillar_rows(users, sessions, data_seed), features=list(profile.PILLARS))


def ensure_cluster_model(force: bool = False, users: int = CLUSTER_USERS, sessions: int = CLUSTER_SESSIONS) -> str:
    path = profile.cluster_model_path()
    if not force:
        model, reason = profile.cluster_model()
        if model is not None:
            return f"clustering model kept: {path} ({model.model_id})"
        if reason == "invalid_model":
            print(f"clustering model at {path} does not load; refitting")
    t = time.perf_counter()
    model = fit_cluster_model(users, sessions)
    model.save(path)
    names = ", ".join(model.name(i) for i in range(model.k))
    return f"clustering model fitted in {time.perf_counter() - t:.0f} s -> {path} ({model.model_id}): {names}"


def ensure_twin(force: bool = False) -> str:
    path = profile.twin_checkpoint_path()
    if not force:
        twin, reason = profile.twin()
        if twin is not None:
            return f"twin kept: {path}"
        if reason == "not_installed":
            return "twin skipped: torch is not installed (the profile's forecast stays null)"
        if reason != "no_model":
            print(f"twin checkpoint at {path} is {reason}; retraining")
    try:
        from brain_twin_jepa.train import TrainConfig, fit
    except ImportError:
        return "twin skipped: torch is not installed (the profile's forecast stays null)"
    t = time.perf_counter()
    twin, _ = fit(TrainConfig())
    twin.save(path)
    return f"twin trained in {time.perf_counter() - t:.0f} s -> {path} (shadow mode: validated false)"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m brain_twin_jepa.bootstrap", description=__doc__.split("\n\n")[0])
    ap.add_argument("--force", action="store_true", help="refit and retrain even if the models load")
    ap.add_argument("--cluster-users", type=int, default=CLUSTER_USERS)
    ap.add_argument("--cluster-sessions", type=int, default=CLUSTER_SESSIONS)
    ap.add_argument("--skip-twin", action="store_true", help="only the clustering model")
    a = ap.parse_args(argv)
    if a.cluster_users < 1 or a.cluster_sessions < 1:
        ap.error("--cluster-users and --cluster-sessions must be at least 1")
    print(ensure_cluster_model(a.force, a.cluster_users, a.cluster_sessions))
    if not a.skip_twin:
        print(ensure_twin(a.force))
    return 0


if __name__ == "__main__":
    sys.exit(main())
