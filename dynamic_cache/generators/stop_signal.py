"""Stop Light: a two-choice go task (left/right arrow) with a stop signal on some trials.

Shape: frontend/.../telemetry/types.ts StopSignalParams; the design is StopSignal.tsx SST_DESIGN.
The stop-signal delay (SSD) is a one-up/one-down staircase the client runs inside the block, so
it tracks P(respond | signal) near .5 by itself: theta is not used (like MST). The consensus guide
also argues against tuning the go task for difficulty (no time pressure, no strategic slowing).

Defaults (Verbruggen et al. 2019, eLife 8:e46323, the consensus guide, and STOP-IT):
- 200 trials with 25% stop trials, so 50 stops: the guide's minimum of 50 stop trials for a
  reliable integration SSRT.
- SSD starts at 250 ms and moves in 50 ms steps; go window 1250 ms; fixation cross 500 ms.
- Stops are spread evenly: each run of STOP_EVERY (8) trials holds exactly 2 stops, as in the
  frontend fixture, so the stop rate never drifts within the block (the guide: stops random, not
  bunched), and never more than 2 stops in a row. The first FIRST_GO (2) trials are go trials,
  so the first press is never a stop.
- Both arrows equally often on go trials and on stop trials.
"""

from __future__ import annotations

import random

from ._common import MAX_TRIALS, GenerationError, positive_int, unit_float

DEFAULT_TRIALS = 200
STOP_SHARE = 0.25
STOP_EVERY = 8  # each run of 8 trials holds round(8 * stop_share) stops
FIRST_GO = 2
MAX_STOP_RUN = 2  # as in the fixture: stops may pair up, never three in a row
TIME_LIMIT_MS = 1250
FIXATION_MS = 500
SSD_START_MS = 250
SSD_STEP_MS = 50
DIRS = ("left", "right")


def _longest_stop_run(stops: list[bool]) -> int:
    best = run = 0
    for s in stops:
        run = run + 1 if s else 0
        best = max(best, run)
    return best


def _balanced_dirs(rng: random.Random, n: int) -> list[str]:
    dirs = (list(DIRS) * (n // 2 + 1))[:n]
    rng.shuffle(dirs)
    return dirs


def build(rng: random.Random, theta: float, trials: int = DEFAULT_TRIALS, stop_share: float = STOP_SHARE) -> dict:
    trials = positive_int("trials", trials, minimum=STOP_EVERY, maximum=MAX_TRIALS)
    stop_share = unit_float("stop_share", stop_share)
    per_run = round(STOP_EVERY * stop_share)
    # At most 1 in 3 trials may stop: above that, waiting for the signal pays (the guide).
    if not 1 <= per_run <= STOP_EVERY // 3:
        raise ValueError(f"stop_share must give 1..{STOP_EVERY // 3} stops per {STOP_EVERY} trials")
    stops: list[bool] = []
    for start in range(0, trials, STOP_EVERY):
        end = min(start + STOP_EVERY, trials)
        open_slots = list(range(max(start, FIRST_GO), end))
        k = min(len(open_slots), round((end - start) * stop_share))
        for _ in range(1000):  # never more than MAX_STOP_RUN stops in a row, across runs too
            picked = set(rng.sample(open_slots, k))
            block = stops + [i in picked for i in range(start, end)]
            if _longest_stop_run(block) <= MAX_STOP_RUN:
                break
        else:
            raise GenerationError(f"stop_signal: no order without {MAX_STOP_RUN + 1} stops in a row")
        stops = block
    n_stop = sum(stops)
    stop_dirs = iter(_balanced_dirs(rng, n_stop))
    go_dirs = iter(_balanced_dirs(rng, trials - n_stop))
    return {
        "time_limit_ms": TIME_LIMIT_MS,
        "fixation_ms": FIXATION_MS,
        "ssd_start_ms": SSD_START_MS,
        "ssd_step_ms": SSD_STEP_MS,
        "trials": [{"dir": next(stop_dirs) if stop else next(go_dirs), "stop": stop} for stop in stops],
    }
