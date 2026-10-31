"""Independent solvers: each one re-derives a payload's answers from the payload alone.

They never read a generator's internal state, so a generator bug cannot hide behind itself.
`verify(payload)` returns a list of problems; an empty list means every answer checks out.

- n_back: re-classifies every trial and recomputes both streams' matches.
- stroop: answer == ink, inks in the colour list, both congruent and incongruent trials.
- matrix: a row-rule solver predicts the missing glyph and finds the one option that matches it.
  It also enforces FE-12: no two options may differ by colour alone.
- mental_rotation: integer geometry decides whether the right shape is a turn of the left one.
- relational: a graph solver derives the question's truth from the premises.
- tower: forward breadth-first search gives l_min; the optimal moves are replayed and the
  counter-intuitive steps recomputed.
- ufov, mst: structural checks (UFOV has no derived answer; MST checks old/lure/new by geometry).
"""

from __future__ import annotations

from collections import deque
from itertools import combinations
from typing import Any, Callable

# ---------------------------------------------------------------------------------------------
# n-back

NBACK_STREAM_KEY = {"position": "pos", "symbol": "symbol"}


def nback_classify(values: list, i: int, n: int, switch: bool) -> str:
    """trial_type of trial i on the rule stream, by priority switch > target > lure_minus > lure_plus.

    lure_minus = a match n-1 back (only for n >= 2), lure_plus = a match n+1 back."""
    if switch:
        return "switch"
    v = values[i]
    if i >= n and v == values[i - n]:
        return "target"
    if n >= 2 and i >= n - 1 and v == values[i - n + 1]:
        return "lure_minus"
    if i >= n + 1 and v == values[i - n - 1]:
        return "lure_plus"
    return "standard"


def verify_n_back(p: dict) -> list[str]:
    out: list[str] = []
    n, streams, trials = p["n"], p["streams"], p["trials"]
    values: dict[str, list] = {}
    for s in streams:
        key = NBACK_STREAM_KEY[s]
        raw = [t[key] for t in trials]
        if any(v is None for v in raw):
            out.append(f"stream {s} has a trial without a {key}")
            return out
        values[s] = [tuple(v) if isinstance(v, list) else v for v in raw]
    for i, t in enumerate(trials):
        rule = t["rule"]
        if rule not in streams:
            out.append(f"trial {i}: rule {rule} has no stream to score")
            continue
        switch = i > 0 and rule != trials[i - 1]["rule"]
        want = nback_classify(values[rule], i, n, switch)
        if t["trial_type"] != want:
            out.append(f"trial {i}: trial_type {t['trial_type']} but the sequence says {want}")
        if set(t["answer"]) != set(streams):
            out.append(f"trial {i}: answer keys {sorted(t['answer'])} != streams {sorted(streams)}")
        for s in streams:
            match = i >= n and values[s][i] == values[s][i - n]
            if t["answer"].get(s) is not match:
                out.append(f"trial {i}: answer.{s} should be {match}")
    return out


# ---------------------------------------------------------------------------------------------
# stroop


def verify_stroop(p: dict) -> list[str]:
    out: list[str] = []
    colors = p["colors"]
    if len(set(colors)) != len(colors):
        out.append("duplicate colours")
    congruent = incongruent = 0
    for i, t in enumerate(p["trials"]):
        if t["answer"] != t["ink"]:
            out.append(f"trial {i}: answer {t['answer']} != ink {t['ink']}")
        if t["ink"] not in colors:
            out.append(f"trial {i}: ink {t['ink']} not among the buttons")
        if t["word"] != t["word"].upper() or t["word"].lower() not in colors:
            out.append(f"trial {i}: word {t['word']} is not an upper-case button colour")
        if t["word"].lower() == t["ink"]:
            congruent += 1
        else:
            incongruent += 1
    if len(p["trials"]) >= 2 and (congruent == 0 or incongruent == 0):
        out.append("a block needs both congruent and incongruent trials (interference cost)")
    return out


# ---------------------------------------------------------------------------------------------
# matrix

MATRIX_ATTRS = ("shape", "count", "color", "rotation_deg")


def glyph_key(g: dict, with_color: bool = True) -> tuple:
    """What a glyph looks like, as rendered by svg.tsx: rotation is folded by the shape's symmetry
    (a circle ignores it, a square turned 45 degrees is a diamond, a triangle repeats every 360)."""
    shape, rot = g["shape"], g["rotation_deg"] % 360
    if shape == "circle":
        look = ("circle", 0)
    elif shape in ("square", "diamond"):
        r = rot % 90
        if r == 45:
            shape, r = ("diamond" if shape == "square" else "square"), 0
        look = (shape, r)
    else:
        look = (shape, rot)
    return (look, g["count"]) + ((g["color"],) if with_color else ())


def _row_values(cells: list, attr: str) -> list[list]:
    return [[None if c is None else c[attr] for c in cells[r * 3 : r * 3 + 3]] for r in range(3)]


def _predict_attr(rows: list[list], attr: str) -> set:
    """Every value the row rules allow for the one missing cell of this attribute."""
    full = [r for r in rows if None not in r]
    part = next(r for r in rows if None in r)
    known = [(c, v) for c, v in enumerate(part) if v is not None]
    preds: set = set()
    # constant in a row
    if all(len(set(r)) == 1 for r in full) and len({v for _, v in known}) == 1:
        preds.add(known[0][1])
    # distribution of three: every row is a permutation of the same three values
    sets = {frozenset(r) for r in full}
    if len(sets) == 1 and all(len(set(r)) == 3 for r in full):
        rest = next(iter(sets)) - {v for _, v in known}
        if len(rest) == 1 and len({v for _, v in known}) == 2:
            preds |= rest
    # progression with one step for every row (numbers; rotation modulo 360)
    if attr in ("count", "rotation_deg"):

        def norm(x: int) -> int:
            return x % 360 if attr == "rotation_deg" else x

        steps = {norm(r[1] - r[0]) for r in full} | {norm(r[2] - r[1]) for r in full}
        if len(steps) == 1 and (d := next(iter(steps))) != 0:
            (c0, v0), (c1, v1) = known
            if norm(v1 - v0) == norm(d * (c1 - c0)):
                miss = next(c for c in range(3) if c not in (c0, c1))
                preds.add(norm(v0 + d * (miss - c0)))
    return preds


def solve_matrix(cells: list, options: list) -> int:
    """Index of the one option the row rules predict. Raises ValueError when the puzzle is
    ambiguous (rules disagree, or zero or several options fit)."""
    if len(cells) != 9 or sum(c is None for c in cells) != 1:
        raise ValueError("a matrix has 9 cells with exactly one empty")
    want: dict[str, Any] = {}
    for attr in MATRIX_ATTRS:
        preds = _predict_attr(_row_values(cells, attr), attr)
        if len(preds) != 1:
            raise ValueError(f"{attr}: the row rules predict {sorted(map(str, preds)) or 'nothing'}")
        want[attr] = preds.pop()
    target = glyph_key(want)
    hits = [k for k, o in enumerate(options) if glyph_key(o) == target]
    if len(hits) != 1:
        raise ValueError(f"{len(hits)} options match the predicted glyph {target}")
    return hits[0]


def colour_only_pairs(options: list) -> list[tuple[int, int]]:
    """Option pairs that look the same once colour is ignored (FE-12)."""
    keys = [glyph_key(o, with_color=False) for o in options]
    return [(a, b) for a, b in combinations(range(len(options)), 2) if keys[a] == keys[b]]


def verify_matrix(p: dict) -> list[str]:
    out: list[str] = []
    try:
        solved = solve_matrix(p["cells"], p["options"])
        if solved != p["answer"]:
            out.append(f"answer {p['answer']} but the rule solver picks {solved}")
    except ValueError as e:
        out.append(f"rule solver: {e}")
    for a, b in colour_only_pairs(p["options"]):
        out.append(f"options {a} and {b} differ by colour alone (FE-12)")
    return out


# ---------------------------------------------------------------------------------------------
# mental rotation


def normalize_cells(cells) -> tuple:
    mx = min(x for x, _ in cells)
    my = min(y for _, y in cells)
    return tuple(sorted((x - mx, y - my) for x, y in cells))


def rotate90(cells, quarter_turns: int) -> list:
    out = list(cells)
    for _ in range(quarter_turns % 4):
        out = [(-y, x) for x, y in out]
    return out


def mirror(cells) -> list:
    return [(-x, y) for x, y in cells]


def rotations(cells) -> set:
    return {normalize_cells(rotate90(cells, q)) for q in range(4)}


def is_chiral(cells) -> bool:
    """True when the mirror image is not a turn of the shape, so 'mirrored' really is different."""
    return normalize_cells(mirror(cells)) not in rotations(cells)


def rotation_answer(cells, angle_deg: int, mirrored: bool) -> str:
    """'same' when the right shape (CellsView: mirror, then turn) is a turn of the left one."""
    shown = rotate90(mirror(cells) if mirrored else cells, angle_deg // 90)
    return "same" if normalize_cells(shown) in rotations(cells) else "different"


def verify_mental_rotation(p: dict) -> list[str]:
    out: list[str] = []
    for i, t in enumerate(p["trials"]):
        cells = [tuple(c) for c in t["cells"]]
        if len(set(cells)) != len(cells):
            out.append(f"trial {i}: repeated cells")
            continue
        if t["angle_deg"] % 90 != 0:
            out.append(f"trial {i}: angle {t['angle_deg']} is not a multiple of 90")
            continue
        want = rotation_answer(cells, int(t["angle_deg"]), t["mirrored"])
        if t["answer"] != want:
            out.append(f"trial {i}: answer {t['answer']} but the geometry says {want}")
    return out


# ---------------------------------------------------------------------------------------------
# relational

EQUIVALENCE = {"same", "opposite"}
ORDERED = {"more": ("more", False), "less": ("more", True), "before": ("before", False), "after": ("before", True)}


def _family(rel: str) -> str:
    if rel in EQUIVALENCE:
        return "equivalence"
    if rel == "contains":
        return "contains"
    return ORDERED[rel][0]


def _reaches(edges: dict, a: str, b: str) -> int | None:
    """Hops on the shortest directed path a -> b, or None."""
    seen, queue = {a: 0}, deque([a])
    while queue:
        x = queue.popleft()
        if x == b:
            return seen[x]
        for y in edges.get(x, ()):
            if y not in seen:
                seen[y] = seen[x] + 1
                queue.append(y)
    return None


def solve_relational(premises: list, question: dict) -> tuple[bool, int]:
    """(truth of the question, hops it takes). Raises ValueError when it is undetermined."""
    fams = {_family(s["rel"]) for s in premises} | {_family(question["rel"])}
    if len(fams) != 1:
        raise ValueError(f"premises and question mix relation families {sorted(fams)}")
    fam = fams.pop()
    a, b = question["a"], question["b"]
    if fam == "equivalence":
        # undirected graph, edge weight 1 for opposite; truth = parity of the path
        adj: dict[str, list] = {}
        for s in premises:
            w = s["rel"] == "opposite"
            adj.setdefault(s["a"], []).append((s["b"], w))
            adj.setdefault(s["b"], []).append((s["a"], w))
        seen = {a: (0, False)}
        queue = deque([a])
        while queue:
            x = queue.popleft()
            for y, w in adj.get(x, ()):
                par = seen[x][1] ^ w
                if y in seen:
                    if seen[y][1] != par:
                        raise ValueError("premises contradict each other")
                    continue
                seen[y] = (seen[x][0] + 1, par)
                queue.append(y)
        if b not in seen:
            raise ValueError("question terms are not linked")
        hops, opposite = seen[b]
        return (opposite == (question["rel"] == "opposite")), hops
    # ordered families: edge x -> y means x is more / before / contains y
    edges: dict[str, list] = {}
    for s in premises:
        x, y = (s["b"], s["a"]) if (s["rel"] in ORDERED and ORDERED[s["rel"]][1]) else (s["a"], s["b"])
        edges.setdefault(x, []).append(y)
    qa, qb = (b, a) if (question["rel"] in ORDERED and ORDERED[question["rel"]][1]) else (a, b)
    forward, backward = _reaches(edges, qa, qb), _reaches(edges, qb, qa)
    if forward is not None and backward is not None:
        raise ValueError("premises form a cycle")
    if forward is None and backward is None:
        raise ValueError("question is undetermined by the premises")
    return (forward is not None), (forward if forward is not None else backward)


def verify_relational(p: dict) -> list[str]:
    out: list[str] = []
    levels = p["levels"]
    if not levels or any(not lv for lv in levels):
        out.append("every level needs at least one item")
    last = 0
    for li, level in enumerate(levels):
        for k, t in enumerate(level):
            where = f"level {li} item {k}"
            terms = [s["a"] for s in t["premises"]] + [s["b"] for s in t["premises"]]
            if any(s["a"] == s["b"] for s in t["premises"] + [t["question"]]):
                out.append(f"{where}: a statement relates a term to itself")
                continue
            try:
                truth, hops = solve_relational(t["premises"], t["question"])
            except ValueError as e:
                out.append(f"{where}: {e}")
                continue
            if t["answer"] != (truth != t["inverted"]):
                out.append(f"{where}: answer {t['answer']} but truth {truth}, inverted {t['inverted']}")
            if t["hops"] != hops or len(t["premises"]) != hops:
                out.append(f"{where}: hops {t['hops']} but the inference takes {hops}")
            if len(set(terms)) != hops + 1:
                out.append(f"{where}: premises use {len(set(terms))} terms for {hops} hops")
        hs = {t["hops"] for t in level}
        if hs and min(hs) < last:
            out.append(f"level {li}: levels must run easiest first")
        last = max(hs, default=last)
    return out


# ---------------------------------------------------------------------------------------------
# tower

State = tuple  # tuple of per-peg tuples, bottom first


def tower_moves(state: State, capacities) -> list[tuple[int, int, State]]:
    out = []
    for f, src in enumerate(state):
        if not src:
            continue
        for t, dst in enumerate(state):
            if t != f and len(dst) < capacities[t]:
                nxt = list(state)
                nxt[f], nxt[t] = src[:-1], dst + (src[-1],)
                out.append((f, t, tuple(nxt)))
    return out


def tower_bfs(start: State, goal: State, capacities) -> int:
    """Minimum number of moves from start to goal (forward breadth-first search)."""
    seen = {start: 0}
    queue = deque([start])
    while queue:
        s = queue.popleft()
        if s == goal:
            return seen[s]
        for _, _, n in tower_moves(s, capacities):
            if n not in seen:
                seen[n] = seen[s] + 1
                queue.append(n)
    raise ValueError("goal unreachable")


def goal_positions(goal: State) -> dict[str, tuple[int, int]]:
    return {d: (peg, h) for peg, stack in enumerate(goal) for h, d in enumerate(stack)}


def counter_intuitive_steps(start: State, goal: State, moves) -> list[int]:
    """Steps that undo or bury a finished part of the goal (design judgement, see tower.py):
    the moved disc (a) leaves its own goal position, or (b) lands on a disc that already sits in
    its goal position while not reaching its own."""
    where = goal_positions(goal)
    state = [list(s) for s in start]
    out = []
    for k, (f, t) in enumerate(moves):
        disc = state[f][-1]
        leaves_goal = where[disc] == (f, len(state[f]) - 1)
        lands = (t, len(state[t]))
        below = state[t][-1] if state[t] else None
        buries = below is not None and where[below] == (t, len(state[t]) - 1) and where[disc] != lands
        if leaves_goal or buries:
            out.append(k)
        state[t].append(state[f].pop())
    return out


def verify_tower(p: dict) -> list[str]:
    out: list[str] = []
    caps = p["capacities"]
    start = tuple(tuple(s) for s in p["start"])
    goal = tuple(tuple(s) for s in p["goal"])
    if not (len(start) == len(goal) == len(caps)):
        return ["start, goal and capacities need one entry per peg"]
    discs = [d for s in start for d in s]
    if len(set(discs)) != len(discs) or sorted(discs) != sorted(d for s in goal for d in s):
        return ["start and goal must hold the same distinct discs"]
    if any(len(s) > c for s, c in zip(start, caps)) or any(len(s) > c for s, c in zip(goal, caps)):
        return ["a stack is over its peg's capacity"]
    try:
        l_min = tower_bfs(start, goal, caps)
    except ValueError as e:
        return [str(e)]
    if p["l_min"] != l_min:
        out.append(f"l_min {p['l_min']} but BFS finds {l_min}")
    state = start
    for k, (f, t) in enumerate(p["optimal_moves"]):
        legal = {(a, b): n for a, b, n in tower_moves(state, caps)}
        if (f, t) not in legal:
            out.append(f"optimal move {k} [{f}, {t}] is illegal")
            return out
        state = legal[(f, t)]
    if state != goal:
        out.append("optimal_moves do not reach the goal")
    if len(p["optimal_moves"]) != l_min:
        out.append(f"optimal_moves has {len(p['optimal_moves'])} moves, BFS says {l_min}")
    want = counter_intuitive_steps(start, goal, p["optimal_moves"])
    if sorted(p["counter_intuitive"]) != want:
        out.append(f"counter_intuitive {p['counter_intuitive']} but the moves give {want}")
    return out


# ---------------------------------------------------------------------------------------------
# ufov


def verify_ufov(p: dict) -> list[str]:
    out: list[str] = []
    grid = p["duration_grid_ms"]
    if not grid or grid != sorted(grid) or len(set(grid)) != len(grid):
        out.append("duration_grid_ms must be non-empty, strictly increasing")
    if not all(0 <= x <= 1 for x in (p["similarity"], p["mask_noise"])):
        out.append("similarity and mask_noise must be in [0, 1]")
    for i, t in enumerate(p["trials"]):
        spots = [(d["dir"], d["ring"]) for d in t["distractors"]]
        if len(set(spots)) != len(spots):
            out.append(f"trial {i}: two distractors share a spot")
        if (t["peripheral_dir"], 2) in spots:  # Ufov.tsx draws the target on ring 2
            out.append(f"trial {i}: a distractor covers the target")
    return out


# ---------------------------------------------------------------------------------------------
# mst

MST_SAME_TOL = 1e-9
MST_NEW_MIN = 0.5  # a "new" item is at least this far from every studied item of its structure
MST_LURE_MARGIN = 0.1  # a lure is this much closer to its source than to any other studied item


def poly_structure(poly: dict) -> tuple:
    return (len(poly["points"]), frozenset(frozenset(e) for e in poly["edges"]))


def poly_distance(a: dict, b: dict) -> float:
    """Largest vertex gap after the framing PolyView applies (bounding box to a unit span).
    Infinite when the two differ in vertex count or edges."""
    if poly_structure(a) != poly_structure(b):
        return float("inf")

    def frame(pts):
        xs, ys = [x for x, _ in pts], [y for _, y in pts]
        span = max(max(xs) - min(xs), max(ys) - min(ys)) or 1.0
        return [((x - min(xs)) / span, (y - min(ys)) / span) for x, y in pts]

    fa, fb = frame(a["points"]), frame(b["points"])
    return max(((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5 for (x1, y1), (x2, y2) in zip(fa, fb))


def verify_mst(p: dict) -> list[str]:
    out: list[str] = []
    encode = p["encode"]
    structures = [poly_structure(e) for e in encode]
    used: set[int] = set()
    for i, t in enumerate(p["test"]):
        item, kind = t["item"], t["kind"]
        shape = poly_structure(item)
        twins = [k for k, s in enumerate(structures) if s == shape]  # the only ones it can match
        exact = [k for k in twins if encode[k] == item]
        if kind == "old":
            if len(exact) != 1:
                out.append(f"test {i}: old item matches {len(exact)} studied items")
                continue
            if t["delta"] != 0:
                out.append(f"test {i}: old item with delta {t['delta']}")
            if exact[0] in used:
                out.append(f"test {i}: studied item {exact[0]} is tested twice")
            used.add(exact[0])
            continue
        if exact:
            out.append(f"test {i}: {kind} item was studied")
            continue
        dists = [poly_distance(item, encode[k]) if k in twins else float("inf") for k in range(len(encode))]
        if kind == "new":
            if t["delta"] != 0:
                out.append(f"test {i}: new item with delta {t['delta']}")
            if min(dists, default=float("inf")) < MST_NEW_MIN:
                out.append(f"test {i}: new item is within {MST_NEW_MIN} of a studied item")
            continue
        # lure: one vertex of one studied item moved by delta
        src = min(range(len(encode)), key=dists.__getitem__) if encode else None
        if src is None or dists[src] == float("inf"):
            out.append(f"test {i}: lure has no studied source")
            continue
        others = [d for k, d in enumerate(dists) if k != src]
        if others and min(others) < dists[src] + MST_LURE_MARGIN:
            out.append(f"test {i}: lure is about as close to another studied item")
        moved = [
            ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5
            for (x1, y1), (x2, y2) in zip(item["points"], encode[src]["points"])
            if (x1, y1) != (x2, y2)
        ]
        if len(moved) != 1:
            out.append(f"test {i}: lure moves {len(moved)} vertices, not 1")
        elif not t["delta"] > 0 or abs(moved[0] - t["delta"]) > 1e-3:
            out.append(f"test {i}: delta {t['delta']} but the vertex moved {moved[0]:.4f}")
        if src in used:
            out.append(f"test {i}: studied item {src} is tested twice")
        used.add(src)
    return out


VERIFIERS: dict[str, Callable[[dict], list[str]]] = {
    "n_back": verify_n_back,
    "stroop": verify_stroop,
    "matrix": verify_matrix,
    "mental_rotation": verify_mental_rotation,
    "relational": verify_relational,
    "tower": verify_tower,
    "ufov": verify_ufov,
    "mst": verify_mst,
}


def verify(payload: dict) -> list[str]:
    """Re-derive every answer of a schema-valid payload; [] when all of them hold."""
    return VERIFIERS[payload["schema_type"]](payload["params"])
