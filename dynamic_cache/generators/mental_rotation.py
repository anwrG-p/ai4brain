"""2-D mental rotation with polyominoes: is the right shape the left one turned, or mirrored?"""

from __future__ import annotations

import random

from ._common import positive_int
from .solvers import is_chiral, mirror, normalize_cells, rotate90

# Angles are whole quarter turns, so the solver can decide "same" with integer geometry.
ANGLES = (0, 90, 180)
# 50 trials per angle, presented in blocks: the evidence review (2026-10-30 §1.4, and HANDOVER
# "Block designs") asks for blocked presentation and >= 50 trials per condition if the angle slope
# is wanted (a second-hand heuristic; pooled blocked slopes reached split-half .79). 3 x 50 = 150.
TRIALS_PER_CONDITION = 50
SHAPES_PER_BLOCK = 8


def _canonical(cells) -> tuple:
    """One key per free polyomino (all turns and both mirror images)."""
    return min(normalize_cells(rotate90(c, q)) for c in (cells, mirror(cells)) for q in range(4))


def _polyomino(rng: random.Random, size: int) -> list:
    """A random connected chiral polyomino: its mirror image is never a turn of it."""
    while True:
        cells = {(0, 0)}
        while len(cells) < size:
            x, y = rng.choice(sorted(cells))
            dx, dy = rng.choice(((1, 0), (-1, 0), (0, 1), (0, -1)))
            cells.add((x + dx, y + dy))
        if is_chiral(list(cells)):
            return list(normalize_cells(cells))


def build(
    rng: random.Random,
    theta: float,
    trials_per_condition: int = TRIALS_PER_CONDITION,
    angles: tuple[int, ...] = ANGLES,
) -> dict:
    trials_per_condition = positive_int("trials_per_condition", trials_per_condition)
    if not angles or any(a % 90 or not 0 <= a < 360 for a in angles) or len(set(angles)) != len(angles):
        raise ValueError("angles must be distinct multiples of 90 in [0, 360)")
    size = 4 + round(2 * theta)  # 4..6 cells
    # Distinct free shapes; there are only 2 chiral tetrominoes (L, S) and 6 chiral pentominoes,
    # so the pool is capped by a fixed number of draws rather than filled at any cost.
    pool: dict = {}
    for _ in range(60):
        s = _polyomino(rng, size)
        pool.setdefault(_canonical(s), s)
        if len(pool) == SHAPES_PER_BLOCK:
            break
    shapes = list(pool.values())

    blocks = list(angles)
    rng.shuffle(blocks)  # block order varies; within a block the angle is constant
    out = []
    for angle in blocks:
        mirrored = [True] * (trials_per_condition // 2) + [False] * (trials_per_condition - trials_per_condition // 2)
        rng.shuffle(mirrored)
        for m in mirrored:
            base = rng.choice(shapes)
            base = rotate90(mirror(base) if rng.random() < 0.5 else base, rng.randrange(4))
            cells = [list(c) for c in normalize_cells(base)]
            out.append({"cells": cells, "angle_deg": angle, "mirrored": m, "answer": "different" if m else "same"})
    return {"trials": out, "time_limit_ms": round(7000 - 2000 * theta)}  # 7000 ms (fixture) .. 5000
