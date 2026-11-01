"""generate(schema_type, theta, seed): valid, solver-checked and deterministic for every schema."""

from __future__ import annotations

import functools
import hashlib
import json
import sys

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
    @functools.wraps(stroop.build)  # keep the signature: options are read from it
    def broken(rng, theta, **kw):
        params = stroop.build(rng, theta, **kw)
        params["trials"][0]["answer"] = "purple"
        return params

    monkeypatch.setitem(generators.BUILDERS, "stroop", broken)
    with pytest.raises(GenerationError):
        generate("stroop", 0.5, 1)


def test_stroop_raises_when_a_repeat_cannot_be_repaired(monkeypatch):
    monkeypatch.setattr(stroop, "_swap_ok", lambda s, i, j: False)  # the repair never finds a swap
    with pytest.raises(GenerationError, match="repeated stimulus"):
        generate("stroop", 0.5, 1)


# ---- options: defaults merged before seeding, values checked ------------------------------------


@pytest.mark.parametrize(
    "schema_type, defaults",
    [
        ("stroop", {"trials": 96, "inks": "classic", "congruent_share": 0.5}),
        ("n_back", {"trials": 60, "n": None, "lure_rate": None, "switches": None}),
        ("mental_rotation", {"trials_per_condition": 50, "angles": [0, 90, 180]}),
        ("relational", {"n_trials": 30, "per_level": None}),
        ("ufov", {"trials": 80}),
        ("mst", {"repeats": 20, "lures": 44, "foils": 20}),
        ("matrix", {"n_options": None}),
        ("tower", {"l_min": None}),
    ],
)
def test_explicit_defaults_give_the_same_payload(schema_type, defaults):
    assert generate(schema_type, 0.4, 77, **defaults) == generate(schema_type, 0.4, 77)


BAD_OPTIONS = [
    ("n_back", {"lure_rate": 1.5}),
    ("n_back", {"lure_rate": -0.1}),
    ("n_back", {"lure_rate": True}),
    ("n_back", {"trials": 501}),
    ("n_back", {"n": 0}),
    ("stroop", {"trials": 10_000}),
    ("stroop", {"trials": 1}),
    ("stroop", {"congruent_share": 1.0}),
    ("mental_rotation", {"trials_per_condition": 501}),
    ("mental_rotation", {"angles": (0, 45)}),
    ("relational", {"n_trials": 501}),
    ("relational", {"per_level": 501}),
    ("relational", {"n_trials": 0}),
    ("ufov", {"trials": 501}),
    ("ufov", {"trials": 2.5}),
    ("mst", {"repeats": 501}),
    ("mst", {"lures": 501}),
    ("mst", {"foils": 501}),
    ("mst", {"repeats": 0, "lures": 0}),
    ("matrix", {"n_options": 9}),
    ("tower", {"l_min": 9}),
]


@pytest.mark.parametrize("schema_type, options", BAD_OPTIONS)
def test_bad_options_raise_value_error(schema_type, options):
    with pytest.raises(ValueError):
        generate(schema_type, 0.5, 1, **options)


def test_matrix_block_size_is_capped():
    with pytest.raises(ValueError):
        generate_block("matrix", 0.5, 1, size=501)


def test_tower_series_does_not_depend_on_theta():
    assert generate_block("tower", 0.0, 21) == generate_block("tower", 1.0, 21)


# ---- golden hashes: any byte that moves fails here -----------------------------------------------

# sha256 of the canonical JSON (sorted keys, no spaces) of each payload, recorded on CPython 3.13.
# A deliberate generator change updates these; an accidental one (or a Python upgrade) fails here.
# relational re-recorded by BE-13: rude words and slurs added to relational.BLOCKED.
GOLDEN = {
    ("n_back", 0.7, 1234): "34a3a50704119d8c5db669306d71d0416672be33fa27db9febdbac5338e4c57e",
    ("stroop", 0.2, 1234): "7677a711e33a13f579f8109adf59a971ee4023bb4f9a6341a57023bd7aa38955",
    ("matrix", 0.9, 1234): "e99e4214c0cde962d03777630f95eb99728e112dcdac7ef7a9024847a2b966b5",
    ("mental_rotation", 0.5, 1234): "6e62a67140812fd466395cd8222a1c272ce4669121ab08d3be0517a83e677ed4",
    ("relational", 0.6, 1234): "fc5d2c48df9f2fea63f5e07e1698a80243bffbf9d6efc04b295d1d7c00d0bd3c",
    ("tower", 0.8, 1234): "2543b49a61d34ee545922a48ae2148edd3ee701b9bcdb81f83e302ed8382073c",
    ("ufov", 0.3, 1234): "8ca4404deca466190f006a5b266d179093937b2925d42fbe2bf0239407a04714",
    ("mst", 0.5, 1234): "1e345dc5e1c56015d0168aa36948a22049426731c13fc2a7665706dac67612dc",
}
GOLDEN_BLOCKS = {
    ("tower", 1234): "c8c828321d06f0a2cafb5f5a8b0b40ee4fb42bf1442a64e3fa8a1d2ee11ef031",
    ("matrix", 1234): "53fbe8ab8bcd60bd7d6e9579f92a136651f8193ba1c8cfe56839efafa606006e",
}


def _digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


@pytest.mark.skipif(sys.version_info[:2] != (3, 13), reason="byte-stability is promised on CPython 3.13 only")
def test_golden_payload_hashes():
    got = {key: _digest(generate(*key)) for key in GOLDEN}
    got_blocks = {key: _digest(generate_block(key[0], 0.5, key[1])) for key in GOLDEN_BLOCKS}
    assert got == GOLDEN
    assert got_blocks == GOLDEN_BLOCKS


# ---- Stroop inks ------------------------------------------------------------------------------


def test_default_stroop_inks_are_the_four_the_ui_paints():
    """AC: Stroop inks are a subset of {red, green, blue, yellow} (Stroop.tsx INK)."""
    ui = {"red", "green", "blue", "yellow"}
    for seed in range(200):
        p = generate("stroop", (seed % 11) / 10, seed)["params"]
        used = set(p["colors"]) | {t["ink"] for t in p["trials"]} | {t["answer"] for t in p["trials"]}
        assert used <= ui
        assert {t["word"].lower() for t in p["trials"]} <= ui


def test_cvd_safe_needs_an_explicit_opt_in():
    with pytest.raises(ValueError, match="allow_unserved"):
        generate("stroop", 0.5, 1, inks="cvd_safe")
    p = generate("stroop", 0.5, 1, inks="cvd_safe", allow_unserved=True)
    assert validate_payload(p)  # the served gate still refuses it: black is not painted by the UI
    assert validate_payload(p, allow_unserved=True) == []


def test_cvd_safe_preset_drops_the_red_green_pair():
    for seed in range(200):
        p = generate("stroop", 0.5, seed, inks="cvd_safe", allow_unserved=True)
        assert validate_payload(p, allow_unserved=True) == []
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
