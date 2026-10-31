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
    is_chiral,
    rotation_answer,
    solve_matrix,
    solve_relational,
    tower_bfs,
)

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = {
    f["schema_type"]: f
    for f in json.loads((ROOT / "frontend/src/features/assessment/tasks/fixtures.json").read_text(encoding="utf-8"))
}


# ---- the fixtures the UI plays today ----------------------------------------------------------


@pytest.mark.parametrize("schema_type", ["n_back", "stroop", "mental_rotation", "relational", "tower", "ufov"])
def test_solvers_agree_with_the_hand_made_fixtures(schema_type):
    assert verify(FIXTURES[schema_type]) == []


def test_tower_bfs_and_counter_intuitive_reproduce_the_fixture():
    p = FIXTURES["tower"]["params"]
    start = tuple(tuple(s) for s in p["start"])
    goal = tuple(tuple(s) for s in p["goal"])
    assert tower_bfs(start, goal, p["capacities"]) == p["l_min"] == 5
    assert counter_intuitive_steps(start, goal, p["optimal_moves"]) == p["counter_intuitive"] == [2]


def test_matrix_rule_solver_finds_the_fixture_answer_and_flags_fe12():
    p = FIXTURES["matrix"]["params"]
    assert solve_matrix(p["cells"], p["options"]) == p["answer"] == 2
    # the fixture's last two options are both "3 triangles", red vs green: colour alone (FE-12)
    assert colour_only_pairs(p["options"]) == [(2, 3)]
    assert verify(FIXTURES["matrix"]) == ["options 2 and 3 differ by colour alone (FE-12)"]


def test_mst_fixture_is_a_demo_with_approximate_deltas():
    # hand-made: deltas are rounded and one studied figure is tested twice; generated blocks are not
    problems = verify(FIXTURES["mst"])
    assert any("delta 0.15" in x for x in problems) and any("tested twice" in x for x in problems)


# ---- hand cases ------------------------------------------------------------------------------


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


MUTATIONS = {
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


@pytest.mark.parametrize("case", sorted(MUTATIONS))
def test_solvers_catch_a_corrupted_answer(case):
    schema_type, mutate = MUTATIONS[case]
    theta = 1.0 if schema_type in ("n_back", "relational") else 0.5  # n_back: n >= 2; relational: 4 levels
    payload = copy.deepcopy(generate(schema_type, theta, 11) if schema_type != "tower" else generate_block("tower", 0, 11)[-1])
    assert verify(payload) == []
    mutate(payload)
    assert verify(payload), case
