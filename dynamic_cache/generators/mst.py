"""Mnemonic similarity task (study-test): line figures, then old / similar / new judgements."""

from __future__ import annotations

import copy
import math
import random

from ._common import positive_int
from .solvers import MST_LURE_MARGIN, poly_distance, poly_structure

# oMST mix: 20 repeats, 44 lures, 20 foils (Stark, Stark & Stark 2023; evidence review 2026-10-30
# §1.3, HANDOVER "Block designs"): 64 study + 84 test = 148 trials, r = .75 with the full MST.
REPEATS, LURES, FOILS = 20, 44, 20
ENCODE_MS = 2000  # fixture value, as the oMST's 2 s per image

# Lure bins: one vertex moves this far (unit square). A fixed spread, so the tuning curve over
# delta is the same in every block (assessment_engine/README.md, open question 4); theta does not
# change it. Four equal bins of 11 lures each (design judgement).
LURE_DELTAS = (0.08, 0.14, 0.20, 0.26)
BASE_MIN = 0.8  # framed distance between any two base figures of the same structure


def _axis(rng: random.Random, n: int) -> list[int]:
    """n coordinates (hundredths) in [10, 90] spanning at least 60: big enough that a lure shows."""
    lo = rng.randint(10, 30)
    vals = [lo, rng.randint(lo + 60, 90)] + [rng.randint(10, 90) for _ in range(n - 2)]
    rng.shuffle(vals)
    return vals


def _points(rng: random.Random, n: int) -> list[tuple[float, float]]:
    while True:
        pts = [(x / 100, y / 100) for x, y in zip(_axis(rng, n), _axis(rng, n))]
        if all(math.dist(p, q) >= 0.15 for k, p in enumerate(pts) for q in pts[k + 1 :]):
            return pts


def _poly(rng: random.Random) -> dict:
    n = rng.randint(3, 6)
    pts = _points(rng, n)
    order = rng.sample(range(n), n)
    edges = [[order[k], order[k + 1]] for k in range(n - 1)]
    if rng.random() < 0.5:
        edges.append([order[-1], order[0]])
    have = {frozenset(e) for e in edges}
    chords = [[a, b] for a in range(n) for b in range(a + 1, n) if frozenset((a, b)) not in have]
    if chords and n >= 4 and rng.random() < 0.3:
        edges.append(rng.choice(chords))
    return {"points": [list(p) for p in pts], "edges": edges}


def _lure(rng: random.Random, src: dict, delta: float, others: list[dict]) -> tuple[dict, float] | None:
    """Move one vertex of src by delta, inside src's bounding box (so PolyView frames both the same
    way), clear of the other vertices and nearer src than any other studied figure."""
    pts = [tuple(p) for p in src["points"]]
    xs, ys = [x for x, _ in pts], [y for _, y in pts]
    for _ in range(100):
        k = rng.randrange(len(pts))
        a = rng.random() * 2 * math.pi
        x, y = round(pts[k][0] + delta * math.cos(a), 3), round(pts[k][1] + delta * math.sin(a), 3)
        if not (min(xs) <= x <= max(xs) and min(ys) <= y <= max(ys)):
            continue
        if any(math.dist((x, y), q) < 0.08 for j, q in enumerate(pts) if j != k):
            continue
        new = [list(p) for p in pts]
        new[k] = [x, y]
        lure = {"points": new, "edges": [e[:] for e in src["edges"]]}
        near = poly_distance(lure, src)
        if all(poly_distance(lure, o) >= near + MST_LURE_MARGIN for o in others if o is not src):
            return lure, round(math.dist((x, y), pts[k]), 3)
    return None


def build(rng: random.Random, theta: float, repeats: int = REPEATS, lures: int = LURES, foils: int = FOILS) -> dict:
    repeats = positive_int("repeats", repeats, minimum=0)
    lures = positive_int("lures", lures, minimum=0)
    foils = positive_int("foils", foils, minimum=0)
    if repeats + lures == 0:
        raise ValueError("a block needs at least one studied figure")
    if repeats + lures + foils == 0:
        raise ValueError("a block needs at least one test item")
    bases: list[dict] = []
    by_structure: dict[tuple, list[dict]] = {}  # only figures of one structure can be confused
    while len(bases) < repeats + lures + foils:
        p = _poly(rng)
        twins = by_structure.setdefault(poly_structure(p), [])
        if all(poly_distance(p, b) >= BASE_MIN for b in twins):
            bases.append(p)
            twins.append(p)
    encode, news = bases[: repeats + lures], bases[repeats + lures :]
    deltas = [LURE_DELTAS[k % len(LURE_DELTAS)] for k in range(lures)]
    rng.shuffle(deltas)

    studied = {id(e) for e in encode}
    test = [{"item": copy.deepcopy(encode[k]), "kind": "old", "delta": 0} for k in range(repeats)]
    for k, delta in enumerate(deltas):
        src = encode[repeats + k]
        made = _lure(rng, src, delta, [e for e in by_structure[poly_structure(src)] if id(e) in studied])
        if made is None:
            raise RuntimeError("could not place a lure")  # generate() reports it as GenerationError
        test.append({"item": made[0], "kind": "lure", "delta": made[1]})
    test += [{"item": p, "kind": "new", "delta": 0} for p in news]
    encode = encode[:]
    rng.shuffle(encode)
    rng.shuffle(test)
    return {"encode_ms": ENCODE_MS, "encode": encode, "test": test}
