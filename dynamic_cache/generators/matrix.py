"""3x3 matrix reasoning: row rules per glyph attribute, one missing cell, glyph options."""

from __future__ import annotations

import random

from ._common import positive_int
from .solvers import glyph_key  # shared with the solver: how a glyph looks, not what the answer is

SHAPES = ("circle", "square", "triangle", "diamond")
COUNTS = (1, 2, 3)
COLORS = ("blue", "red", "green", "yellow")  # the names svg.tsx GLYPH_COLORS maps
TRIANGLE_TURNS = (0, 90, 180, 270)  # the only shape whose quarter turns all look different
TIME_LIMIT_MS = 30000  # fixture value

# A matrix payload is one item (Matrix.tsx plays trial 0 only), so the length lives in the block:
# generate_block("matrix") returns this many items. The research cites no minimum for matrices
# (design judgement); 12 items at one theta keeps one block near the 6-minute mark.
DEFAULT_BLOCK_SIZE = 12

# Rule kinds per attribute (Carpenter, Just & Shell 1990 style): constant in a row, a progression
# along the row (count only), or a distribution of three values over each row (a Latin square).
KINDS = {"shape": ("row", "distribution"), "color": ("row", "distribution"), "count": ("progression", "row", "distribution")}
DOMAIN = {"shape": SHAPES, "count": COUNTS, "color": COLORS}


def _grid(rng: random.Random, attr: str, kind: str) -> list[list]:
    dom = DOMAIN[attr]
    if kind == "fixed":
        v = rng.choice(dom)
        return [[v] * 3 for _ in range(3)]
    vals = rng.sample(dom, 3)
    if kind == "row":
        return [[vals[r]] * 3 for r in range(3)]
    if kind == "distribution":
        shift = rng.choice((1, 2))
        return [[vals[(c + shift * r) % 3] for c in range(3)] for r in range(3)]
    base = [1, 2, 3] if rng.random() < 0.5 else [3, 2, 1]  # progression
    return [base[:] for _ in range(3)]


def build(rng: random.Random, theta: float, n_options: int | None = None) -> dict:
    # theta sets how many attributes vary (1..3), how often the harder distribution rule is used,
    # and how many options there are.
    n_vary = 1 + round(2 * theta)
    n_options = positive_int("n_options", n_options, minimum=2, maximum=8) if n_options is not None else (4 if theta < 0.5 else 6)
    # Colour never varies alone, so the puzzle never rests on colour (FE-12, WCAG 1.4.1).
    vary = rng.sample(("shape", "count"), 1) if n_vary == 1 else rng.sample(("shape", "count", "color"), n_vary)
    kinds = {}
    for attr in ("shape", "count", "color"):
        if attr not in vary:
            kinds[attr] = "fixed"
        elif rng.random() < theta:
            kinds[attr] = "distribution"
        else:
            kinds[attr] = rng.choice([k for k in KINDS[attr] if k != "distribution"])
    grids = {attr: _grid(rng, attr, kind) for attr, kind in kinds.items()}
    # Rotation: a fixed shape that is a triangle gets one fixed turn; everything else stays upright.
    tri_fixed = kinds["shape"] == "fixed" and grids["shape"][0][0] == "triangle"
    turn = rng.choice(TRIANGLE_TURNS) if tri_fixed else 0

    def glyph(r: int, c: int) -> dict:
        shape = grids["shape"][r][c]
        return {"shape": shape, "count": grids["count"][r][c], "color": grids["color"][r][c], "rotation_deg": turn if shape == "triangle" else 0}

    cells: list = [glyph(r, c) for r in range(3) for c in range(3)]
    answer = cells[8]
    cells[8] = None

    # Distractors: never the answer's look, and never the look of another option once colour is
    # dropped (FE-12: no two options differ by colour alone). Near misses come first (same colour
    # and one shared non-colour attribute), so colour never gives the answer away.
    seen = {glyph_key(answer, with_color=False)}
    pool = [
        {"shape": s, "count": n, "color": col, "rotation_deg": answer["rotation_deg"] if s == "triangle" else 0}
        for s in SHAPES
        for n in COUNTS
        for col in COLORS
    ]
    rng.shuffle(pool)
    pool.sort(key=lambda g: -sum(g[a] == answer[a] for a in ("shape", "count", "color")))
    options = []
    for g in pool:
        key = glyph_key(g, with_color=False)
        if key not in seen:
            seen.add(key)
            options.append(g)
        if len(options) == n_options - 1:
            break
    at = rng.randrange(n_options)
    options.insert(at, answer)
    return {"cells": cells, "options": options, "answer": at, "time_limit_ms": TIME_LIMIT_MS}
