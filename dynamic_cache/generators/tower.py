"""Tower of London problems (3 discs on pegs of capacity 3, 2, 1) and the TOL-F series."""

from __future__ import annotations

import random
from collections import deque
from functools import lru_cache

from ._common import positive_int

CAPACITIES = (3, 2, 1)
DISCS = ("R", "G", "B")
TIME_LIMIT_MS = 60000  # TOL-F: 1 min per problem (evidence review 2026-10-30 §1.5)

# One payload is one problem (Tower.tsx plays trial 0 only), so the series is a block of payloads.
# TOL-F protocol (evidence review 2026-10-30 §1.5, PMC6669988; HANDOVER "Block designs"):
# 2 two-move comprehension items and 4 three-move practice items, then 24 test problems, 8 each at
# 4, 5 and 6 minimum moves, in increasing difficulty. Internal consistency .72-.76 (n = 7,703).
# Only the shape of the series is TOL-F: problems are drawn at random per move count, not the
# published TOL-F item set, so the published reliability is an approximation for this series.
# The series ignores theta (the protocol fixes the move counts), and so does its seeding.
PRACTICE = (2, 2, 3, 3, 3, 3)
TEST = (4,) * 8 + (5,) * 8 + (6,) * 8

State = tuple  # one tuple per peg, bottom disc first


def _moves(state: State) -> list[tuple[int, int, State]]:
    out = []
    for f in range(len(state)):
        if not state[f]:
            continue
        for t in range(len(state)):
            if t != f and len(state[t]) < CAPACITIES[t]:
                nxt = list(state)
                nxt[f], nxt[t] = state[f][:-1], state[t] + (state[f][-1],)
                out.append((f, t, tuple(nxt)))
    return out


@lru_cache(maxsize=1)
def _states() -> tuple[State, ...]:
    seed: State = (DISCS, (), ())
    seen = {seed}
    queue = deque([seed])
    while queue:
        for _, _, n in _moves(queue.popleft()):
            if n not in seen:
                seen.add(n)
                queue.append(n)
    return tuple(sorted(seen))


@lru_cache(maxsize=64)
def _distance_to(goal: State) -> dict[State, int]:
    """Moves from every state to goal: a breadth-first search outward from the goal (moves are
    reversible). solvers.tower_bfs re-checks l_min with a forward search from the start."""
    dist = {goal: 0}
    queue = deque([goal])
    while queue:
        s = queue.popleft()
        for _, _, n in _moves(s):
            if n not in dist:
                dist[n] = dist[s] + 1
                queue.append(n)
    return dist


def _counter_intuitive(start: State, goal: State, path: list[tuple[int, int]]) -> list[int]:
    """Counter-intuitive steps (design judgement; the contract does not define them): a move that
    takes a disc out of its goal slot, or that buries a disc already in its goal slot without
    putting the moved disc in its own. They undo or cover a finished part of the goal, which is
    the goal-subgoal conflict conflict_latency_ms times. Reproduces the fixture's [2]."""
    home = {}
    for peg, stack in enumerate(goal):
        for h, d in enumerate(stack):
            home[d] = (peg, h)
    pegs = [list(s) for s in start]
    out = []
    for k, (f, t) in enumerate(path):
        disc = pegs[f].pop()
        was_home = home[disc] == (f, len(pegs[f]))
        under = pegs[t][-1] if pegs[t] else None
        under_home = under is not None and home[under] == (t, len(pegs[t]) - 1)
        pegs[t].append(disc)
        now_home = home[disc] == (t, len(pegs[t]) - 1)
        if was_home or (under_home and not now_home):
            out.append(k)
    return out


def problem(rng: random.Random, l_min: int, exclude: set | None = None) -> dict:
    """A random start/goal pair at exactly l_min moves, with one optimal path."""
    exclude = exclude if exclude is not None else set()
    pairs = [(s, g) for g in _states() for s, d in _distance_to(g).items() if d == l_min and (s, g) not in exclude]
    if not pairs:
        raise ValueError(f"no unused problem with l_min {l_min}")
    pairs.sort()
    start, goal = rng.choice(pairs)
    exclude.add((start, goal))
    dist = _distance_to(goal)
    path, state = [], start
    while state != goal:
        nxt = [(f, t, n) for f, t, n in _moves(state) if dist[n] == dist[state] - 1]
        f, t, state = rng.choice(nxt)
        path.append((f, t))
    return {
        "capacities": list(CAPACITIES),
        "start": [list(s) for s in start],
        "goal": [list(s) for s in goal],
        "l_min": l_min,
        "optimal_moves": [list(m) for m in path],
        "counter_intuitive": _counter_intuitive(start, goal, path),
        "time_limit_ms": TIME_LIMIT_MS,
    }


def build(rng: random.Random, theta: float, l_min: int | None = None) -> dict:
    """One problem; theta maps to 2..6 minimum moves (the TOL-F range)."""
    # 8 is the longest minimum path on this board
    return problem(rng, positive_int("l_min", l_min, maximum=8) if l_min is not None else 2 + round(4 * theta))
