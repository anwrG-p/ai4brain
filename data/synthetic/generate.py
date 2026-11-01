"""Synthetic telemetry: simulated users playing the eleven exercises over many sessions (BE-08).

    python -m data.synthetic.generate --users N --sessions M --seed S --out DIR

Output, in the layout POST /v1/telemetry/event writes (backend/app/api/routes/v1_telemetry.py):
- DIR/<user_id>.jsonl: one TelemetryEvent per line (validated by that model, dumped by it) plus
  `received_at`. Files are rewritten, not appended, so a seed always gives the same bytes.
- DIR/_truth/<user_id>.json: the ground truth behind the user (abilities, practice level, session
  flags). It sits outside the ingest glob (*.jsonl) so nothing reads it as telemetry.

The model. Sources are docs/research/2026-10-31-improvement-opportunities.md areas 1-3 unless
noted. Evidence marks follow that doc: H primary/meta-analysis, M single study, J judgement,
⚠ cited from memory.
- Latent ability: one z-score per pillar (focus, agility, impulse, memory, visual), sharing a
  general factor with correlation `ability_corr` (the positive manifold; the value is J).
- Practice: a retest gain that rises over sessions and stops after the 3rd one (Scharfen et al.
  2018, 122 studies: "no further gain after the 3rd administration", H). The level after n sessions
  is 1 - exp(-n / practice_tau); tau = 2/3 puts 95% of the gain at the 3rd session. The size,
  `practice_gain` in ability SDs, is J.
- Forgetting: `forgetting_per_day` shrinks the practice gain (never the ability) between sessions.
  Scharfen 2018 finds retest gains depend on the retest interval but gives no rate, so it defaults
  to 0. Idle days do not lower ability: R11 dropped the "decay if idle" line, which has no source.
- Reliability: trial-level noise everywhere (binomial accuracy, ex-Gaussian RTs). The Stroop RT
  cost, a difference score, gets its between-person spread solved from `stroop_cost_reliability`
  so its retest reliability lands near .6 (Hedge et al. 2018, via area 1, H).
- Low effort: a share `low_effort_rate` of sessions has fast RTs, chance accuracy and timeouts.
  The default .07 is the share Zorowitz et al. 2023 flagged on chance accuracy alone (H). It is a
  lower bound: that screen missed careless responders, so the true share is likely higher.
- Time of day: performance drops by up to `tod_amplitude` SD away from a personal peak hour
  (synchrony effect; Schmidt et al. 2007, Cogn Neuropsychol ⚠; the size is J).
- Schedule: at most one session a day, about `sessions_per_week` a week, so days get skipped
  (3/week: in Lampit et al. 2014, more than 3 sessions a week was not more effective in healthy
  older adults, H. That finding is about efficacy, not adherence; the schedule just uses it.)
- Day-to-day state: a session-wide shift of `state_sd` SD (J).
- N-back follows R16 (scoring follows the hint): two events per trial, one per stream, as
  NBack.tsx logs them. The rule-stream event carries the trial's verdict, so a press of the
  off-rule key makes it wrong (a false alarm on a noise trial, a miss on a target). The off-rule
  event is `lure_stream` when that stream matched n back (`lure_stream_rate`, J), else `standard`;
  its error means its key was pressed. Withholding that press is an impulse-control skill.
- Stop Light, Arrow Focus and Pair Finder (F-B) run shortened blocks so a session stays near
  its old size: 64 Stop Light trials (16 stops, 2 per 8, an SSD staircase from 250 ms in 50 ms
  steps), 32 Arrow Focus trials (8 per cell) and the full Pair Finder 2-4-6-8 series.
  - Stop Light is a race (the independent race model behind the integration SSRT, Logan &
    Cowan 1984): a stop trial is answered when the go RT beats SSD + the user's SSRT. The true
    SSRT (`ssrt_ms` in the truth file) depends on impulse ability and practice only (J sizes).
  - Arrow Focus adds a conflict cost to incongruent RTs, set by agility ability and practice
    (`flanker_cost_ms` in the truth file; J sizes).
  - Pair Finder: P(right box) falls with the stage size and rises with each retry (J); a stage
    failed on its last attempt ends the task, so later stages are never reached.

ponytail: no device or input-kind context, no voice, hours treated as UTC; n-back rules are
position and symbol only (no parity), and the shortened blocks above are not the served lengths.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

# The server's package root, so `python -m data.synthetic.generate` from the repo root finds `app`
# (pytest and uvicorn --app-dir backend put it there already).
_BACKEND = str(Path(__file__).resolve().parents[2] / "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

# The only coupling to the server: its event model. Tests import it from here too, so moving the
# model is a change to this one line.
from app.api.routes.v1_telemetry import TelemetryEvent  # noqa: E402

PILLARS = ("focus", "agility", "impulse", "memory", "visual")

# Stroop block (fixtures.json: 4 inks, 3000 ms). Trials per condition and the per-trial RT noise
# set how noisy one session's cost is; the cost's between-person spread is solved from them.
STROOP_PER_CONDITION = 24
STROOP_SIGMA_MS = 80.0
STROOP_TAU_MS = 80.0
STROOP_EXPECTED_ACCURACY = 0.9  # rough share of correct trials, which are the ones the cost uses
STROOP_COST_MS = 110.0  # cost at ability 0 (J)
STROOP_COST_FLOOR_MS = 15.0

LOW_EFFORT_TIMEOUT = 0.25  # share of timed trials a low-effort session lets run out (J)

# Stop Light: SSRT at ability 0 and its spread per ability SD (J: typical healthy-adult SSRTs
# are about 200-250 ms, Verbruggen et al. 2019), go RTs as the fixture's 1250 ms window allows.
SSRT_MS = 230.0
SSRT_SLOPE_MS = 25.0
SSRT_FLOOR_MS = 120.0
SSRT_TRIAL_SD_MS = 20.0  # trial-to-trial jitter of the stop process
# Arrow Focus: the flanker cost at ability 0 and per ability SD (J; ANT conflict effects are
# around 80-100 ms, Fan et al. 2002).
FLANKER_COST_MS = 90.0
FLANKER_COST_SLOPE_MS = 25.0
FLANKER_COST_FLOOR_MS = 10.0


@dataclass(frozen=True)
class Params:
    ability_corr: float = 0.3
    practice_gain: float = 0.4
    practice_gain_sd: float = 0.1
    practice_tau: float = 2 / 3
    forgetting_per_day: float = 0.0
    state_sd: float = 0.25
    tod_amplitude: float = 0.2
    low_effort_rate: float = 0.07
    sessions_per_week: float = 3.0
    stroop_cost_reliability: float = 0.6
    start: date = date(2026, 1, 5)

    def __post_init__(self):
        checks = {
            "ability_corr": 0 <= self.ability_corr < 1,
            "practice_tau": self.practice_tau > 0,
            "forgetting_per_day": self.forgetting_per_day >= 0,
            "low_effort_rate": 0 <= self.low_effort_rate <= 1,
            "sessions_per_week": 0 < self.sessions_per_week <= 7,
            "stroop_cost_reliability": 0 < self.stroop_cost_reliability < 1,
        }
        bad = [k for k, ok in checks.items() if not ok]
        if bad:
            raise ValueError(f"out of range: {', '.join(bad)}")


def stroop_cost_slope(p: Params) -> float:
    """ms of Stroop cost per ability SD, so that retest reliability = signal / (signal + noise).
    Noise: the variance of a difference of two condition means over the correct trials."""
    n = STROOP_PER_CONDITION * STROOP_EXPECTED_ACCURACY
    noise = (STROOP_SIGMA_MS**2 + STROOP_TAU_MS**2) * 2 / n
    between = 1 + p.practice_gain_sd**2
    r = p.stroop_cost_reliability
    return math.sqrt(r * noise / ((1 - r) * between))


def _p(theta: float, difficulty: float, chance: float, slope: float = 1.2) -> float:
    """P(correct): chance plus a logistic in ability minus item difficulty."""
    return chance + (1 - chance) / (1 + math.exp(-slope * (theta - difficulty)))


def _rt(rng: random.Random, mean_ms: float, theta: float, sigma: float | None = None, tau: float | None = None) -> float:
    """Ex-Gaussian RT with mean `mean_ms` at ability 0, faster with ability."""
    m = mean_ms * math.exp(-0.1 * theta)
    sigma = 0.12 * mean_ms if sigma is None else sigma
    tau = 0.15 * mean_ms if tau is None else tau
    return max(150.0, m - tau + rng.gauss(0, sigma) + rng.expovariate(1 / tau))


def _iso_ms(t: datetime) -> str:
    """client_ts as the browser's Date.toISOString writes it."""
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}Z"


class _Session:
    def __init__(self, rng, user_id, session_id, index, start, theta, low, stroop_cost, ssrt=SSRT_MS, flanker_cost=FLANKER_COST_MS):
        self.rng = rng
        self.user_id = user_id
        self.session_id = session_id
        self.index = index
        self.clock = start
        self.theta = theta
        self.low = low
        self.stroop_cost = stroop_cost
        self.ssrt = ssrt
        self.flanker_cost = flanker_cost
        self.events: list[dict] = []

    def lazy(self, limit_ms: float | None) -> float | None:
        """A low-effort answer: None when the trial runs out, else a fast RT."""
        if limit_ms is not None and self.rng.random() < LOW_EFFORT_TIMEOUT:
            return None
        return self.rng.uniform(150, 400)

    def block(self, schema: str, number: int, dimension: str) -> _Block:
        self.clock += timedelta(seconds=self.rng.uniform(10, 40))
        return _Block(self, f"syn-{schema}-{self.index:03d}-{number}", dimension)


class _Block:
    """One task_id; mirrors the frontend TrialRecorder (error_burst runs within it)."""

    def __init__(self, session: _Session, task_id: str, dimension: str):
        self.s = session
        self.task_id = task_id
        self.dimension = dimension
        self.burst = 0
        self.trials = 0

    def emit(
        self,
        correct: bool,
        rt_ms: float,
        *,
        score: float | None = None,
        first_press_ms: float | None = -1.0,
        meta: dict | None = None,
        closes_trial: bool = True,
    ) -> None:
        """`first_press_ms` -1 means "the response itself"; None means no key or pointer press.
        `closes_trial` False: another event of the same trial follows (n-back's other stream), so
        the trial index, the error burst and the clock stay put."""
        s = self.s
        rng = s.rng
        rt = round(min(600_000.0, max(0.0, rt_ms)), 1)
        press = rt if first_press_ms == -1.0 else first_press_ms
        if closes_trial:
            self.burst = 0 if correct else self.burst + 1
        # Pointer answers add moves, so jitter (std of input gaps) is non-zero; a single key gives 0.
        jitter = round(rng.lognormvariate(math.log(40), 0.5), 1) if press is not None and rng.random() < 0.35 else 0.0
        if closes_trial:
            s.clock += timedelta(milliseconds=rt)
        s.events.append(
            {
                "user_id": s.user_id,
                "session_id": s.session_id,
                "task_id": self.task_id,
                "trial_index": self.trials,
                "dimension": self.dimension,
                "score_norm": float(score if score is not None else (1.0 if correct else 0.0)),
                "response_time_ms": rt,
                "error_flag": not correct,
                "error_burst": self.burst,
                "hesitation_jitter": jitter,
                "keystroke_latency_ms": None if press is None else round(press, 1),
                "trial_meta": {"item_id": f"{self.task_id}:{self.trials}", **(meta or {})},
                "voice_opt_in": False,
                "voice_latency_ms": None,
                "vocal_pace_hz": None,
                "client_ts": _iso_ms(s.clock),
            }
        )
        if closes_trial:
            self.trials += 1
            s.clock += timedelta(milliseconds=rng.uniform(300, 700))


# --- the eight exercises (payload shapes and trial_meta keys as the frontend logs them) ----------

NBACK_INTERVAL_MS = 2000.0
NBACK_TYPES = ["target", "standard", "lure_minus", "lure_plus", "switch"]
NBACK_DIFFICULTY = {"target": -0.3, "standard": -2.0, "lure_minus": 0.0, "lure_plus": 0.0, "switch": 0.3}
NBACK_STREAMS = ("position", "symbol")  # NBack.tsx logs the streams in the payload's order
LURE_STREAM_RATE = 0.2  # share of trials whose off-rule stream matched n back (J)
# Withholding the off-rule key (impulse): easy on a plain trial, harder on an other-stream match (J).
NBACK_OFFRULE_DIFFICULTY = {"standard": -3.0, "lure_stream": -1.2}


def _nback(s: _Session) -> None:
    """Two streams, scored on the rule's stream (R16). A switch trial flips the rule (the hint)."""
    rng, b = s.rng, s.block("nback", 0, "working_memory")
    rule = "position"
    for _ in range(20):
        kind = rng.choices(NBACK_TYPES, weights=[0.3, 0.35, 0.1, 0.1, 0.15])[0]
        if kind == "switch":
            rule = "symbol" if rule == "position" else "position"
        off_kind = "lure_stream" if rng.random() < LURE_STREAM_RATE else "standard"
        target = kind == "target"
        if s.low:
            rule_rt = s.lazy(None) if rng.random() < 0.4 else None
            off_rt = s.lazy(None) if rng.random() < 0.3 else None
        else:
            theta = s.theta["agility" if kind == "switch" else "focus"]
            ok = rng.random() < _p(theta, NBACK_DIFFICULTY[kind], 0.5)
            rule_rt = min(NBACK_INTERVAL_MS - 50, _rt(rng, 650, theta)) if target == ok else None
            withheld = rng.random() < _p(s.theta["impulse"], NBACK_OFFRULE_DIFFICULTY[off_kind], 0.0)
            off_rt = None if withheld else min(NBACK_INTERVAL_MS - 50, _rt(rng, 700, theta))
        for k, stream in enumerate(NBACK_STREAMS):
            last = k == len(NBACK_STREAMS) - 1
            if stream == rule:
                # The verdict: the rule key's press-or-withhold matches the answer and the off-rule
                # key was not pressed. A rule event answered only by an off-rule press takes its time.
                pressed = rule_rt is not None
                rt = rule_rt if pressed else (off_rt if off_rt is not None else NBACK_INTERVAL_MS)
                b.emit(
                    pressed == target and off_rt is None,
                    rt,
                    first_press_ms=-1.0 if pressed or off_rt is not None else None,
                    meta={"trial_type": kind, "rule": rule, "stream": stream},
                    closes_trial=last,
                )
            else:
                b.emit(
                    off_rt is None,
                    NBACK_INTERVAL_MS if off_rt is None else off_rt,
                    first_press_ms=None if off_rt is None else -1.0,
                    meta={"trial_type": off_kind, "rule": rule, "stream": stream},
                    closes_trial=last,
                )


def _stroop(s: _Session) -> None:
    rng, b = s.rng, s.block("stroop", 0, "executive_function")
    limit = 3000.0
    order = [True] * STROOP_PER_CONDITION + [False] * STROOP_PER_CONDITION
    rng.shuffle(order)
    for congruent in order:
        meta = {"congruent": congruent}
        if s.low:
            rt = s.lazy(limit)
            ok = rng.random() < 0.25
        else:
            ok = rng.random() < _p(s.theta["impulse"], -2.5 if congruent else -1.6, 0.25)
            rt = _rt(rng, 650, s.theta["agility"], STROOP_SIGMA_MS, STROOP_TAU_MS) + (0 if congruent else s.stroop_cost)
            rt = None if rt >= limit else rt
        if rt is None:
            b.emit(False, limit, first_press_ms=None, meta=meta)
        else:
            b.emit(ok, rt, meta=meta)


def _matrix(s: _Session) -> None:
    rng, limit = s.rng, 30_000.0
    for n in range(4):  # one item per task, as the payload has
        b = s.block("matrix", n, "pattern_induction")
        if s.low:
            rt, ok = s.lazy(limit), rng.random() < 0.25
        else:
            theta = s.theta["focus"]
            ok = rng.random() < _p(theta, rng.uniform(-1.0, 1.5), 0.25)
            rt = _rt(rng, 9000, theta)
            rt = None if rt >= limit else rt
        if rt is None:
            b.emit(False, limit, first_press_ms=None)
        else:
            b.emit(ok, rt)


def _relational(s: _Session) -> None:
    rng, b, limit = s.rng, s.block("relational", 0, "pattern_induction"), 15_000.0
    for _ in range(8):
        hops = rng.choice([1, 2, 3])
        inverted = rng.random() < 0.3
        meta = {"hops": hops, "inverted": inverted, "level": hops - 1}
        if s.low:
            rt, ok = s.lazy(limit), rng.random() < 0.5
        else:
            theta = s.theta["focus"]
            ok = rng.random() < _p(theta, -1.5 + 0.6 * hops + 0.4 * inverted, 0.5)
            rt = _rt(rng, 2000 + 1500 * hops, theta)
            rt = None if rt >= limit else rt
        if rt is None:
            b.emit(False, limit, first_press_ms=None, meta=meta)
        else:
            b.emit(ok, rt, meta=meta)


def _tower(s: _Session) -> None:
    rng, limit = s.rng, 60_000.0
    for n in range(2):
        b = s.block("tower", n, "executive_function")
        l_min = rng.choice([3, 4, 5])
        if s.low:
            planning = rng.uniform(300, 1500)
            solved = rng.random() < 0.1
            l_user = l_min + rng.randint(3, 12)
            window = planning + l_user * rng.uniform(250, 500)
            conflict = rng.uniform(150, 400)
        else:
            focus, impulse = s.theta["focus"], s.theta["impulse"]
            planning = _rt(rng, 9000 + 2000 * (l_min - 3), focus)
            solved = rng.random() < _p(focus, -1.5 + 0.4 * (l_min - 3), 0.0)
            minimal = rng.random() < _p(impulse, -0.5 + 0.3 * (l_min - 3), 0.0)
            l_user = l_min + (0 if solved and minimal else rng.randint(1, 6) if solved else rng.randint(2, 10))
            window = planning + l_user * _rt(rng, 1200, focus)
            conflict = _rt(rng, 1800, impulse)
        if window >= limit:
            solved, window = False, limit
        b.emit(
            solved and l_user == l_min,
            window,
            score=min(1.0, l_min / l_user) if solved else 0.0,
            first_press_ms=planning,
            meta={
                "l_min": l_min,
                "l_user": l_user,
                "predicted_moves": max(0, l_min + round(rng.gauss(0, 1))),
                "planning_time_ms": round(planning, 1),
                "conflict_latency_ms": round(conflict, 1),
                "solved": solved,
            },
        )


UFOV_GRID_MS = [17, 25, 36, 52, 76, 111, 162, 236, 343, 500]  # fixtures.json duration_grid_ms


def _ufov(s: _Session) -> None:
    """2-down 1-up staircase on the grid; the last event carries the threshold estimate."""
    rng, b = s.rng, s.block("ufov", 0, "processing_speed")
    theta = s.theta["visual"]
    threshold = min(500.0, max(17.0, 110 * math.exp(-0.5 * theta)))
    step, streak, shown_log = 6, 0, []
    trials = 16
    for i in range(trials):
        requested = UFOV_GRID_MS[step]
        frames = max(1, round(requested * 60 / 1000))
        shown = round(frames * 1000 / 60, 1)
        shown_log.append(shown)
        if s.low:
            central_ok, peripheral_ok = rng.random() < 0.5, rng.random() < 1 / 8
            rt = rng.uniform(150, 400)
        else:
            central_ok = rng.random() < _p(theta, -2.5, 0.5)
            seen = 1 / (1 + math.exp(-(math.log(shown) - math.log(threshold)) / 0.3))
            peripheral_ok = rng.random() < 1 / 8 + 7 / 8 * seen
            rt = _rt(rng, 2200, theta)
        correct = central_ok and peripheral_ok
        meta = {
            "requested_ms": requested,
            "shown_ms": shown,
            "frames": frames,
            "similarity": 0.5,
            "mask_noise": 0.5,
            "central_ok": central_ok,
            "peripheral_ok": peripheral_ok,
        }
        if i == trials - 1:
            tail = shown_log[-8:]
            meta["quest_threshold_ms"] = round(math.exp(sum(map(math.log, tail)) / len(tail)), 1)
        b.emit(correct, rt, first_press_ms=rt * 0.55, meta=meta)
        if correct:
            streak += 1
            if streak == 2:
                step, streak = max(0, step - 1), 0
        else:
            step, streak = min(len(UFOV_GRID_MS) - 1, step + 1), 0


MST_EXPECTED = {"old": "old", "lure": "similar", "new": "new"}


def _mst(s: _Session) -> None:
    rng, b, limit = s.rng, s.block("mst", 0, "episodic_memory"), 5000.0
    items = ["old"] * 4 + ["lure"] * 4 + ["new"] * 4
    rng.shuffle(items)
    theta = s.theta["memory"]
    for kind in items:
        delta = round(rng.uniform(0.1, 0.6), 2) if kind == "lure" else 0
        if s.low:
            rt = s.lazy(limit)
            response = rng.choice(["old", "similar", "new"])
        else:
            if kind == "old":
                hit = rng.random() < _p(theta, -1.2, 1 / 3)
                response = "old" if hit else rng.choices(["similar", "new"], [0.7, 0.3])[0]
            elif kind == "lure":
                hit = rng.random() < _p(theta, 0.8 - 2 * delta, 1 / 3)
                response = "similar" if hit else rng.choices(["old", "new"], [0.8, 0.2])[0]
            else:
                hit = rng.random() < _p(theta, -2.0, 1 / 3)
                response = "new" if hit else rng.choices(["similar", "old"], [0.7, 0.3])[0]
            rt = _rt(rng, 1400, theta)
            rt = None if rt >= limit else rt
        if rt is None:
            b.emit(False, limit, first_press_ms=None, meta={"kind": kind, "delta": delta, "response": "none"})
        else:
            b.emit(response == MST_EXPECTED[kind], rt, meta={"kind": kind, "delta": delta, "response": response})


def _rotation(s: _Session) -> None:
    rng, b, limit = s.rng, s.block("rotation", 0, "spatial_orientation"), 7000.0
    theta = s.theta["visual"]
    for _ in range(12):
        angle = rng.choice([0, 60, 120, 180, 240, 300])
        mirrored = rng.random() < 0.5
        turn = min(angle, 360 - angle)
        meta = {"angle_deg": angle, "mirrored": mirrored}
        if s.low:
            rt, ok = s.lazy(limit), rng.random() < 0.5
        else:
            ok = rng.random() < _p(theta, -2.0 + turn / 150, 0.5)
            rt = _rt(rng, 1000 + 9 * turn, theta)
            rt = None if rt >= limit else rt
        if rt is None:
            b.emit(False, limit, first_press_ms=None, meta=meta)
        else:
            b.emit(ok, rt, meta=meta)


SST_TRIALS = 64  # 16 stops: shortened from the served 200 (50 stops) to keep sessions small
SST_LIMIT_MS = 1250.0
SSD_START_MS = 250
SSD_STEP_MS = 50


def _other(d: str) -> str:
    return "right" if d == "left" else "left"


def _stop_signal(s: _Session) -> None:
    """Stop Light as StopSignal.tsx logs it, played as an independent race (see the docstring)."""
    rng, b = s.rng, s.block("stop", 0, "executive_function")
    stops: list[bool] = []
    for start in range(0, SST_TRIALS, 8):  # 2 stops per 8 trials, never in the first 2 trials
        picks = set(rng.sample(range(max(start, 2), start + 8), 2))
        stops += [i in picks for i in range(start, start + 8)]
    theta = s.theta["agility"]
    ssd = SSD_START_MS
    for stop in stops:
        d = rng.choice(["left", "right"])
        if s.low:
            go_rt = s.lazy(SST_LIMIT_MS)
            choice = rng.choice(["left", "right"])
        else:
            go_rt = _rt(rng, 520, theta)
            go_rt = None if go_rt >= SST_LIMIT_MS else go_rt
            choice = d if rng.random() < _p(theta, -3.0, 0.5) else _other(d)
        responded = go_rt is not None
        meta = {"stop_trial": stop, "dir": d}
        if stop:
            # The race: the stop process finishes at SSD + SSRT; a low-effort session ignores it.
            if responded and not s.low and go_rt >= ssd + rng.gauss(s.ssrt, SSRT_TRIAL_SD_MS):
                responded = False
            meta |= {"response": choice if responded else "none", "ssd_ms": ssd}
            correct = not responded
            ssd = min(int(SST_LIMIT_MS), max(0, ssd + (SSD_STEP_MS if correct else -SSD_STEP_MS)))
        else:
            meta["response"] = choice if responded else "none"
            correct = responded and choice == d
        if responded:
            b.emit(correct, go_rt, meta=meta)
        else:
            b.emit(correct, SST_LIMIT_MS, first_press_ms=None, meta=meta)


FLANKER_PER_CELL = 8  # 32 trials: shortened from the served 96 (24 per cell)
FLANKER_LIMIT_MS = 1700.0


def _flanker(s: _Session) -> None:
    rng, b = s.rng, s.block("flanker", 0, "executive_function")
    cells = [(d, c) for d in ("left", "right") for c in (True, False)] * FLANKER_PER_CELL
    rng.shuffle(cells)
    theta = s.theta["agility"]
    for d, congruent in cells:
        meta = {"flanker": "congruent" if congruent else "incongruent", "dir": d}
        if s.low:
            rt, ok = s.lazy(FLANKER_LIMIT_MS), rng.random() < 0.5
        else:
            ok = rng.random() < _p(theta, -3.0 if congruent else -2.0, 0.5)
            rt = _rt(rng, 480, theta, 60.0, 60.0) + (0 if congruent else s.flanker_cost)
            rt = None if rt >= FLANKER_LIMIT_MS else rt
        if rt is None:
            b.emit(False, FLANKER_LIMIT_MS, first_press_ms=None, meta=meta | {"response": "none"})
        else:
            b.emit(ok, rt, meta=meta | {"response": d if ok else _other(d)})


PAL_STAGES = (2, 4, 6, 8)
PAL_BOXES = 8
PAL_ATTEMPTS = 3
PAL_LIMIT_MS = 20_000.0


def _pal(s: _Session) -> None:
    """Pair Finder as PairedAssociates.tsx logs it: one event per recall choice; a stage with a
    wrong box is studied again, and failing its last attempt ends the task."""
    rng, b = s.rng, s.block("pal", 0, "episodic_memory")
    theta = s.theta["memory"]
    for size in PAL_STAGES:
        boxes = rng.sample(range(PAL_BOXES), size)
        patterns = rng.sample(range(PAL_BOXES), size)
        for attempt in range(1, PAL_ATTEMPTS + 1):
            order = list(range(size))
            rng.shuffle(order)
            stage_ok = True
            for k in order:
                if s.low:
                    rt, ok = s.lazy(PAL_LIMIT_MS), rng.random() < 1 / PAL_BOXES
                else:
                    ok = rng.random() < _p(theta, -1.0 + 0.45 * (size - 2) - 0.9 * (attempt - 1), 1 / PAL_BOXES)
                    rt = _rt(rng, 1800 + 150 * size, theta)
                    rt = None if rt >= PAL_LIMIT_MS else rt
                if rt is None:
                    ok, chosen = False, -1
                else:
                    chosen = boxes[k] if ok else rng.choice([x for x in range(PAL_BOXES) if x != boxes[k]])
                meta = {
                    "pal_level": size,
                    "attempt": attempt,
                    "pattern": patterns[k],
                    "box": boxes[k],
                    "chosen": chosen,
                    "pal_total": sum(PAL_STAGES),
                    "boxes": PAL_BOXES,
                }
                if rt is None:
                    b.emit(False, PAL_LIMIT_MS, first_press_ms=None, meta=meta)
                else:
                    b.emit(ok, rt, meta=meta)
                stage_ok = stage_ok and ok
            if stage_ok:
                break
        else:
            return  # the last attempt failed: later stages are never reached


EXERCISES = [_nback, _stroop, _matrix, _relational, _tower, _ufov, _mst, _rotation, _stop_signal, _flanker, _pal]


# --- users and sessions ---------------------------------------------------------------------------


def user_id(seed: int, index: int) -> str:
    return f"syn-s{seed}-u{index:05d}"


def simulate_user(seed: int, index: int, sessions: int, params: Params = Params()) -> tuple[list[dict], dict]:
    """One user's events (dicts in TelemetryEvent's field order) and ground truth. The user's
    random stream depends only on (seed, index), so a user is the same however many are made."""
    p = params
    rng = random.Random(f"synapsetwin:{seed}:{index}")
    uid = user_id(seed, index)
    g = rng.gauss(0, 1)
    ability = {k: round(math.sqrt(p.ability_corr) * g + math.sqrt(1 - p.ability_corr) * rng.gauss(0, 1), 4) for k in PILLARS}
    gain = max(0.0, rng.gauss(p.practice_gain, p.practice_gain_sd))
    peak = rng.gauss(15, 3) % 24
    preferred = rng.uniform(7, 22)
    train_prob = min(0.9, max(0.1, rng.gauss(p.sessions_per_week / 7, 0.1)))
    slope = stroop_cost_slope(p)

    events: list[dict] = []
    truth_sessions = []
    day, last_day, level = rng.randrange(3), None, 0.0
    for k in range(sessions):
        if k:
            day += 1
            while rng.random() >= train_prob:
                day += 1
        if last_day is not None:
            level *= math.exp(-p.forgetting_per_day * (day - last_day))
        hour = min(23.5, max(6.0, rng.gauss(preferred, 1.5)))
        state = rng.gauss(0, p.state_sd)
        low = rng.random() < p.low_effort_rate
        tod = -p.tod_amplitude * (1 - math.cos(2 * math.pi * (hour - peak) / 24)) / 2
        practice = gain * level
        theta = {k2: ability[k2] + practice + state + tod for k2 in PILLARS}
        # The cost carries no state or time-of-day term, so its retest noise is the trial noise
        # stroop_cost_slope() was solved for.
        cost = max(STROOP_COST_FLOOR_MS, STROOP_COST_MS - slope * (ability["agility"] + practice))
        # Likewise the true SSRT and flanker cost: ability plus practice, no state or time of day.
        ssrt = max(SSRT_FLOOR_MS, SSRT_MS - SSRT_SLOPE_MS * (ability["impulse"] + practice))
        flanker_cost = max(FLANKER_COST_FLOOR_MS, FLANKER_COST_MS - FLANKER_COST_SLOPE_MS * (ability["agility"] + practice))
        start = datetime.combine(p.start + timedelta(days=day), time(), tzinfo=timezone.utc) + timedelta(hours=hour)
        sid = f"{uid}-{k:03d}"
        # Trials draw from their own stream, so outcomes never shift the schedule: changing a
        # parameter that only alters trials (forgetting, say) keeps every user's days and flags.
        trials_rng = random.Random(f"synapsetwin:{seed}:{index}:{k}")
        s = _Session(trials_rng, uid, sid, k, start, theta, low, cost, ssrt, flanker_cost)
        for exercise in EXERCISES:
            exercise(s)
        events += s.events
        truth_sessions.append(
            {
                "session_id": sid,
                "day": day,
                "date": (p.start + timedelta(days=day)).isoformat(),
                "hour": round(hour, 2),
                "gap_days": 0 if last_day is None else day - last_day,
                "practice_level": round(level, 4),
                "practice_gain": round(practice, 4),
                "state": round(state, 4),
                "tod_shift": round(tod, 4),
                "low_effort": low,
                "stroop_cost_ms": round(cost, 1),
                "ssrt_ms": round(ssrt, 1),
                "flanker_cost_ms": round(flanker_cost, 1),
                "received_at": (s.clock + timedelta(seconds=2)).isoformat(),
            }
        )
        level = 1 - (1 - level) * math.exp(-1 / p.practice_tau)
        last_day = day

    truth = {
        "user_id": uid,
        "ability": ability,
        "practice_gain": round(gain, 4),
        "chronotype_peak_hour": round(peak, 2),
        "preferred_hour": round(preferred, 2),
        "train_prob": round(train_prob, 4),
        "sessions": truth_sessions,
    }
    return events, truth


def generate(users: int, sessions: int, seed: int, out: str | Path, params: Params = Params()) -> dict:
    """Writes every user's JSONL (each event validated by TelemetryEvent) and ground truth."""
    if users < 1 or sessions < 1:
        raise ValueError("users and sessions must be at least 1")
    out = Path(out)
    (out / "_truth").mkdir(parents=True, exist_ok=True)
    total = 0
    for i in range(users):
        events, truth = simulate_user(seed, i, sessions, params)
        received = {t["session_id"]: t["received_at"] for t in truth["sessions"]}
        uid = truth["user_id"]
        # newline="\n": the same bytes on every OS, so a seed is reproducible across machines.
        with open(out / f"{uid}.jsonl", "w", encoding="utf-8", newline="\n") as f:
            for raw in events:
                e = TelemetryEvent.model_validate(raw)
                line = {**e.model_dump(mode="json"), "received_at": received[e.session_id]}
                f.write(json.dumps(line, allow_nan=False) + "\n")
        (out / "_truth" / f"{uid}.json").write_text(json.dumps(truth, indent=1) + "\n", encoding="utf-8", newline="\n")
        total += len(events)
    return {"users": users, "sessions": sessions, "events": total, "out": str(out)}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m data.synthetic.generate", description=__doc__.split("\n\n")[0])
    ap.add_argument("--users", type=int, required=True)
    ap.add_argument("--sessions", type=int, required=True)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", type=Path, required=True, help="e.g. data/raw/synthetic (gitignored)")
    ap.add_argument("--low-effort-rate", type=float, default=Params.low_effort_rate)
    ap.add_argument("--forgetting-per-day", type=float, default=Params.forgetting_per_day)
    a = ap.parse_args(argv)
    params = Params(low_effort_rate=a.low_effort_rate, forgetting_per_day=a.forgetting_per_day)
    summary = generate(a.users, a.sessions, a.seed, a.out, params)
    print(f"{summary['events']} events for {summary['users']} users x {summary['sessions']} sessions -> {summary['out']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
