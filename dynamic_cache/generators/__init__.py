"""Procedural task generators (BE-03): one TaskPayload per (schema_type, theta, seed).

    generate(schema_type, theta, seed, **options) -> TaskPayload (a JSON-ready dict)
    generate_block(schema_type, theta, seed) -> list[TaskPayload]

- theta is the difficulty in [0, 1]; seed is an int in [0, 2**32). The same inputs always give
  the same payload, byte for byte.
- Each payload passes dynamic_cache/schema/task_payload.schema.json and the independent solvers
  in solvers.py before it is returned, unless validate=False.
- Length options and their research-backed defaults (the source of each is in its module):

  | schema_type     | option                    | default                         |
  |-----------------|---------------------------|---------------------------------|
  | n_back          | trials                    | 60                              |
  | stroop          | trials, inks              | 96 (48 + 48), "classic"         |
  | matrix          | generate_block size       | 12 items                        |
  | mental_rotation | trials_per_condition      | 50 per angle x 3 angles, blocked |
  | relational      | n_trials, per_level       | 30, n_trials                    |
  | tower           | generate_block            | TOL-F: 2 + 4 practice, 24 test  |
  | ufov            | trials                    | 80                              |
  | mst             | repeats, lures, foils     | 20 / 44 / 20 (oMST)             |
"""

from __future__ import annotations

import random
from typing import Any, Callable

from . import matrix, mental_rotation, mst, n_back, relational, stroop, tower, ufov
from ._common import (
    DIMENSION_OF,
    SCHEMA_TYPES,
    TASK_ID_RE,
    GenerationError,
    canonical_json,
    check_seed,
    check_theta,
    envelope,
    make_rng,
)
from .solvers import verify
from .validate import schema_problems, validate_payload

__all__ = [
    "DIMENSION_OF",
    "SCHEMA_TYPES",
    "TASK_ID_RE",
    "GenerationError",
    "generate",
    "generate_block",
    "schema_problems",
    "validate_payload",
    "verify",
]

BUILDERS: dict[str, Callable[..., dict]] = {
    "n_back": n_back.build,
    "stroop": stroop.build,
    "matrix": matrix.build,
    "mental_rotation": mental_rotation.build,
    "relational": relational.build,
    "tower": tower.build,
    "ufov": ufov.build,
    "mst": mst.build,
}


def _check_schema_type(schema_type: str) -> str:
    if schema_type not in BUILDERS:
        raise ValueError(f"schema_type must be one of {SCHEMA_TYPES}, got {schema_type!r}")
    return schema_type


def _finish(schema_type: str, seed: int, params: dict, tag: str | None, validate: bool) -> dict:
    payload = envelope(schema_type, seed, params, tag)
    if validate:
        problems = validate_payload(payload)
        if problems:
            raise GenerationError(f"{payload['task_id']}: " + "; ".join(problems[:5]))
    return payload


def _build(schema_type: str, rng: random.Random, theta: float, build: Callable[..., dict], **options: Any) -> dict:
    try:
        return build(rng, theta, **options)
    except RuntimeError as e:  # a construction that ran out of tries
        raise GenerationError(f"{schema_type}: {e}") from e


def generate(schema_type: str, theta: float, seed: int, *, validate: bool = True, **options: Any) -> dict:
    """One task payload; options are the schema's length and preset knobs (see the table above)."""
    _check_schema_type(schema_type)
    theta, seed = check_theta(theta), check_seed(seed)
    rng = make_rng(schema_type, theta, seed, canonical_json(options))
    params = _build(schema_type, rng, theta, BUILDERS[schema_type], **options)
    return _finish(schema_type, seed, params, None, validate)


def generate_block(schema_type: str, theta: float, seed: int, *, size: int | None = None, validate: bool = True) -> list[dict]:
    """The payloads that make one block.

    - tower: the TOL-F series, 30 single-problem payloads (theta is not used: the protocol fixes
      the move counts). Tags p00..p05 mark the practice items, t00..t23 the test problems.
    - matrix: `size` single-item payloads (default 12), tagged b00, b01, ...
    - every other schema carries its whole block in one payload, so this returns [generate(...)].
    """
    _check_schema_type(schema_type)
    theta, seed = check_theta(theta), check_seed(seed)
    if schema_type == "tower":
        if size is not None:
            raise ValueError("the TOL-F series has a fixed length")
        used: set = set()
        out = []
        series = [(f"p{k:02d}", n) for k, n in enumerate(tower.PRACTICE)] + [(f"t{k:02d}", n) for k, n in enumerate(tower.TEST)]
        for tag, l_min in series:
            rng = make_rng(schema_type, theta, seed, tag)
            out.append(_finish(schema_type, seed, tower.problem(rng, l_min, used), tag, validate))
        return out
    if schema_type == "matrix":
        n = size if size is not None else matrix.DEFAULT_BLOCK_SIZE
        if isinstance(n, bool) or not isinstance(n, int) or n < 1:
            raise ValueError("size must be an int >= 1")
        out, seen = [], set()
        k = 0
        while len(out) < n:  # distinct items: re-roll the rare duplicate
            tag = f"b{len(out):02d}"
            rng = make_rng(schema_type, theta, seed, f"{tag}|{k}")
            params = _build(schema_type, rng, theta, matrix.build)
            k += 1
            if canonical_json(params) not in seen:
                seen.add(canonical_json(params))
                out.append(_finish(schema_type, seed, params, tag, validate))
        return out
    if size is not None:
        raise ValueError(f"{schema_type} carries its block in one payload; set its length option instead")
    return [generate(schema_type, theta, seed, validate=validate)]
