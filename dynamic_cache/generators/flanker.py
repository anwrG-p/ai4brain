"""Arrow Focus: the arrow flanker task (Eriksen & Eriksen 1974), as in the ANT's flanker part.

Shape: frontend/.../telemetry/types.ts FlankerParams; the design is Flanker.tsx FLANKER_DESIGN.
Five arrows; the answer is the middle one's direction. Congruent: the four flankers point the same
way; incongruent: the other way.

Defaults: 96 trials, one ANT block (Fan et al. 2002): 48 congruent and 48 incongruent, 24 per
direction in each. Window 1700 ms and a 500 ms fixation cross, as the ANT. More trials per
condition only narrow the reliability gap of a difference score (Hedge et al. 2018); no length
makes one session's conflict cost a trustworthy individual score, so sessions are pooled.
The conflict cost is read from RTs on a fixed design, so theta is not used (like MST): a shorter
window would trade the RT cost for errors and change what ANT_Conflict means.

Order: the four cells (direction x congruency) are shuffled with no cell more than MAX_RUN (3)
times in a row, as in the frontend fixture, so no streak hands the answer to a guesser.
"""

from __future__ import annotations

import random

from ._common import GenerationError, MAX_TRIALS, positive_int

DEFAULT_TRIALS = 96
TIME_LIMIT_MS = 1700
FIXATION_MS = 500
MAX_RUN = 3
CELLS = (("left", True), ("left", False), ("right", True), ("right", False))


def _longest_run(seq: list) -> int:
    best = run = 0
    for i, x in enumerate(seq):
        run = run + 1 if i and x == seq[i - 1] else 1
        best = max(best, run)
    return best


def build(rng: random.Random, theta: float, trials: int = DEFAULT_TRIALS) -> dict:
    trials = positive_int("trials", trials, minimum=4, maximum=MAX_TRIALS)
    cells = (list(CELLS) * (trials // len(CELLS) + 1))[:trials]
    for _ in range(1000):  # a shuffle passes about 1 time in 5 at 96 trials
        rng.shuffle(cells)
        if _longest_run(cells) <= MAX_RUN:
            break
    else:
        raise GenerationError(f"flanker: no order without a run over {MAX_RUN}")
    return {
        "time_limit_ms": TIME_LIMIT_MS,
        "fixation_ms": FIXATION_MS,
        "trials": [{"dir": d, "congruent": c, "cue": ("center" if k % 2 == 0 else "spatial")} for k, (d, c) in enumerate(cells)],
    }
