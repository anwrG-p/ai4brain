"""generate(schema_type, theta, seed): valid, solver-checked and deterministic for every schema."""

from __future__ import annotations

import json

import pytest

from dynamic_cache import generators
from dynamic_cache.generators import stroop
from dynamic_cache.generators import (
    DIMENSION_OF,
    SCHEMA_TYPES,
    TASK_ID_RE,
    GenerationError,
    generate,
    generate_block,
    validate_payload,
)
from dynamic_cache.generators.stroop import INK_PRESETS

SEEDS = range(1000)
THETAS = [k / 10 for k in range(11)]


@pytest.mark.parametrize("schema_type", SCHEMA_TYPES)
def test_1000_seeds_pass_schema_and_solvers(schema_type):
    """AC: 1000 seeds per schema validate, and every answer survives its independent solver."""
    failures = []
    ids = set()
    for seed in SEEDS:
        theta = THETAS[seed % len(THETAS)]
        payload = generate(schema_type, theta, seed, validate=False)
        problems = validate_payload(payload)
        if problems:
            failures.append((seed, theta, problems[:3]))
        ids.add(payload["task_id"])
    assert failures == []
    assert len(ids) == len(SEEDS)  # different seeds never share a task id


@pytest.mark.parametrize("schema_type", SCHEMA_TYPES)
def test_deterministic_per_seed(schema_type):
    a = generate(schema_type, 0.3, 42)
    b = generate(schema_type, 0.3, 42)
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
    assert generate(schema_type, 0.3, 43)["params"] != a["params"]


@pytest.mark.parametrize("schema_type", SCHEMA_TYPES)
def test_envelope(schema_type):
    p = generate(schema_type, 1.0, 2**32 - 1)
    assert set(p) == {"task_id", "dimension", "schema_type", "params", "surface_seed"}
    assert p["schema_type"] == schema_type and p["dimension"] == DIMENSION_OF[schema_type]
    assert TASK_ID_RE.match(p["task_id"]) and len(p["task_id"]) <= 48
    assert p["surface_seed"] == 2**32 - 1


def test_dimensions_follow_the_fixtures():
    assert DIMENSION_OF == {
        "n_back": "working_memory",
        "stroop": "executive_function",
        "matrix": "pattern_induction",
        "mental_rotation": "spatial_orientation",
        "relational": "pattern_induction",
        "tower": "executive_function",
        "ufov": "processing_speed",
        "mst": "episodic_memory",
    }


def test_longest_task_id_fits():
    # item_id = "{task_id}:{trial}" must fit the server's 64-char meta string
    for p in generate_block("tower", 0.5, 2**32 - 1) + generate_block("matrix", 0.5, 2**32 - 1):
        assert len(p["task_id"]) <= 48
    assert len(generate("mental_rotation", 0.5, 2**32 - 1)["task_id"]) <= 48


def test_options_change_the_task_id():
    a = generate("stroop", 0.5, 9)
    b = generate("stroop", 0.5, 9, trials=48)
    assert a["task_id"] != b["task_id"]


@pytest.mark.parametrize(
    "args, error",
    [
        (("stroop", -0.1, 1), ValueError),
        (("stroop", 1.5, 1), ValueError),
        (("stroop", float("nan"), 1), ValueError),
        (("stroop", "0.5", 1), TypeError),
        (("stroop", 0.5, -1), ValueError),
        (("stroop", 0.5, 2**32), ValueError),
        (("stroop", 0.5, True), TypeError),
        (("chess", 0.5, 1), ValueError),
    ],
)
def test_bad_inputs(args, error):
    with pytest.raises(error):
        generate(*args)


def test_unknown_option_is_an_error():
    with pytest.raises(TypeError):
        generate("ufov", 0.5, 1, colours=3)


def test_validation_failure_raises(monkeypatch):
    def broken(rng, theta, **kw):
        params = stroop.build(rng, theta, **kw)
        params["trials"][0]["answer"] = "purple"
        return params

    monkeypatch.setitem(generators.BUILDERS, "stroop", broken)
    with pytest.raises(GenerationError):
        generate("stroop", 0.5, 1)


# ---- Stroop inks ------------------------------------------------------------------------------


def test_default_stroop_inks_are_the_four_the_ui_paints():
    """AC: Stroop inks are a subset of {red, green, blue, yellow} (Stroop.tsx INK)."""
    ui = {"red", "green", "blue", "yellow"}
    for seed in range(200):
        p = generate("stroop", (seed % 11) / 10, seed)["params"]
        used = set(p["colors"]) | {t["ink"] for t in p["trials"]} | {t["answer"] for t in p["trials"]}
        assert used <= ui
        assert {t["word"].lower() for t in p["trials"]} <= ui


def test_cvd_safe_preset_drops_the_red_green_pair():
    for seed in range(200):
        p = generate("stroop", 0.5, seed, inks="cvd_safe")
        assert validate_payload(p) == []
        used = set(p["params"]["colors"]) | {t["ink"] for t in p["params"]["trials"]}
        assert used == set(INK_PRESETS["cvd_safe"]) == {"red", "blue", "yellow", "black"}
        assert "green" not in used


def test_unknown_ink_preset():
    with pytest.raises(ValueError):
        generate("stroop", 0.5, 1, inks="pastel")


# ---- theta moves difficulty the right way ----------------------------------------------------


def test_theta_raises_difficulty():
    easy = {s: generate(s, 0.0, 5)["params"] for s in SCHEMA_TYPES}
    hard = {s: generate(s, 1.0, 5)["params"] for s in SCHEMA_TYPES}
    assert (easy["n_back"]["n"], hard["n_back"]["n"]) == (1, 3)
    assert easy["stroop"]["time_limit_ms"] > hard["stroop"]["time_limit_ms"]
    assert len(easy["matrix"]["options"]) < len(hard["matrix"]["options"])
    assert len(easy["mental_rotation"]["trials"][0]["cells"]) < len(hard["mental_rotation"]["trials"][0]["cells"])
    assert len(easy["relational"]["levels"]) < len(hard["relational"]["levels"])
    assert easy["tower"]["l_min"] < hard["tower"]["l_min"]
    assert easy["ufov"]["similarity"] < hard["ufov"]["similarity"]
    assert len(easy["ufov"]["trials"][0]["distractors"]) < len(hard["ufov"]["trials"][0]["distractors"])


def test_matrix_colour_never_varies_alone():
    # colour is never the only rule, so the puzzle never rests on colour (FE-12, WCAG 1.4.1)
    for seed in range(300):
        cells = [c for c in generate("matrix", (seed % 11) / 10, seed)["params"]["cells"] if c]
        non_colour = {(c["shape"], c["count"], c["rotation_deg"]) for c in cells}
        assert len(non_colour) > 1
