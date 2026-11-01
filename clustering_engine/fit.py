"""Fits the practice-profile clusters on synthetic telemetry and saves them.

    python -m clustering_engine.fit [--users 200] [--sessions 6] [--data-seed 0] [--k 9] [--seed 0]
                                    [--out models/clustering/gmm.json]

Data: data.synthetic.generate's simulated users (BE-08), one pillar vector per session.
The output directory is gitignored.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# data.synthetic.generate puts backend/ on the path, which BE-07's telemetry_io (imported by the
# pillar adapter) needs when this runs as `python -m clustering_engine.fit` from the repo root.
from data.synthetic.generate import simulate_user  # isort: skip
from clustering_engine.clustering_gmm import DEFAULT_K, DEFAULT_SEED, PILLARS, ClusterModel, fit_gmm  # noqa: E402
from clustering_engine.pillar_adapter import session_pillars  # noqa: E402

DEFAULT_OUT = Path(__file__).resolve().parents[1] / "models" / "clustering" / "gmm.json"


def synthetic_pillars(users: int, sessions: int, data_seed: int):
    events = []
    for i in range(users):
        events += simulate_user(data_seed, i, sessions)[0]
    return session_pillars(events)


def fit_synthetic(users: int, sessions: int, data_seed: int, k: int = DEFAULT_K, seed: int = DEFAULT_SEED) -> ClusterModel:
    _, X = synthetic_pillars(users, sessions, data_seed)
    return fit_gmm(X, k=k, seed=seed, features=list(PILLARS))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m clustering_engine.fit", description=__doc__.split("\n\n")[0])
    ap.add_argument("--users", type=int, default=200)
    ap.add_argument("--sessions", type=int, default=6)
    ap.add_argument("--data-seed", type=int, default=0)
    ap.add_argument("--k", type=int, default=DEFAULT_K)
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    a = ap.parse_args(argv)
    if a.users < 1 or a.sessions < 1:
        ap.error("--users and --sessions must be at least 1")
    model = fit_synthetic(a.users, a.sessions, a.data_seed, a.k, a.seed)
    path = model.save(a.out)
    print(f"k={model.k} (asked {a.k}) on {a.users} users x {a.sessions} sessions -> {path}")
    for i in range(model.k):
        print(f"  {i}: {model.name(i):<18} weight {model.weights[i]:.3f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
