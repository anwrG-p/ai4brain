"""Train the SAT-JEPA brain twin, calibrate its interval, save a checkpoint.

    python -m brain_twin_jepa.train                       # BE-08 synthetic users, in-process
    python -m data.synthetic.generate --users 1000 --sessions 14 --seed 2026 --out data/raw/synthetic
    python -m brain_twin_jepa.train --data data/raw/synthetic --source "BE-08 synthetic, seed 2026"

Sessions come from BE-07: `telemetry_io` (dedupe, sessions) and `features.session_features`, for
both the in-process users and a `--data` directory of <user_id>.jsonl (the generator's and the
telemetry store's layout). Histories may differ in length: they are padded and masked, never cut.
Users are split by user into train / calibration / test (60 / 20 / 20). The model trains on the
first split. The interval's variance model and conformal scale are fitted on the second. Its
coverage is measured on the third, which neither step saw. The checkpoint goes to
models/checkpoints/sat_jepa.pt (gitignored). Same seed and data, same weights.
The twin is in shadow mode (R17) until validate.py promotes it on real users.
"""

from __future__ import annotations

import argparse
import math
import sys
import time
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import torch

# telemetry_io imports the server's privacy store (`app`), so a CLI run from the repo root needs
# backend/ on the path (pytest and uvicorn --app-dir backend put it there already).
_BACKEND = str(Path(__file__).resolve().parents[1] / "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from brain_twin_jepa.jepa_model import (  # noqa: E402
    DEFAULT_CHECKPOINT,
    DEFAULT_LEVEL,
    H_MAX,
    MIN_SESSIONS,
    N_FEATURES,
    PILLARS,
    SATJEPA,
    BrainTwin,
    Calibration,
    session_matrix,
    session_record,
)
from brain_twin_jepa.telemetry_io import dedupe, group_sessions, read_sessions  # noqa: E402

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


def history_from_events(events: list[dict]) -> list[dict]:
    """One user's events -> session records, through BE-07 (dedupe, sessions, features)."""
    return [session_record(s) for s in group_sessions(dedupe(events))]


def synthetic_histories(users: int, sessions_per_user: int, seed: int) -> list[list[dict]]:
    """BE-08 users simulated in-process, each as a list of session records."""
    from data.synthetic.generate import simulate_user

    return [history_from_events(simulate_user(seed, i, sessions_per_user)[0]) for i in range(users)]


def directory_histories(directory: str | Path) -> list[list[dict]]:
    """Session records per user from DIR/<user_id>.jsonl, read with BE-07's `read_sessions`."""
    directory = Path(directory)
    return [[session_record(s) for s in read_sessions(p.stem, directory)] for p in sorted(directory.glob("*.jsonl"))]


def synthetic_source(users: int, sessions: int, data_seed: int) -> str:
    return f"synthetic: BE-08 generator in-process ({users} users x {sessions} sessions, data_seed {data_seed})"


def to_tensors(histories: list[list]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """x [U, T, D] (zeros after a history ends), y [U, T, 5] (NaN there), lengths [U]; T is the
    longest history. Every session of every user is kept."""
    lengths = [len(h) for h in histories]
    T = max(lengths)
    x = np.zeros((len(histories), T, N_FEATURES), dtype=np.float32)
    y = np.full((len(histories), T, len(PILLARS)), np.nan, dtype=np.float32)
    for u, h in enumerate(histories):
        if h:
            x[u, : len(h)], y[u, : len(h)] = session_matrix(h)
    return torch.from_numpy(x), torch.from_numpy(y), torch.tensor(lengths)


def split(n: int, seed: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """User indices for train / calibration / test, 60 / 20 / 20, shuffled by seed. Calibration
    holds whole users: residuals within a user are correlated, so the users, not the forecasts, are
    the sample (with 90 calibration users, held-out visual coverage came out at .74)."""
    order = np.random.default_rng(seed).permutation(n)
    a, b = int(0.6 * n), int(0.8 * n)
    return order[:a], order[a:b], order[b:]


# --- training --------------------------------------------------------------------------------------


@contextmanager
def deterministic(threads: int = 1):
    """Deterministic kernels and a pinned thread count while training; restored afterwards."""
    prev_det, prev_threads = torch.are_deterministic_algorithms_enabled(), torch.get_num_threads()
    torch.use_deterministic_algorithms(True)
    torch.set_num_threads(threads)
    try:
        yield
    finally:
        torch.use_deterministic_algorithms(prev_det)
        torch.set_num_threads(prev_threads)


def train_model(x: torch.Tensor, y: torch.Tensor, cfg: TrainConfig, lengths: torch.Tensor | None = None) -> tuple[SATJEPA, list[dict]]:
    """AdamW on the total loss, an EMA step of the target encoder after each optimiser step.
    Returns the model and the curve: mean losses over each `log_every` steps. The global torch RNG
    is left as it was (init runs under fork_rng; batches draw from their own generator)."""
    lengths = torch.full((x.shape[0],), x.shape[1]) if lengths is None else lengths
    with deterministic(), torch.random.fork_rng():
        torch.manual_seed(cfg.seed)
        model = SATJEPA(latent=cfg.latent, hidden=cfg.hidden)
        gen = torch.Generator().manual_seed(cfg.seed)
        opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=cfg.lr)
        curve, acc = [], {}
        for step in range(1, cfg.steps + 1):
            idx = torch.randint(0, x.shape[0], (min(cfg.batch, x.shape[0]),), generator=gen)
            T = int(lengths[idx].max())
            losses = model.losses(x[idx, :T], y[idx, :T], lengths[idx])
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


# --- forecasts on held-out users: residuals, interval, coverage, baseline --------------------------


@dataclass
class Forecasts:
    """Every forecast from a context of at least MIN_SESSIONS sessions whose target session exists.
    One row per (user, n, h); residuals in score points (later score minus forecast), NaN where
    the pillar has no score. `naive` is the mean-of-history forecast's residual."""

    user: np.ndarray  # [N] index into the users passed in
    n: np.ndarray  # [N] sessions in the context
    h: np.ndarray  # [N]
    twin: np.ndarray  # [N, 5]
    naive: np.ndarray  # [N, 5]

    def by_h(self) -> dict[int, np.ndarray]:
        return {int(h): self.twin[self.h == h] for h in np.unique(self.h)}


@torch.no_grad()
def forecasts(model: SATJEPA, x: torch.Tensor, y: torch.Tensor, lengths: torch.Tensor) -> Forecasts:
    sbar = model.context(x)
    users = torch.arange(x.shape[0])
    parts: list[tuple] = []
    for n in range(MIN_SESSIONS, x.shape[1]):
        naive = torch.nanmean(y[:, :n], dim=1)
        for h in range(1, H_MAX + 1):
            ok = lengths >= n + h
            if not ok.any():
                break
            pred = model.readout(model.predict(sbar[ok, n - 1], torch.full((int(ok.sum()),), n), h))
            target = y[ok, n - 1 + h]
            k = int(ok.sum())
            parts.append((users[ok].numpy(), np.full(k, n), np.full(k, h), ((target - pred) * 100).numpy(), ((target - naive[ok]) * 100).numpy()))
    if not parts:
        empty = np.zeros((0, len(PILLARS)), dtype=np.float32)
        return Forecasts(np.zeros(0, int), np.zeros(0, int), np.zeros(0, int), empty, empty)
    return Forecasts(*(np.concatenate(c) for c in zip(*parts, strict=True)))


def fit_interval(res: dict[int, np.ndarray], level: float) -> Calibration:
    """Per pillar: variance a + b·h by weighted least squares on the mean squared residual at each h
    (b floored at B_FLOOR of the mean level), then z = the split-conformal quantile of
    |r| / sqrt(a + b·h) at `level`."""
    hs = sorted(res)
    a_s, b_s, z_s = [], [], []
    for k in range(len(PILLARS)):
        rk = {h: res[h][:, k][~np.isnan(res[h][:, k])] for h in hs}
        hv = np.array([h for h in hs if len(rk[h])], dtype=float)
        if not len(hv):
            raise ValueError(f"no calibration residuals for {PILLARS[k]}")
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
    return Calibration(level=level, a=a_s, b=b_s, z=z_s, h_max=max(hs))


def calibrate(model: SATJEPA, x: torch.Tensor, y: torch.Tensor, lengths: torch.Tensor, level: float, source: str) -> Calibration:
    """fit_interval on these users' forecasts, with the calibrated range they span and the source."""
    fc = forecasts(model, x, y, lengths)
    if not len(fc.n):
        raise ValueError(f"no calibration user has more than {MIN_SESSIONS} sessions")
    cal = fit_interval(fc.by_h(), level)
    cal.source, cal.n_min, cal.n_max = source, int(fc.n.min()), int(fc.n.max())
    return cal


def coverage(cal: Calibration, res: dict[int, np.ndarray]) -> tuple[list[list[float]], list[float]]:
    """Share of residuals inside the interval: per pillar per h (1..cal.h_max; NaN with no data),
    and per pillar over every h."""
    table, overall = [], []
    for k in range(len(PILLARS)):
        row, hit, tot = [], 0, 0
        for h in range(1, cal.h_max + 1):
            r = res.get(h, np.zeros((0, len(PILLARS))))[:, k]
            r = r[~np.isnan(r)]
            inside = np.abs(r) <= cal.half_width(k, h)
            row.append(round(float(inside.mean()), 4) if len(r) else float("nan"))
            hit, tot = hit + int(inside.sum()), tot + len(r)
        table.append(row)
        overall.append(round(hit / tot, 4) if tot else float("nan"))
    return table, overall


def measure(cal: Calibration, fc: Forecasts, users: int) -> None:
    """Writes held-out coverage into `cal` (in place)."""
    cal.coverage, cal.coverage_overall = coverage(cal, fc.by_h())
    cal.held_out_users = users
    cal.held_out_residuals = int(len(fc.n))


def mae_by_h(fc: Forecasts) -> dict[str, list[float]]:
    """Mean absolute error in points per h, the twin vs the mean of the context's scores."""
    def mae(r: np.ndarray) -> float:
        r = r[~np.isnan(r)]
        return round(float(np.mean(np.abs(r))), 2) if len(r) else float("nan")

    hs = sorted(int(h) for h in np.unique(fc.h))
    return {"h": hs, "twin": [mae(fc.twin[fc.h == h]) for h in hs], "mean_of_history": [mae(fc.naive[fc.h == h]) for h in hs]}


# --- the whole run ---------------------------------------------------------------------------------


def fit(cfg: TrainConfig, histories: list[list] | None = None, source: str | None = None) -> tuple[BrainTwin, dict]:
    """Train, calibrate, measure held-out coverage. Returns the twin and a report dict. With no
    `histories`, BE-08 users are simulated from cfg; with `histories`, `source` must say whose."""
    t0 = time.perf_counter()
    if histories is None:
        histories = synthetic_histories(cfg.users, cfg.sessions, cfg.data_seed)
        source = synthetic_source(cfg.users, cfg.sessions, cfg.data_seed)
    elif not source:
        raise ValueError("histories need a source label (where the data came from)")
    histories = [h for h in histories if h]
    if not any(len(h) > MIN_SESSIONS for h in histories):
        raise ValueError(f"need users with more than {MIN_SESSIONS} sessions to calibrate")
    x, y, lengths = to_tensors(histories)
    tr, ca, te = split(x.shape[0], cfg.seed)
    t_data = time.perf_counter()
    model, curve = train_model(x[tr], y[tr], cfg, lengths[tr])
    t_train = time.perf_counter()
    cal = calibrate(model, x[ca], y[ca], lengths[ca], cfg.level, source)
    test_fc = forecasts(model, x[te], y[te], lengths[te])
    measure(cal, test_fc, len(te))
    report = {
        "config": asdict(cfg),
        "source": source,
        "users": {"train": len(tr), "calibration": len(ca), "test": len(te)},
        "sessions_per_user": {"min": int(lengths.min()), "max": int(lengths.max())},
        "curve": curve,
        "leak": [round(v, 3) for v in model.integrator.leak.tolist()],
        "mae": mae_by_h(test_fc),
        "seconds": {"data": round(t_data - t0, 1), "train": round(t_train - t_data, 1)},
    }
    meta = {"config": asdict(cfg), "users": report["users"], "source": source, "validation": {"validated": False}}
    return BrainTwin(model, cal, meta), report


def format_report(twin: BrainTwin, report: dict) -> str:
    cal = twin.calibration
    lines = [f"source: {cal.source}", "step   total    jepa     anchor   forecast"]
    for c in report["curve"]:
        lines.append(f"{c['step']:>5}  {c['total']:.5f}  {c['jepa']:.5f}  {c['anchor']:.5f}  {c['forecast']:.5f}")
    lines.append(
        f"\nheld-out coverage at nominal {cal.level:.0%} ({cal.held_out_users} test users, {cal.held_out_residuals} forecasts,"
        f" contexts {cal.n_min}..{cal.n_max} sessions; {cal.scope})"
    )
    lines.append("pillar   " + "  ".join(f"h={h}  " for h in range(1, cal.h_max + 1)) + "  all    half-width h=1..h=max")
    for k, p in enumerate(PILLARS):
        row = "  ".join(f"{v:.3f}" for v in cal.coverage[k])
        lines.append(f"{p:<8} {row}  {cal.coverage_overall[k]:.3f}  {cal.half_width(k, 1):.1f}..{cal.half_width(k, cal.h_max):.1f}")
    mae = report["mae"]
    lines.append("\nMAE (points) by h:  twin " + " ".join(map(str, mae["twin"])) + " | mean of history " + " ".join(map(str, mae["mean_of_history"])))
    lines.append(f"leak a: {report['leak']}")
    lines.append(f"seconds: {report['seconds']}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    d = TrainConfig()
    ap = argparse.ArgumentParser(prog="python -m brain_twin_jepa.train", description=__doc__.split("\n\n")[0])
    ap.add_argument("--data", type=Path, help="a directory of <user_id>.jsonl (else simulate BE-08 users in-process)")
    ap.add_argument("--source", help="where --data came from (required with --data); saved with the calibration")
    ap.add_argument("--users", type=int, default=d.users)
    ap.add_argument("--sessions", type=int, default=d.sessions)
    ap.add_argument("--data-seed", type=int, default=d.data_seed)
    ap.add_argument("--seed", type=int, default=d.seed)
    ap.add_argument("--steps", type=int, default=d.steps)
    ap.add_argument("--level", type=float, default=d.level)
    ap.add_argument("--out", type=Path, default=DEFAULT_CHECKPOINT)
    a = ap.parse_args(argv)
    if a.data and not a.source:
        ap.error("--source is required with --data")
    cfg = TrainConfig(users=a.users, sessions=a.sessions, data_seed=a.data_seed, seed=a.seed, steps=a.steps, level=a.level)
    histories = directory_histories(a.data) if a.data else None
    twin, report = fit(cfg, histories, a.source if a.data else None)
    print(format_report(twin, report))
    print(f"\ncheckpoint -> {twin.save(a.out)} (shadow mode: validated false until validate.py promotes it)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
