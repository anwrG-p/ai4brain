"""Block designs from the research (assessment_engine/HANDOVER.md "Block designs") and trial counts."""

from __future__ import annotations

from collections import Counter
from itertools import groupby

import pytest

from dynamic_cache.generators import SCHEMA_TYPES, generate, generate_block, validate_payload
from dynamic_cache.parameter_projector import BOUNDS

SEEDS = range(0, 60, 7)


@pytest.mark.parametrize("seed", SEEDS)
def test_stroop_mixes_congruent_and_incongruent(seed):
    trials = generate("stroop", 0.5, seed)["params"]["trials"]
    congruent = [t["word"].lower() == t["ink"] for t in trials]
    assert len(trials) == 96 and congruent.count(True) == 48 and congruent.count(False) == 48
    # balanced inks, and no stimulus twice in a row
    assert set(Counter(t["ink"] for t in trials).values()) == {24}
    assert all((a["word"], a["ink"]) != (b["word"], b["ink"]) for a, b in zip(trials, trials[1:]))


def test_stroop_short_block_still_mixes():
    trials = generate("stroop", 0.5, 1, trials=4)["params"]["trials"]
    assert {t["word"].lower() == t["ink"] for t in trials} == {True, False}


@pytest.mark.parametrize("seed", SEEDS)
def test_mst_follows_the_omst_mix(seed):
    p = generate("mst", 0.5, seed)["params"]
    kinds = Counter(t["kind"] for t in p["test"])
    assert kinds == {"old": 20, "lure": 44, "new": 20}
    assert len(p["encode"]) == 64  # every repeat and every lure source is studied once: 64 + 84 = 148
    bins = Counter(min((0.08, 0.14, 0.20, 0.26), key=lambda b: abs(b - t["delta"])) for t in p["test"] if t["kind"] == "lure")
    assert set(bins.values()) == {11}  # a fixed spread of lure similarity, 4 bins of 11
    assert all(abs(t["delta"] - b) <= 0.002 for t in p["test"] if t["kind"] == "lure" for b in [min((0.08, 0.14, 0.20, 0.26), key=lambda b: abs(b - t["delta"]))])


@pytest.mark.parametrize("seed", SEEDS)
def test_mental_rotation_is_blocked_with_50_per_angle(seed):
    trials = generate("mental_rotation", 0.5, seed)["params"]["trials"]
    runs = [(angle, list(group)) for angle, group in groupby(trials, key=lambda t: t["angle_deg"])]
    assert sorted(a for a, _ in runs) == [0, 90, 180]  # one contiguous run per angle: blocked
    for _, group in runs:
        assert len(group) == 50
        assert sum(t["mirrored"] for t in group) == 25


def test_tower_block_is_the_tol_f_series():
    for seed in SEEDS:
        block = generate_block("tower", 0.5, seed)
        assert [p["params"]["l_min"] for p in block] == [2, 2, 3, 3, 3, 3] + [4] * 8 + [5] * 8 + [6] * 8
        assert all(p["params"]["time_limit_ms"] == 60000 for p in block)
        assert all(validate_payload(p) == [] for p in block)
        problems = {(str(p["params"]["start"]), str(p["params"]["goal"])) for p in block}
        assert len(problems) == 30  # no problem twice in a series
        tags = [p["task_id"].split("-")[2] for p in block]
        assert tags == [f"p{k:02d}" for k in range(6)] + [f"t{k:02d}" for k in range(24)]
        assert len({p["task_id"] for p in block}) == 30


def test_tower_series_has_counter_intuitive_moves():
    block = generate_block("tower", 0.5, 3)
    assert any(p["params"]["counter_intuitive"] for p in block if p["params"]["l_min"] >= 5)


@pytest.mark.parametrize("seed", SEEDS)
def test_matrix_block(seed):
    block = generate_block("matrix", 0.5, seed)
    assert len(block) == 12 and len({p["task_id"] for p in block}) == 12
    assert len({str(p["params"]) for p in block}) == 12
    assert len(generate_block("matrix", 0.5, seed, size=3)) == 3


@pytest.mark.parametrize("seed", SEEDS)
def test_nback_block(seed):
    p = generate("n_back", 1.0, seed)["params"]
    trials = p["trials"]
    assert len(trials) == 60 and p["n"] == 3 and p["streams"] == ["position", "symbol"]
    types = Counter(t["trial_type"] for t in trials)
    assert types["target"] >= 8 and types["lure_minus"] + types["lure_plus"] >= 6
    assert 1 <= types["switch"] <= 2  # rule switches only at high theta, at most 2 per block
    assert Counter(t["trial_type"] for t in generate("n_back", 0.0, seed)["params"]["trials"])["switch"] == 0


@pytest.mark.parametrize("seed", SEEDS)
def test_ufov_block_is_balanced(seed):
    p = generate("ufov", 0.5, seed)["params"]
    assert len(p["trials"]) == 80
    assert set(Counter(t["central"] for t in p["trials"]).values()) == {40}
    assert set(Counter(t["peripheral_dir"] for t in p["trials"]).values()) == {10}
    assert p["duration_grid_ms"][0] == 17 and p["duration_grid_ms"][-1] == 500 and len(p["duration_grid_ms"]) == 10


@pytest.mark.parametrize("seed", SEEDS)
def test_relational_levels_run_easiest_first(seed):
    p = generate("relational", 0.9, seed)["params"]
    assert p["n_trials"] == 30
    assert [{t["hops"] for t in level} for level in p["levels"]] == [{1}, {2}, {3}, {4}]
    assert all(len(level) == 30 for level in p["levels"])  # the staircase can sit on one level all block
    answers = [t["answer"] for level in p["levels"] for t in level]
    assert 0.3 < sum(answers) / len(answers) < 0.7


# ---- the length knob on every generator ---------------------------------------------------------

LENGTH = {
    "n_back": ({"trials": 24}, lambda p: len(p["trials"]) == 24),
    "stroop": ({"trials": 20}, lambda p: len(p["trials"]) == 20),
    "mental_rotation": ({"trials_per_condition": 10}, lambda p: len(p["trials"]) == 30),
    "relational": ({"n_trials": 12, "per_level": 5}, lambda p: p["n_trials"] == 12 and {len(lv) for lv in p["levels"]} == {5}),
    "ufov": ({"trials": 16}, lambda p: len(p["trials"]) == 16),
    "mst": ({"repeats": 3, "lures": 4, "foils": 2}, lambda p: len(p["test"]) == 9 and len(p["encode"]) == 7),
    "tower": ({"l_min": 4}, lambda p: p["l_min"] == 4),
    "matrix": ({"n_options": 5}, lambda p: len(p["options"]) == 5),
    "stop_signal": ({"trials": 64}, lambda p: len(p["trials"]) == 64 and sum(t["stop"] for t in p["trials"]) == 16),
    "pal": ({"stages": [2, 3]}, lambda p: [len(s["items"]) for s in p["stages"]] == [2, 3]),
    "flanker": ({"trials": 32}, lambda p: len(p["trials"]) == 32),
}


# ---- F-B's exercises: the designs their fixtures and research pin --------------------------------


@pytest.mark.parametrize("seed", SEEDS)
def test_stop_signal_follows_the_consensus_guide(seed):
    """200 trials, 25% stops (50, the guide's minimum), spread 2 per 8 trials, opening on go."""
    p = generate("stop_signal", 0.5, seed)["params"]
    trials = p["trials"]
    stops = [t["stop"] for t in trials]
    assert len(trials) == 200 and sum(stops) == 50
    assert all(sum(stops[i : i + 8]) == 2 for i in range(0, 200, 8))
    assert stops[:2] == [False, False]
    assert (p["time_limit_ms"], p["fixation_ms"], p["ssd_start_ms"], p["ssd_step_ms"]) == (1250, 500, 250, 50)
    for kind in (True, False):
        dirs = Counter(t["dir"] for t in trials if t["stop"] is kind)
        assert dirs["left"] == dirs["right"]


@pytest.mark.parametrize("seed", SEEDS)
def test_pal_is_cantab_pal_2_to_8(seed):
    p = generate("pal", 0.5, seed)["params"]
    assert [len(s["items"]) for s in p["stages"]] == [2, 4, 6, 8]  # 20 patterns in all
    assert (p["boxes"], p["study_ms"], p["time_limit_ms"], p["max_attempts"]) == (8, 2000, 20000, 3)
    for s in p["stages"]:
        assert len({x["box"] for x in s["items"]}) == len({x["pattern"] for x in s["items"]}) == len(s["items"])
        assert sorted(s["recall"]) == list(range(len(s["items"]))) != s["recall"]


@pytest.mark.parametrize("seed", SEEDS)
def test_flanker_is_one_ant_block(seed):
    trials = generate("flanker", 0.5, seed)["params"]["trials"]
    assert len(trials) == 96
    assert set(Counter((t["dir"], t["congruent"]) for t in trials).values()) == {24}
    assert max(len(list(g)) for _, g in groupby((t["dir"], t["congruent"]) for t in trials)) <= 3


@pytest.mark.parametrize("schema_type", ["mst", "stop_signal", "pal", "flanker"])
def test_fixed_designs_ignore_theta(schema_type):
    # the protocol fixes these blocks (only the shuffle follows the seed), so the dispatcher pins
    # them to one theta level
    def design(theta):
        p = generate(schema_type, theta, 6)["params"]
        return {k: v for k, v in p.items() if k not in ("trials", "stages", "encode", "test")}

    assert design(0.0) == design(1.0)
    assert BOUNDS[schema_type] == (0.5, 0.5)


def test_every_schema_has_a_length_or_size_knob():
    assert set(LENGTH) == set(SCHEMA_TYPES)


@pytest.mark.parametrize("schema_type", SCHEMA_TYPES)
def test_length_option(schema_type):
    options, check = LENGTH[schema_type]
    payload = generate(schema_type, 0.5, 8, **options)
    assert check(payload["params"]) and validate_payload(payload) == []


@pytest.mark.parametrize(
    "schema_type", ["n_back", "stroop", "mental_rotation", "relational", "ufov", "mst", "stop_signal", "pal", "flanker"]
)
def test_single_payload_blocks(schema_type):
    assert generate_block(schema_type, 0.5, 4) == [generate(schema_type, 0.5, 4)]
    with pytest.raises(ValueError):
        generate_block(schema_type, 0.5, 4, size=3)
