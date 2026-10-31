"""Train the SAT-JEPA brain twin on BE-08 synthetic users, calibrate its interval, save a checkpoint.

    python -m brain_twin_jepa.train                       # simulate users in-process (BE-08 model)
    python -m data.synthetic.generate --users 600 --sessions 14 --seed 0 --out data/raw/synthetic
    python -m brain_twin_jepa.train --data data/raw/synthetic

Both paths run the same generator: in-process calls `simulate_user`, which is what the CLI writes.
Users are split by user into train / calibration / test (60 / 20 / 20). The model trains on the
first split. The interval's variance model and conformal scale are fitted on the second. Its
coverage is measured on the third, which neither step saw. The checkpoint goes to
models/checkpoints/sat_jepa.pt (gitignored). Same seed and data, same weights.
"""

from __future__ import annotations

import argparse
import math
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import torch

from brain_twin_jepa.jepa_model import (
    DEFAULT_CHECKPOINT,
    DEFAULT_LEVEL,
    H_MAX,
    MIN_SESSIONS,
    PILLARS,
    BrainTwin,
    Calibration,
    SATJEPA,
    session_matrix,
)
from brain_twin_jepa.session_adapter import read_jsonl_dir, sessions

# The variance's growth per session of horizon never drops below this share of its level, so the
# interval always widens with h. A judgement call: we have no evidence that a forecast six sessions
# out is as sure as one session out (R11: no ground truth for what happens between sessions).
B_FLOOR = 0.02


@dataclass(frozen=True)
class TrainConfig:
    users: int = 1000
    sessions: int = 14
    data_seed: int = 0
    seed: int = 0
    steps: int = 1500
    batch: int = 64
    lr: float = 3e-3
    latent: int = 16
    hidden: int = 64
    level: float = DEFAULT_LEVEL
    log_every: int = 100


# --- data ------------------------------------------------------------------------------------------


def synthetic_histories(users: int, sessions_per_user: int, seed: int) -> list[list]:
    """BE-08 users simulated in-process, each as a list of session records."""
    from data.synthetic.generate import simulate_user

    return [sessions(simulate_user(seed, i, sessions_per_user)[0]) for i in range(users)]


def directory_histories(directory: str | Path) -> list[list]:
    """Session records per user from DIR/<user_id>.jsonl (the generator's or the server's layout)."""
    return [sessions(events) for events in read_jsonl_dir(directory).values()]


def to_tensors(histories: list[list]) -> tuple[torch.Tensor, torch.Tensor]:
    """x [U, T, D], y [U, T, 5]; users are cut to the shortest history so they stack."""
    T = min(len(h) for h in histories)
    xs, ys = zip(*(session_matrix(h[:T]) for h in histories), strict=True)
    return torch.from_numpy(np.stack(xs)), torch.from_numpy(np.stack(ys))


def split(n: int, seed: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """User indices for train / calibration / test, 60 / 20 / 20, shuffled by seed. Calibration
    holds whole users: residuals within a user are correlated, so the users, not the forecasts, are
    the sample (with 90 calibration users, held-out visual coverage came out at .74)."""
    order = np.random.default_rng(seed).permutation(n)
    a, b = int(0.6 * n), int(0.8 * n)
    return order[:a], order[a:b], order[b:]


# --- training --------------------------------------------------------------------------------------


def train_model(x: torch.Tensor, y: torch.Tensor, cfg: TrainConfig) -> tuple[SATJEPA, list[dict]]:
    """AdamW on the total loss, an EMA step of the target encoder after each optimiser step.
    Returns the model and the curve: mean losses over each `log_every` steps."""
    torch.manual_seed(cfg.seed)
    gen = torch.Generator().manual_seed(cfg.seed)
    model = SATJEPA(latent=cfg.latent, hidden=cfg.hidden)
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=cfg.lr)
    curve, acc = [], {}
    for step in range(1, cfg.steps + 1):
        idx = torch.randint(0, x.shape[0], (min(cfg.batch, x.shape[0]),), generator=gen)
        losses = model.losses(x[idx], y[idx])
        opt.zero_grad()
        losses["total"].backward()
        opt.step()
        model.ema_update()
        for k, v in losses.items():
            acc[k] = acc.get(k, 0.0) + v.item()
        if step % cfg.log_every == 0 or step == cfg.steps:
            n = step - (curve[-1]["step"] if curve else 0)
            curve.append({"step": step, **{k: v / n for k, v in acc.items()}})
            acc = {}
    return model.eval(), curve


# --- interval: residuals, variance model, conformal scale, coverage --------------------------------


@torch.no_grad()
def residuals(model: SATJEPA, x: torch.Tensor, y: torch.Tensor) -> dict[int, np.ndarray]:
    """{h: residuals [N, 5] in score points (NaN where no score)}: for every context of at least
    MIN_SESSIONS sessions, the score h sessions later minus the forecast."""
    sbar = model.context(x)
    T = x.shape[1]
    out: dict[int, list] = {h: [] for h in range(1, H_MAX + 1)}
    for n in range(MIN_SESSIONS, T):
        for h in range(1, min(H_MAX, T - n) + 1):
            pred = model.readout(model.predict(sbar[:, n - 1], torch.full((x.shape[0],), n), h))
            out[h].append(((y[:, n - 1 + h] - pred) * 100).numpy())
    return {h: np.concatenate(v) for h, v in out.items() if v}


def fit_interval(res: dict[int, np.ndarray], level: float) -> Calibration:
    """Per pillar: variance a + b·h by weighted least squares on the mean squared residual at each h
    (b floored at B_FLOOR of the mean level), then z = the split-conformal quantile of
    |r| / sqrt(a + b·h) at `level`."""
    hs = sorted(res)
    a_s, b_s, z_s = [], [], []
    for k in range(len(PILLARS)):
        rk = {h: res[h][:, k][~np.isnan(res[h][:, k])] for h in hs}
        hv = np.array([h for h in hs if len(rk[h])], dtype=float)
        v = np.array([np.mean(rk[int(h)] ** 2) for h in hv])
        w = np.array([len(rk[int(h)]) for h in hv], dtype=float)
        if len(hv) > 1:
            hm, vm = np.average(hv, weights=w), np.average(v, weights=w)
            b = np.average((hv - hm) * (v - vm), weights=w) / np.average((hv - hm) ** 2, weights=w)
        else:
            vm, b = float(v[0]), 0.0
        b = max(b, B_FLOOR * vm)
        a = max(np.average(v - b * hv, weights=w), 1e-6)
        scaled = np.sort(np.concatenate([np.abs(rk[int(h)]) / math.sqrt(a + b * h) for h in hv]))
        q = min(len(scaled), math.ceil((len(scaled) + 1) * level))
        a_s.append(float(a)), b_s.append(float(b)), z_s.append(float(scaled[q - 1]))
    return Calibration(level=level, a=a_s, b=b_s, z=z_s)


def coverage(cal: Calibration, res: dict[int, np.ndarray]) -> tuple[list[list[float]], list[float]]:
    """Share of residuals inside the interval: per pillar per h, and per pillar over every h."""
    table, overall = [], []
    for k in range(len(PILLARS)):
        row, hit, tot = [], 0, 0
        for h in range(1, H_MAX + 1):
            r = res[h][:, k]
            r = r[~np.isnan(r)]
            inside = np.abs(r) <= cal.half_width(k, h)
            row.append(round(float(inside.mean()), 4) if len(r) else float("nan"))
            hit, tot = hit + int(inside.sum()), tot + len(r)
        table.append(row)
        overall.append(round(hit / tot, 4))
    return table, overall


@torch.no_grad()
def baseline_mae(model: SATJEPA, x: torch.Tensor, y: torch.Tensor) -> dict[str, list[float]]:
    """Mean absolute error in points per h: the twin vs the mean of the context's scores (a naive
    forecast). Same contexts as `residuals`."""
    model_res = residuals(model, x, y)
    naive: dict[int, list] = {h: [] for h in model_res}
    T = x.shape[1]
    for n in range(MIN_SESSIONS, T):
        m = torch.nanmean(y[:, :n], dim=1)
        for h in range(1, min(H_MAX, T - n) + 1):
            naive[h].append(((y[:, n - 1 + h] - m) * 100).numpy())
    mae = lambda r: float(np.nanmean(np.abs(r)))  # noqa: E731
    return {
        "twin": [round(mae(model_res[h]), 2) for h in sorted(model_res)],
        "mean_of_history": [round(mae(np.concatenate(naive[h])), 2) for h in sorted(naive)],
    }


# --- the whole run ---------------------------------------------------------------------------------


def fit(cfg: TrainConfig, histories: list[list] | None = None) -> tuple[BrainTwin, dict]:
    """Train, calibrate, measure held-out coverage. Returns the twin and a report dict."""
    t0 = time.perf_counter()
    if histories is None:
        histories = synthetic_histories(cfg.users, cfg.sessions, cfg.data_seed)
    x, y = to_tensors(histories)
    if x.shape[1] < MIN_SESSIONS + H_MAX:
        raise ValueError(f"need at least {MIN_SESSIONS + H_MAX} sessions per user to calibrate h = 1..{H_MAX}")
    tr, ca, te = split(x.shape[0], cfg.seed)
    t_data = time.perf_counter()
    model, curve = train_model(x[tr], y[tr], cfg)
    t_train = time.perf_counter()
    cal = fit_interval(residuals(model, x[ca], y[ca]), cfg.level)
    test_res = residuals(model, x[te], y[te])
    cal.coverage, cal.coverage_overall = coverage(cal, test_res)
    cal.held_out_users = len(te)
    cal.held_out_residuals = int(sum(len(r) for r in test_res.values()))
    report = {
        "config": asdict(cfg),
        "users": {"train": len(tr), "calibration": len(ca), "test": len(te)},
        "sessions_per_user": int(x.shape[1]),
        "curve": curve,
        "leak": [round(v, 3) for v in model.integrator.leak.tolist()],
        "mae": baseline_mae(model, x[te], y[te]),
        "seconds": {"data": round(t_data - t0, 1), "train": round(t_train - t_data, 1)},
    }
    meta = {"config": asdict(cfg), "users": report["users"], "data": "BE-08 synthetic"}
    return BrainTwin(model, cal, meta), report


def format_report(twin: BrainTwin, report: dict) -> str:
    cal = twin.calibration
    lines = ["step   total    jepa     anchor   forecast"]
    for c in report["curve"]:
        lines.append(f"{c['step']:>5}  {c['total']:.5f}  {c['jepa']:.5f}  {c['anchor']:.5f}  {c['forecast']:.5f}")
    lines.append(f"\nheld-out coverage at nominal {cal.level:.0%} ({cal.held_out_users} test users, {cal.held_out_residuals} forecasts)")
    lines.append("pillar   " + "  ".join(f"h={h}  " for h in range(1, H_MAX + 1)) + "  all    half-width h=1..h=6")
    for k, p in enumerate(PILLARS):
        row = "  ".join(f"{v:.3f}" for v in cal.coverage[k])
        lines.append(f"{p:<8} {row}  {cal.coverage_overall[k]:.3f}  {cal.half_width(k, 1):.1f}..{cal.half_width(k, H_MAX):.1f}")
    mae = report["mae"]
    lines.append("\nMAE (points) by h:  twin " + " ".join(map(str, mae["twin"])) + " | mean of history " + " ".join(map(str, mae["mean_of_history"])))
    lines.append(f"leak a: {report['leak']}")
    lines.append(f"seconds: {report['seconds']}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    d = TrainConfig()
    ap = argparse.ArgumentParser(prog="python -m brain_twin_jepa.train", description=__doc__.split("\n\n")[0])
    ap.add_argument("--data", type=Path, help="a directory of <user_id>.jsonl (else simulate in-process)")
    ap.add_argument("--users", type=int, default=d.users)
    ap.add_argument("--sessions", type=int, default=d.sessions)
    ap.add_argument("--data-seed", type=int, default=d.data_seed)
    ap.add_argument("--seed", type=int, default=d.seed)
    ap.add_argument("--steps", type=int, default=d.steps)
    ap.add_argument("--level", type=float, default=d.level)
    ap.add_argument("--out", type=Path, default=DEFAULT_CHECKPOINT)
    a = ap.parse_args(argv)
    cfg = TrainConfig(users=a.users, sessions=a.sessions, data_seed=a.data_seed, seed=a.seed, steps=a.steps, level=a.level)
    histories = directory_histories(a.data) if a.data else None
    twin, report = fit(cfg, histories)
    print(format_report(twin, report))
    print(f"\ncheckpoint -> {twin.save(a.out)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
