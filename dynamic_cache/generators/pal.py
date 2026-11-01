"""Pair Finder: paired-associates learning, simplified from CANTAB PAL.

Shape: frontend/.../telemetry/types.ts PalParams; the design is PairedAssociates.tsx PAL_DESIGN.
Each stage shows its patterns one by one in their boxes, then asks for each pattern's box in the
`recall` order. A stage with any wrong box is studied and recalled again, up to `max_attempts`.

Defaults: CANTAB "PAL 2-8" (Sahakian et al. 1988; Barnett et al. 2016): stages of 2, 4, 6 and 8
patterns (20 in all) in 8 boxes, 2 s per box. 3 attempts instead of CANTAB's 10 and a 20 s choice
window are the frontend's simplifications (F-B, marked ponytail there).
The stage series is the protocol, so theta is not used (like MST): PAL_FirstTrialMemory scores
every pattern of every stage, and a harder series would change what the score means.

Per stage: distinct boxes and distinct patterns (the 8 shapes differ by form, never colour), and
a recall order that is a reshuffle of the study order, never the same order.
"""

from __future__ import annotations

import random

from ._common import positive_int

STAGES = (2, 4, 6, 8)
BOXES = 8
PATTERNS = 8  # PairedAssociates.tsx draws 8 shapes, ids 0..7
STUDY_MS = 2000
TIME_LIMIT_MS = 20_000
MAX_ATTEMPTS = 3


def build(rng: random.Random, theta: float, stages: tuple = STAGES, max_attempts: int = MAX_ATTEMPTS) -> dict:
    if not isinstance(stages, (list, tuple)) or not 1 <= len(stages) <= 8:
        raise ValueError("stages must be a list of 1..8 stage sizes")
    sizes = [positive_int("stage size", s, minimum=1, maximum=min(BOXES, PATTERNS)) for s in stages]
    max_attempts = positive_int("max_attempts", max_attempts, maximum=10)
    out = []
    for size in sizes:
        boxes = rng.sample(range(BOXES), size)
        patterns = rng.sample(range(PATTERNS), size)
        recall = list(range(size))
        if size > 1:
            while recall == sorted(recall):  # a reshuffle, never the study order
                rng.shuffle(recall)
        out.append({"items": [{"pattern": p, "box": b} for p, b in zip(patterns, boxes)], "recall": recall})
    return {
        "boxes": BOXES,
        "study_ms": STUDY_MS,
        "time_limit_ms": TIME_LIMIT_MS,
        "max_attempts": max_attempts,
        "stages": out,
    }
