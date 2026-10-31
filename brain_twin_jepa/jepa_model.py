"""SAT-JEPA brain twin (Member 3, README "Soft-Anchored Temporal JEPA"; ticket BE-10).

One step is one SESSION. Each session is a feature vector x_t (`session_matrix`):
- the 5 pillar scores (0-100 scaled to 0-1; 0 when missing);
- the 5 pillar coverages (0-1), which also mark the missing scores;
- the gap since the previous session, log1p(days) / log1p(28);
- time of day, sin and cos of the start hour.

The parts:
- context encoder f_θ: an MLP over one session, e_t = f_θ(x_t).
- leaky integrator: s̄_t = a ⊙ s̄_{t-1} + (1 - a) ⊙ e_t, with a learned leak a per latent unit. It
  separates the slow trend from one session's noise (state, time of day, a careless session).
  It steps per session, never per idle day: there is no ground truth for decay while idle (R11),
  so days off do not move the state.
- target encoder f_θ̄: the same MLP, an EMA of f_θ with τ = 0.996, no gradients.
  OQ-7 is settled here: τ = 0.996 is the EMA's (README); the integrator's leak is learned.
- predictor g_φ(s̄_t, n, h): predicts the target latent f_θ̄(x_{t+h}) of the session h steps ahead,
  given the n sessions seen. n lets it learn the practice curve, which plateaus around the 3rd
  session (Scharfen et al. 2018, docs/research area 1).
- readout: the "soft anchor". A linear map from the latent to the 5 pillar scores, trained on f_θ's
  latents. It keeps the latent tied to what we measure (and away from the collapsed constant a
  JEPA can fall into), and it turns a predicted latent into a per-pillar forecast.

The loss is the JEPA latent loss, plus the anchor loss on f_θ(x_t), plus the readout of g_φ's
prediction against the pillar scores h sessions later.

Forecasts (`BrainTwin.forecast`) are about scores ON THESE EXERCISES: practice improves the
exercises, nothing more (research area 3). The interval comes from residuals on held-out synthetic
users (train.py `fit_interval`). Its variance is a + b·h per pillar, with b > 0, so the range widens
with the horizon. Then a split-conformal scale sets its coverage. The coverage measured on other
held-out users ships with every forecast as evidence. It is evidence about synthetic data, not
real users, and the forecast says so.
"""

from __future__ import annotations

import copy
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn

PILLARS = ("focus", "agility", "impulse", "memory", "visual")
N_PILLARS = len(PILLARS)
N_FEATURES = 2 * N_PILLARS + 3  # scores, coverages, gap, tod sin, tod cos
GAP_SCALE_DAYS = 28.0

EMA_TAU = 0.996
MIN_SESSIONS = 3  # R11: the projection starts at session 3
H_MAX = 6  # the furthest horizon (in sessions) the interval is calibrated for
DEFAULT_LEVEL = 0.8
# The latent term is a ratio near 1 at start, the score terms are squared errors on a 0-1 scale
# near .05; at weight 1 the latent term crowds out the forecast (MAE 16.6 vs 15.4 points, 600 users, 1500 steps).
JEPA_WEIGHT = 0.1
DEFAULT_CHECKPOINT = Path(__file__).resolve().parents[1] / "models" / "checkpoints" / "sat_jepa.pt"


# --- features --------------------------------------------------------------------------------------


def _get(record: Any, key: str) -> Any:
    return record[key] if isinstance(record, Mapping) else getattr(record, key)


def session_matrix(history: Sequence[Any]) -> tuple[np.ndarray, np.ndarray]:
    """(x [T, N_FEATURES], y [T, 5]) for sessions in time order. y is the pillar score / 100, NaN
    where the pillar has no score. A record has `started_at` (aware datetime), `pillars`
    ({pillar: 0-100 or None}) and `coverage` ({pillar: 0-1}), as attributes or keys."""
    x = np.zeros((len(history), N_FEATURES), dtype=np.float32)
    y = np.full((len(history), N_PILLARS), np.nan, dtype=np.float32)
    prev: datetime | None = None
    for t, r in enumerate(history):
        started = _get(r, "started_at")
        pillars, coverage = _get(r, "pillars"), _get(r, "coverage")
        for k, p in enumerate(PILLARS):
            score = pillars.get(p)
            if score is not None:
                y[t, k] = score / 100.0
                x[t, k] = score / 100.0
            x[t, N_PILLARS + k] = float(coverage.get(p, 0.0))
        gap_days = 0.0 if prev is None else max(0.0, (started - prev).total_seconds() / 86400)
        hour = started.hour + started.minute / 60  # ponytail: UTC hour, as the generator; no tz yet
        x[t, 2 * N_PILLARS] = math.log1p(gap_days) / math.log1p(GAP_SCALE_DAYS)
        x[t, 2 * N_PILLARS + 1] = math.sin(2 * math.pi * hour / 24)
        x[t, 2 * N_PILLARS + 2] = math.cos(2 * math.pi * hour / 24)
        prev = started
    return x, y


def step_features(n: torch.Tensor, h: int) -> torch.Tensor:
    """What g_φ knows about where it stands: horizon and how many sessions were seen. [..., 4]"""
    n = n.to(torch.float32)
    return torch.stack(
        [torch.full_like(n, h / H_MAX), 1 / n, 1 / (n + h), torch.log1p(n) / math.log1p(30)], dim=-1
    )


# --- the network -----------------------------------------------------------------------------------


def _mlp(i: int, hidden: int, o: int) -> nn.Sequential:
    return nn.Sequential(nn.Linear(i, hidden), nn.GELU(), nn.Linear(hidden, hidden), nn.GELU(), nn.Linear(hidden, o))


class LeakyIntegrator(nn.Module):
    """s̄_t = a ⊙ s̄_{t-1} + (1 - a) ⊙ e_t, s̄_1 = e_1; a = sigmoid(logit), one per latent unit.
    Causal: s̄_t depends on sessions 1..t only."""

    def __init__(self, dim: int, leak: float = 0.7):
        super().__init__()
        self.logit = nn.Parameter(torch.full((dim,), math.log(leak / (1 - leak))))

    @property
    def leak(self) -> torch.Tensor:
        return torch.sigmoid(self.logit)

    def forward(self, e: torch.Tensor) -> torch.Tensor:  # [B, T, L] -> [B, T, L]
        a = self.leak
        out, s = [], e[:, 0]
        out.append(s)
        for t in range(1, e.shape[1]):
            s = a * s + (1 - a) * e[:, t]
            out.append(s)
        return torch.stack(out, dim=1)


class SATJEPA(nn.Module):
    def __init__(self, latent: int = 16, hidden: int = 64, tau: float = EMA_TAU, leak: float = 0.7):
        super().__init__()
        self.config = {"latent": latent, "hidden": hidden, "tau": tau, "leak": leak}
        self.tau = tau
        self.context_encoder = _mlp(N_FEATURES, hidden, latent)  # f_θ
        self.target_encoder = copy.deepcopy(self.context_encoder)  # f_θ̄
        for p in self.target_encoder.parameters():
            p.requires_grad_(False)
        self.integrator = LeakyIntegrator(latent, leak)
        self.predictor = _mlp(latent + 4, hidden, latent)  # g_φ
        self.readout = nn.Linear(latent, N_PILLARS)  # the soft anchor

    @torch.no_grad()
    def ema_update(self) -> None:
        """θ̄ <- τ θ̄ + (1 - τ) θ."""
        for tgt, src in zip(self.target_encoder.parameters(), self.context_encoder.parameters(), strict=True):
            tgt.copy_(self.tau * tgt + (1 - self.tau) * src)

    def context(self, x: torch.Tensor) -> torch.Tensor:
        """s̄ for every prefix: s̄[:, t] summarises sessions 0..t. [B, T, D] -> [B, T, L]"""
        return self.integrator(self.context_encoder(x))

    def predict(self, sbar: torch.Tensor, n: torch.Tensor, h: int) -> torch.Tensor:
        """ẑ_{t+h} = g_φ(s̄_t, n, h); n = sessions seen (t + 1)."""
        return self.predictor(torch.cat([sbar, step_features(n, h)], dim=-1))

    def forecast_scores(self, x: torch.Tensor, h: int) -> torch.Tensor:
        """Pillar scores / 100, h sessions after the last of x [B, T, D]. -> [B, 5]"""
        sbar = self.context(x)[:, -1]
        n = torch.full(sbar.shape[:1], x.shape[1], dtype=torch.float32)
        return self.readout(self.predict(sbar, n, h))

    def losses(self, x: torch.Tensor, y: torch.Tensor) -> dict[str, torch.Tensor]:
        """x [B, T, D], y [B, T, 5] (NaN = no score). Every (t, h) with t + h < T and h <= H_MAX."""
        mask = ~torch.isnan(y)
        y0 = torch.nan_to_num(y)
        e = self.context_encoder(x)
        sbar = self.integrator(e)
        with torch.no_grad():
            z = self.target_encoder(x)
        anchor = _masked_mse(self.readout(e), y0, mask)
        # The latent error relative to the target's spread: scale-free, so the term cannot drop by
        # shrinking the latent, and it reads the same while the EMA target's scale drifts.
        spread = z.flatten(0, 1).var(dim=0).mean().clamp(min=1e-6)
        jepa, fc = [], []
        T = x.shape[1]
        for h in range(1, min(H_MAX, T - 1) + 1):
            n = torch.arange(1, T - h + 1).expand(x.shape[0], -1)
            zhat = self.predict(sbar[:, : T - h], n, h)
            jepa.append(((zhat - z[:, h:]) ** 2).mean() / spread)
            fc.append(_masked_mse(self.readout(zhat), y0[:, h:], mask[:, h:]))
        out = {"jepa": torch.stack(jepa).mean(), "anchor": anchor, "forecast": torch.stack(fc).mean()}
        out["total"] = JEPA_WEIGHT * out["jepa"] + out["anchor"] + out["forecast"]
        return out


def _masked_mse(pred: torch.Tensor, target: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
    m = mask.to(pred.dtype)
    return (((pred - target) ** 2) * m).sum() / m.sum().clamp(min=1)


# --- the twin: model + calibrated interval ---------------------------------------------------------


@dataclass
class Calibration:
    """Interval half-width for pillar p at horizon h, in score points: z[p] * sqrt(a[p] + b[p] * h).
    `coverage[p][h-1]` is the share of held-out users' later scores the interval covered."""

    level: float
    a: list[float]
    b: list[float]
    z: list[float]
    coverage: list[list[float]] = field(default_factory=list)
    coverage_overall: list[float] = field(default_factory=list)
    held_out_users: int = 0
    held_out_residuals: int = 0

    def half_width(self, k: int, h: int) -> float:
        return self.z[k] * math.sqrt(self.a[k] + self.b[k] * h)


class BrainTwin:
    def __init__(self, model: SATJEPA, calibration: Calibration, meta: dict | None = None):
        self.model = model.eval()
        self.calibration = calibration
        self.meta = meta or {}

    def forecast(self, history: Sequence[Any], h: int) -> dict:
        """Per-pillar mean and interval for the session h sessions after the last one in `history`
        (records in time order; see `session_matrix`). Fewer than MIN_SESSIONS sessions ->
        {"status": "not_enough_data"} (R11, R15). A pillar with no score anywhere in the history
        gets None: there is nothing to project."""
        early = _not_enough_data(history, h)
        if early:
            return early
        x, y = session_matrix(history)
        with torch.no_grad():
            mean = self.model.forecast_scores(torch.from_numpy(x)[None], h)[0].numpy() * 100
        cal = self.calibration
        pillars: dict[str, dict | None] = {}
        for k, p in enumerate(PILLARS):
            if np.isnan(y[:, k]).all():
                pillars[p] = None
                continue
            m = float(np.clip(mean[k], 0, 100))
            w = cal.half_width(k, h)
            # low/high are clipped to the 0-100 scale, so near an end the band can narrow as h grows;
            # half_width is the unclipped ± and always grows with h.
            pillars[p] = {
                "mean": round(m, 1),
                "low": round(max(0.0, m - w), 1),
                "high": round(min(100.0, m + w), 1),
                "half_width": round(w, 2),
            }
        return {
            "status": "ok",
            "h": h,
            "sessions": len(history),
            "level": cal.level,
            "pillars": pillars,
            "calibration": {
                "data": "synthetic users (BE-08 generator), not real users",
                "held_out_users": cal.held_out_users,
                "coverage_at_h": {p: cal.coverage[k][h - 1] for k, p in enumerate(PILLARS)} if cal.coverage else None,
                "coverage": dict(zip(PILLARS, cal.coverage_overall, strict=True)) if cal.coverage_overall else None,
            },
        }

    def save(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(
            {"config": self.model.config, "state_dict": self.model.state_dict(), "calibration": vars(self.calibration), "meta": self.meta},
            path,
        )
        return path

    @classmethod
    def load(cls, path: str | Path = DEFAULT_CHECKPOINT) -> BrainTwin:
        ckpt = torch.load(path, map_location="cpu", weights_only=True)
        model = SATJEPA(**ckpt["config"])
        model.load_state_dict(ckpt["state_dict"])
        return cls(model, Calibration(**ckpt["calibration"]), ckpt.get("meta"))


def _not_enough_data(history: Sequence[Any], h: int) -> dict | None:
    """ValueError for a horizon outside 1..H_MAX; the not_enough_data answer below MIN_SESSIONS."""
    if not isinstance(h, int) or isinstance(h, bool) or not 1 <= h <= H_MAX:
        raise ValueError(f"h must be an integer from 1 to {H_MAX} sessions (the calibrated range)")
    if len(history) < MIN_SESSIONS:
        return {"status": "not_enough_data", "sessions": len(history), "min_sessions": MIN_SESSIONS}
    return None


_default: BrainTwin | None = None


def forecast(history: Sequence[Any], h: int, twin: BrainTwin | None = None) -> dict:
    """`BrainTwin.forecast` on `twin`, or on the checkpoint at DEFAULT_CHECKPOINT (loaded once).
    The not-enough-data answer needs no model. With no checkpoint this raises FileNotFoundError:
    train one with `python -m brain_twin_jepa.train`."""
    global _default
    early = _not_enough_data(history, h)
    if early:
        return early
    if twin is None:
        if _default is None:
            _default = BrainTwin.load(DEFAULT_CHECKPOINT)
        twin = _default
    return twin.forecast(history, h)
