"""BE-12: project(pillars, schema) -> theta is bounded, monotone, honest, and feeds the generators."""

from __future__ import annotations

import itertools
import math

import pytest

from dynamic_cache.generators import SCHEMA_TYPES, generate, validate_payload
from dynamic_cache.parameter_projector import (
    BOUNDS,
    PILLAR_IDS,
    SCHEMA_PILLAR_WEIGHTS,
    START_THETA,
    project,
)

GRID = [0, 10, 25, 50, 75, 90, 100]


@pytest.mark.parametrize("schema_type", SCHEMA_TYPES)
def test_bounded_for_any_input(schema_type):
    lo, hi = BOUNDS[schema_type]
    assert 0.0 <= lo <= hi <= 1.0
    assert lo <= START_THETA[schema_type] <= hi
    odd = [-50, -1, 0, 0.5, 50, 99.9, 100, 101, 1e9, math.nan, math.inf, -math.inf, None]
    for pillar in PILLAR_IDS:
        for value in odd:
            theta = project({p: value if p == pillar else 50 for p in PILLAR_IDS}, schema_type)
            assert theta is None or lo <= theta <= hi, (pillar, value, theta)
            usable = value is not None and math.isfinite(value)
            if SCHEMA_PILLAR_WEIGHTS[schema_type] and (usable or set(SCHEMA_PILLAR_WEIGHTS[schema_type]) != {pillar}):
                assert theta is not None, (pillar, value)


@pytest.mark.parametrize("schema_type", SCHEMA_TYPES)
def test_monotone_in_every_pillar(schema_type):
    """Raising one pillar, the others held anywhere on the grid, never lowers theta."""
    for pillar in PILLAR_IDS:
        others = [p for p in PILLAR_IDS if p != pillar]
        for rest in itertools.product([0, 50, 100], repeat=len(others)):
            base = dict(zip(others, rest))
            thetas = [project(base | {pillar: v}, schema_type) for v in GRID]
            if thetas[0] is None:
                assert all(t is None for t in thetas)
                continue
            assert all(a <= b + 1e-12 for a, b in zip(thetas, thetas[1:])), (pillar, base, thetas)


@pytest.mark.parametrize("schema_type", [s for s in SCHEMA_TYPES if SCHEMA_PILLAR_WEIGHTS[s] and s != "mst"])
def test_relevant_pillars_span_the_whole_range(schema_type):
    assert project({p: 0 for p in PILLAR_IDS}, schema_type) == pytest.approx(BOUNDS[schema_type][0])
    assert project({p: 100 for p in PILLAR_IDS}, schema_type) == pytest.approx(BOUNDS[schema_type][1])
    # Strictly monotone in each pillar that bears on the schema.
    for pillar in SCHEMA_PILLAR_WEIGHTS[schema_type]:
        assert project({pillar: 80}, schema_type) > project({pillar: 20}, schema_type)


def test_irrelevant_pillars_do_not_move_theta():
    assert project({"focus": 60, "memory": 0}, "matrix") == project({"focus": 60, "memory": 100}, "matrix")


def test_no_relevant_score_is_none_not_a_made_up_level():
    assert project(None, "n_back") is None
    assert project({}, "stroop") is None
    assert project({"memory": 90}, "ufov") is None
    assert project({"focus": None, "agility": None}, "n_back") is None
    assert project({p: 50 for p in PILLAR_IDS}, "mental_rotation") is None  # no pillar input


def test_missing_pillars_renormalise_like_pillars_ts():
    assert project({"focus": 80}, "n_back") == pytest.approx(0.8)
    assert project({"focus": 80, "agility": 20}, "n_back") == pytest.approx((0.45 * 80 + 0.40 * 20) / 0.85 / 100)


def test_mst_is_pinned_because_its_generator_ignores_theta():
    assert BOUNDS["mst"] == (0.5, 0.5)
    assert project({"memory": 0}, "mst") == project({"memory": 100}, "mst") == 0.5


def test_unknown_schema_raises():
    with pytest.raises(ValueError):
        project({}, "go_no_go")


@pytest.mark.parametrize("schema_type", SCHEMA_TYPES)
@pytest.mark.parametrize("score", [0, 50, 100])
def test_projection_feeds_the_generators(schema_type, score):
    theta = project({p: score for p in PILLAR_IDS}, schema_type)
    theta = START_THETA[schema_type] if theta is None else theta
    assert validate_payload(generate(schema_type, theta, 1234)) == []
