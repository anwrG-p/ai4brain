"""Useful-field-of-view block: central letter + peripheral target among distractors (QUEST+)."""

from __future__ import annotations

import random

from ._common import positive_int

# Length. The research gives no verified QUEST+ trial count (evidence review 2026-10-30 §4 lists
# "QUEST+ trial counts, priors and lapse/guess rates" as not verified). 80 is the length our own
# QUEST+ acceptance test converges with (docs/superpowers/plans/2026-10-23-member1-assessment-
# telemetry.md: a simulated observer at 80 ms, 80 trials, threshold within [50, 130] ms).
DEFAULT_TRIALS = 80
GRID_POINTS = 10  # 17..500 ms, log-spaced, as the fixture
DIRECTIONS = 8
RINGS = (1, 2, 3)
TARGET_RING = 2  # Ufov.tsx always draws the target on ring 2


def duration_grid(lo: int = 17, hi: int = 500, points: int = GRID_POINTS) -> list[int]:
    grid = [round(lo * (hi / lo) ** (k / (points - 1))) for k in range(points)]
    return sorted(set(grid))


def build(rng: random.Random, theta: float, trials: int = DEFAULT_TRIALS) -> dict:
    trials = positive_int("trials", trials)
    n_distractors = round(2 + 14 * theta)  # 2..16 of the 23 free spots
    # Both letters and all 8 directions equally often, in a shuffled order.
    centrals = (["A", "B"] * (trials // 2 + 1))[:trials]
    dirs = (list(range(DIRECTIONS)) * (trials // DIRECTIONS + 1))[:trials]
    rng.shuffle(centrals)
    rng.shuffle(dirs)
    out = []
    for central, d in zip(centrals, dirs):
        free = [(fd, ring) for ring in RINGS for fd in range(DIRECTIONS) if (fd, ring) != (d, TARGET_RING)]
        spots = sorted(rng.sample(free, n_distractors), key=lambda x: (x[1], x[0]))
        out.append({"central": central, "peripheral_dir": d, "distractors": [{"dir": fd, "ring": ring} for fd, ring in spots]})
    return {
        "duration_grid_ms": duration_grid(),
        # Fixed for the block (HANDOVER: adapt between blocks from telemetry, not within).
        "similarity": round(0.2 + 0.6 * theta, 3),
        "mask_noise": round(0.3 + 0.5 * theta, 3),
        "trials": out,
    }
