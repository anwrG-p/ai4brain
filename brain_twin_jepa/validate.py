"""Promotion gate for the brain twin (R17): shadow mode until it earns its place on real users.

    python -m brain_twin_jepa.validate --data DIR --source "telemetry export 2026-12-01"
        [--checkpoint models/checkpoints/sat_jepa.pt] [--out PATH] [--seed 0]

DIR holds real telemetry, one <user_id>.jsonl per user (the telemetry store's layout), read with
BE-07's `read_sessions`. The trained model is kept as it is; the users are split in two, per user:
- calibration half: the interval is refitted on it (`train.calibrate` -> `fit_interval`);
- held-out half: every check below runs on it.

Every check must pass:
1. enough users: at least MIN_USERS held-out users with at least MIN_SESSIONS + H_MAX sessions;
2. calibrated: held-out coverage within COVERAGE_TOL of nominal for every pillar (pooled over h);
3. useful: per user, the mean absolute error of the mean-of-history forecast minus the twin's
   (paired, same forecasts). The mean over users is at least MARGIN_POINTS, and its 95% bootstrap
   interval (resampling users) lies above 0.

Only then does it write the refitted calibration (with `source`), and `validated: true` plus the
evidence, into the checkpoint's metadata; forecasts then say `validated: true`. Otherwise it prints
each failed check, writes nothing, and exits 1.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

from brain_twin_jepa.train import calibrate, directory_histories, forecasts, measure, to_tensors  # also puts backend/ on the path
from brain_twin_jepa.jepa_model import DEFAULT_CHECKPOINT, H_MAX, MIN_SESSIONS, PILLARS, BrainTwin, Calibration

MIN_USERS = 100
COVERAGE_TOL = 0.05
MARGIN_POINTS = 1.0
BOOTSTRAP = 2000
CI = 0.95


def evaluate(twin: BrainTwin, histories: list[list], source: str, seed: int = 0) -> tuple[dict, Calibration]:
    """The gate's evidence, and the calibration refitted on the calibration half."""
    histories = [h for h in histories if h]
    if len(histories) < 2:
        raise ValueError("need at least two users to split")
    x, y, lengths = to_tensors(histories)
    order = np.random.default_rng(seed).permutation(len(histories))
    ca, te = order[: len(order) // 2], order[len(order) // 2 :]
    cal = calibrate(twin.model, x[ca], y[ca], lengths[ca], twin.calibration.level, source)
    fc = forecasts(twin.model, x[te], y[te], lengths[te])
    measure(cal, fc, len(te))

    gains = []  # per held-out user: naive MAE - twin MAE, over the same cells
    for u in np.unique(fc.user):
        t, nv = fc.twin[fc.user == u], fc.naive[fc.user == u]
        both = ~np.isnan(t) & ~np.isnan(nv)
        if both.any():
            gains.append(float(np.abs(nv[both]).mean() - np.abs(t[both]).mean()))
    gains_a = np.array(gains)
    if len(gains_a):
        boot = gains_a[np.random.default_rng(seed).integers(0, len(gains_a), (BOOTSTRAP, len(gains_a)))].mean(axis=1)
        ci = [float(np.quantile(boot, (1 - CI) / 2)), float(np.quantile(boot, 1 - (1 - CI) / 2))]
        margin = float(gains_a.mean())
    else:
        ci, margin = [float("nan"), float("nan")], float("nan")
    evidence = {
        "source": source,
        "level": cal.level,
        "held_out_users": int(len(te)),
        "eligible_users": int((lengths[te] >= MIN_SESSIONS + H_MAX).sum()),
        "coverage": dict(zip(PILLARS, cal.coverage_overall, strict=True)),
        "coverage_scope": cal.scope,
        "margin_points": round(margin, 3),
        "margin_ci": [round(v, 3) for v in ci],
        "bootstrap_users": int(len(gains_a)),
        "thresholds": {
            "min_users": MIN_USERS,
            "min_sessions": MIN_SESSIONS + H_MAX,
            "coverage_tol": COVERAGE_TOL,
            "margin_points": MARGIN_POINTS,
            "ci": CI,
            "bootstrap": BOOTSTRAP,
        },
    }
    return evidence, cal


def failures(evidence: dict) -> list[str]:
    """Why the twin may not be promoted; [] when every check passes."""
    out = []
    if evidence["eligible_users"] < MIN_USERS:
        out.append(f"only {evidence['eligible_users']} held-out users have {MIN_SESSIONS + H_MAX}+ sessions (need {MIN_USERS})")
    for p, c in evidence["coverage"].items():
        if not abs(c - evidence["level"]) <= COVERAGE_TOL:  # also catches NaN
            out.append(f"{p} coverage {c} is not within {COVERAGE_TOL} of {evidence['level']}")
    lo = evidence["margin_ci"][0]
    if not lo > 0:
        out.append(f"the {CI:.0%} interval of the gain over the mean of history {evidence['margin_ci']} does not exclude 0")
    if not evidence["margin_points"] >= MARGIN_POINTS:
        out.append(f"margin {evidence['margin_points']} points over the mean of history is below {MARGIN_POINTS}")
    return out


def promote(twin: BrainTwin, cal: Calibration, evidence: dict, out: str | Path) -> Path:
    """The refitted calibration and `validated: true` with its evidence, saved to `out`."""
    twin.calibration = cal
    twin.meta = {**twin.meta, "source": evidence["source"], "validation": {"validated": True, **evidence}}
    return twin.save(out)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m brain_twin_jepa.validate", description=__doc__.split("\n\n")[0])
    ap.add_argument("--data", type=Path, required=True, help="a directory of real <user_id>.jsonl telemetry")
    ap.add_argument("--source", required=True, help="where --data came from; saved with the calibration")
    ap.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    ap.add_argument("--out", type=Path, help="where to write the promoted checkpoint (default: --checkpoint)")
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args(argv)
    twin = BrainTwin.load(a.checkpoint)
    evidence, cal = evaluate(twin, directory_histories(a.data), a.source, a.seed)
    print(f"held-out users {evidence['held_out_users']} (eligible {evidence['eligible_users']}), coverage {evidence['coverage']}")
    print(f"gain over the mean of history: {evidence['margin_points']} points, {CI:.0%} CI {evidence['margin_ci']}")
    reasons = failures(evidence)
    if reasons:
        print("NOT PROMOTED: the twin stays in shadow mode (validated: false). Failed checks:")
        for r in reasons:
            print(f"- {r}")
        return 1
    print(f"PROMOTED: validated true -> {promote(twin, cal, evidence, a.out or a.checkpoint)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
