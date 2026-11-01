"""The independent solvers: they reproduce the hand-made fixtures and catch every wrong answer."""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from dynamic_cache.generators import generate, generate_block, verify
from dynamic_cache.generators.solvers import (
    colour_only_pairs,
    counter_intuitive_steps,
    flanker_row,
    is_chiral,
    pal_answers,
    poly_distance,
    poly_structure,
    rotation_answer,
    solve_matrix,
    solve_relational,
    sst_replay,
    tower_bfs,
)

ROOT = Path(__file__).resolve().parents[2]
FIXTURE_FILE = ROOT / "frontend" / "src" / "features" / "assessment" / "tasks" / "fixtures.json"


@pytest.fixture(scope="module")
def fixtures() -> dict:
    # the frontend is absent from an installed package or a backend-only checkout: skip, don't fail
    if not FIXTURE_FILE.is_file():
        pytest.skip("frontend/ is not present")
    return {f["schema_type"]: f for f in json.loads(FIXTURE_FILE.read_text(encoding="utf-8"))}


# ---- the fixtures the UI plays today ----------------------------------------------------------


@pytest.mark.parametrize(
    "schema_type", ["n_back", "stroop", "mental_rotation", "relational", "tower", "ufov", "stop_signal", "pal", "flanker"]
)
def test_solvers_agree_with_the_hand_made_fixtures(fixtures, schema_type):
    assert verify(fixtures[schema_type]) == []


def test_new_exercise_solvers_by_hand():
    # Flanker.tsx draws LLRLL for an incongruent right trial; the answer is the middle arrow
    assert flanker_row({"dir": "right", "congruent": False}) == ["left", "left", "right", "left", "left"]
    assert flanker_row({"dir": "left", "congruent": True}) == ["left"] * 5
    # Pair Finder: the recall step asks for the box its pattern was studied in
    stage = {"items": [{"pattern": 5, "box": 2}, {"pattern": 1, "box": 7}], "recall": [1, 0]}
    assert pal_answers(stage) == [7, 2]
    # Stop Light's staircase (StopSignal.tsx nextSsd): +50 after a stop, -50 after a failed one, >= 0
    p = {"ssd_start_ms": 50, "ssd_step_ms": 50, "time_limit_ms": 1250}
    assert sst_replay(p, [False, False, True, True, True]) == [50, 100, 150, 100, 50]
    assert sst_replay(p, [True, True]) == [50, 0]


def test_tower_bfs_and_counter_intuitive_reproduce_the_fixture(fixtures):
    p = fixtures["tower"]["params"]
    start = tuple(tuple(s) for s in p["start"])
    goal = tuple(tuple(s) for s in p["goal"])
    assert tower_bfs(start, goal, p["capacities"]) == p["l_min"] == 5
    assert counter_intuitive_steps(start, goal, p["optimal_moves"]) == p["counter_intuitive"] == [2]


def test_matrix_rule_solver_finds_the_fixture_answer_and_flags_fe12(fixtures):
    p = fixtures["matrix"]["params"]
    assert solve_matrix(p["cells"], p["options"]) == p["answer"] == 2
    # the fixture's last two options are both "3 triangles", red vs green: colour alone (FE-12)
    assert colour_only_pairs(p["options"]) == [(2, 3)]
    assert verify(fixtures["matrix"]) == ["options 2 and 3 differ by colour alone (FE-12)"]


def test_mst_fixture_is_a_demo_with_approximate_deltas(fixtures):
    # hand-made: deltas are rounded and one studied figure is tested twice; generated blocks are not
    problems = verify(fixtures["mst"])
    assert any("delta 0.15" in x for x in problems) and any("tested twice" in x for x in problems)


# ---- hand cases ------------------------------------------------------------------------------


def test_poly_structure_by_hand():
    tri = {"points": [[0, 0], [1, 0], [0, 1]], "edges": [[0, 1], [1, 2]]}
    # edges are undirected and unordered; the vertex count is part of the structure
    assert poly_structure(tri) == (3, frozenset({frozenset({0, 1}), frozenset({1, 2})}))
    assert poly_structure({**tri, "edges": [[2, 1], [1, 0]]}) == poly_structure(tri)
    assert poly_structure({**tri, "edges": [[0, 1], [0, 2]]}) != poly_structure(tri)
    assert poly_structure({"points": tri["points"] + [[1, 1]], "edges": tri["edges"]}) != poly_structure(tri)


def test_poly_distance_by_hand():
    a = {"points": [[0.0, 0.0], [1.0, 0.0], [0.0, 1.0]], "edges": [[0, 1], [1, 2]]}
    # translated and scaled copies are the same picture once PolyView frames them: distance 0
    b = {"points": [[0.2, 0.2], [0.6, 0.2], [0.2, 0.6]], "edges": [[0, 1], [1, 2]]}
    assert poly_distance(a, b) == pytest.approx(0.0)
    # moving vertex 2 from (0, 1) to (0.5, 1) keeps the 1x1 box: the largest vertex gap is 0.5
    c = {"points": [[0.0, 0.0], [1.0, 0.0], [0.5, 1.0]], "edges": [[0, 1], [1, 2]]}
    assert poly_distance(a, c) == pytest.approx(0.5)
    # (0, 1) -> (1, 1): gap 1.0 on vertex 2, box unchanged
    d = {"points": [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0]], "edges": [[0, 1], [1, 2]]}
    assert poly_distance(a, d) == pytest.approx(1.0)
    # a box of 2 x 1 is framed by its larger side: (0,0),(2,0),(0,1) -> (0,0),(1,0),(0,0.5)
    e = {"points": [[0.0, 0.0], [2.0, 0.0], [0.0, 1.0]], "edges": [[0, 1], [1, 2]]}
    assert poly_distance(a, e) == pytest.approx(0.5)
    # other edges: a different figure, never a lure of this one
    assert poly_distance(a, {**a, "edges": [[0, 1], [0, 2]]}) == float("inf")


def test_matrix_solver_rejects_an_ambiguous_puzzle():
    g = lambda shape, count: {"shape": shape, "count": count, "color": "blue", "rotation_deg": 0}  # noqa: E731
    # rows 1 and 2 disagree on the count rule, so no single rule predicts the gap
    cells = [g("circle", 1), g("circle", 2), g("circle", 3), g("circle", 3), g("circle", 1), g("circle", 1), g("circle", 2), g("circle", 2), None]
    with pytest.raises(ValueError):
        solve_matrix(cells, [g("circle", 1), g("circle", 2)])


def test_matrix_glyph_look_folds_rotation():
    sq = {"shape": "square", "count": 1, "color": "red", "rotation_deg": 45}
    di = {"shape": "diamond", "count": 1, "color": "red", "rotation_deg": 0}
    circ = {"shape": "circle", "count": 1, "color": "red", "rotation_deg": 0}
    assert colour_only_pairs([sq, di]) == [(0, 1)]  # a square turned 45 degrees is a diamond
    assert colour_only_pairs([circ, {**circ, "rotation_deg": 90, "color": "blue"}]) == [(0, 1)]


def test_rotation_geometry():
    l_piece = [(0, 0), (1, 0), (2, 0), (2, 1)]
    square = [(0, 0), (1, 0), (0, 1), (1, 1)]
    assert is_chiral(l_piece) and not is_chiral(square)
    assert rotation_answer(l_piece, 90, False) == "same"
    assert rotation_answer(l_piece, 180, True) == "different"
    assert rotation_answer(square, 90, True) == "same"  # a mirrored square is still a turn of it


def test_relational_solver():
    s = lambda a, rel, b: {"a": a, "rel": rel, "b": b}  # noqa: E731
    assert solve_relational([s("x", "opposite", "y"), s("y", "opposite", "z")], s("x", "same", "z")) == (True, 2)
    assert solve_relational([s("x", "more", "y"), s("z", "less", "y")], s("z", "more", "x")) == (False, 2)
    assert solve_relational([s("x", "before", "y")], s("y", "after", "x")) == (True, 1)
    assert solve_relational([s("x", "contains", "y"), s("y", "contains", "z")], s("z", "contains", "x")) == (False, 2)
    with pytest.raises(ValueError):  # x and z are both more than y: their order is unknown
        solve_relational([s("x", "more", "y"), s("z", "more", "y")], s("x", "more", "z"))
    with pytest.raises(ValueError):  # a comparison question over temporal premises
        solve_relational([s("x", "before", "y")], s("x", "more", "y"))


# ---- every wrong answer is caught (mutation tests over generated payloads) -------------------


def _flip_nback(p):
    t = p["params"]["trials"][-1]
    t["answer"]["position"] = not t["answer"]["position"]


def _relabel_nback(p):
    t = next(t for t in p["params"]["trials"] if t["trial_type"] == "target")
    t["trial_type"] = "standard"


def _stroop_answer_word(p):
    t = next(t for t in p["params"]["trials"] if t["word"].lower() != t["ink"])
    t["answer"] = t["word"].lower()


def _stroop_all_congruent(p):
    for t in p["params"]["trials"]:
        t["word"] = t["ink"].upper()


def _matrix_wrong_index(p):
    p["params"]["answer"] = (p["params"]["answer"] + 1) % len(p["params"]["options"])


def _matrix_colour_twin(p):
    a = p["params"]["options"][p["params"]["answer"]]
    k = (p["params"]["answer"] + 1) % len(p["params"]["options"])
    p["params"]["options"][k] = {**a, "color": next(c for c in ("blue", "red", "green", "yellow") if c != a["color"])}


def _rotation_flip(p):
    t = p["params"]["trials"][0]
    t["answer"] = "same" if t["answer"] == "different" else "different"


def _rotation_symmetric_mirror(p):
    t = next(t for t in p["params"]["trials"] if t["mirrored"])
    t["cells"] = [[0, 0], [1, 0], [2, 0], [1, 1]]  # the T piece: a mirror image is a turn


def _relational_flip(p):
    t = p["params"]["levels"][1][0]
    t["answer"] = not t["answer"]


def _relational_hops(p):
    p["params"]["levels"][2][0]["hops"] = 1


def _tower_l_min(p):
    p["params"]["l_min"] += 1


def _tower_suboptimal(p):
    p["params"]["optimal_moves"] = p["params"]["optimal_moves"][:-1]


def _tower_ci(p):
    ci = p["params"]["counter_intuitive"]
    p["params"]["counter_intuitive"] = ci[:-1] if ci else [0]


def _ufov_cover_target(p):
    t = p["params"]["trials"][0]
    t["distractors"][0] = {"dir": t["peripheral_dir"], "ring": 2}


def _mst_old_kind(p):
    t = next(t for t in p["params"]["test"] if t["kind"] == "new")
    t["kind"] = "old"


def _mst_delta(p):
    t = next(t for t in p["params"]["test"] if t["kind"] == "lure")
    t["delta"] = round(t["delta"] + 0.05, 3)


def _mst_lure_is_studied(p):
    t = next(t for t in p["params"]["test"] if t["kind"] == "old")
    t["kind"] = "lure"
    t["delta"] = 0.1


def _sst_open_on_stop(p):
    p["params"]["trials"][0]["stop"] = True


def _sst_three_stops(p):
    for t in p["params"]["trials"][10:13]:
        t["stop"] = True


def _sst_all_stops_left(p):
    for t in p["params"]["trials"]:
        if t["stop"]:
            t["dir"] = "left"


def _sst_ssd_after_window(p):
    p["params"]["ssd_start_ms"] = p["params"]["time_limit_ms"]


def _sst_too_many_stops(p):
    for t in p["params"]["trials"][2::2]:
        t["stop"] = True


def _pal_shared_box(p):
    items = p["params"]["stages"][1]["items"]
    items[1]["box"] = items[0]["box"]


def _pal_pattern_twice(p):
    items = p["params"]["stages"][2]["items"]
    items[1]["pattern"] = items[0]["pattern"]


def _pal_recall_in_study_order(p):
    stage = p["params"]["stages"][3]
    stage["recall"] = list(range(len(stage["items"])))


def _pal_recall_skips_one(p):
    stage = p["params"]["stages"][1]
    stage["recall"][0] = stage["recall"][1]


def _pal_box_off_board(p):
    p["params"]["boxes"] = 4  # stage 4 has 8 patterns in boxes up to 7


def _flanker_unbalanced(p):
    t = next(t for t in p["params"]["trials"] if t["congruent"])
    t["congruent"] = False


def _flanker_long_run(p):
    trials = p["params"]["trials"]
    trials[20:24] = [dict(trials[20]) for _ in range(4)]


MUTATIONS = {
    "stop_signal opens on a stop": ("stop_signal", _sst_open_on_stop),
    "stop_signal three stops in a row": ("stop_signal", _sst_three_stops),
    "stop_signal stop arrows all left": ("stop_signal", _sst_all_stops_left),
    "stop_signal first SSD after the go window": ("stop_signal", _sst_ssd_after_window),
    "stop_signal stops are half the block": ("stop_signal", _sst_too_many_stops),
    "pal two patterns in one box": ("pal", _pal_shared_box),
    "pal pattern shown twice": ("pal", _pal_pattern_twice),
    "pal recall repeats study order": ("pal", _pal_recall_in_study_order),
    "pal recall skips a pattern": ("pal", _pal_recall_skips_one),
    "pal box beyond the board": ("pal", _pal_box_off_board),
    "flanker cells unbalanced": ("flanker", _flanker_unbalanced),
    "flanker one cell 4 times running": ("flanker", _flanker_long_run),
    "n_back answer flipped": ("n_back", _flip_nback),
    "n_back target labelled standard": ("n_back", _relabel_nback),
    "stroop answer is the word": ("stroop", _stroop_answer_word),
    "stroop no incongruent trial": ("stroop", _stroop_all_congruent),
    "matrix wrong index": ("matrix", _matrix_wrong_index),
    "matrix colour-only distractor": ("matrix", _matrix_colour_twin),
    "rotation answer flipped": ("mental_rotation", _rotation_flip),
    "rotation achiral mirrored shape": ("mental_rotation", _rotation_symmetric_mirror),
    "relational answer flipped": ("relational", _relational_flip),
    "relational hops wrong": ("relational", _relational_hops),
    "tower l_min wrong": ("tower", _tower_l_min),
    "tower path does not reach goal": ("tower", _tower_suboptimal),
    "tower counter_intuitive wrong": ("tower", _tower_ci),
    "ufov distractor on target": ("ufov", _ufov_cover_target),
    "mst new item labelled old": ("mst", _mst_old_kind),
    "mst lure delta wrong": ("mst", _mst_delta),
    "mst studied item labelled lure": ("mst", _mst_lure_is_studied),
}


def _nback_switch_with_match(p):
    trials, n = p["params"]["trials"], p["params"]["n"]
    i = next(i for i, t in enumerate(trials) if t["trial_type"] == "switch")
    key = {"position": "pos", "symbol": "symbol"}[trials[i]["rule"]]
    trials[i][key] = trials[i - n][key]  # a hidden target on the rule stream
    trials[i]["answer"][trials[i]["rule"]] = True  # keep the answer honest: only the switch rule breaks


def _stroop_repeat(p):
    p["params"]["trials"][1] = dict(p["params"]["trials"][0])


@pytest.mark.parametrize(
    "schema_type, mutate, message",
    [
        ("n_back", _nback_switch_with_match, "switch trial holds a rule-stream match"),
        ("stroop", _stroop_repeat, "same stimulus as the trial before"),
    ],
)
def test_solver_rules_for_switch_and_repeat(schema_type, mutate, message):
    payload = copy.deepcopy(generate(schema_type, 1.0, 11))
    assert verify(payload) == []
    mutate(payload)
    assert any(message in x for x in verify(payload))


@pytest.mark.parametrize("case", sorted(MUTATIONS))
def test_solvers_catch_a_corrupted_answer(case):
    schema_type, mutate = MUTATIONS[case]
    theta = 1.0 if schema_type in ("n_back", "relational") else 0.5  # n_back: n >= 2; relational: 4 levels
    payload = copy.deepcopy(generate(schema_type, theta, 11) if schema_type != "tower" else generate_block("tower", 0, 11)[-1])
    assert verify(payload) == []
    mutate(payload)
    assert verify(payload), case
