"""Procedural task generators (BE-03): one TaskPayload per (schema_type, theta, seed).

    generate(schema_type, theta, seed, **options) -> TaskPayload (a JSON-ready dict)
    generate_block(schema_type, theta, seed) -> list[TaskPayload]
    validate_payload(payload) -> list[str]   # [] = servable

- theta is the difficulty in [0, 1]; seed is an int in [0, 2**32).
- Determinism: equal inputs give an equal payload. Byte-identical output is promised only on one
  CPython minor version (3.13, the CI pin); tests/test_generators.py::test_golden_payload_hashes
  fails if a change (ours or Python's) moves any byte.
- Options are merged with the builder's defaults before seeding, so passing a default explicitly
  gives the same payload and task_id as leaving it out. Unknown options raise TypeError; options out
  of range (lengths above MAX_TRIALS = 500, rates outside [0, 1]) raise ValueError. MAX_TRIALS caps
  each length option on its own, not the block: an MST block with repeats, lures and foils at 500
  each is accepted.
- Each payload passes task_payload.schema.json (package data, next to this file) and the solvers in
  solvers.py before it is returned, unless validate=False.
- Content the UI cannot show yet (the cvd_safe Stroop inks) needs allow_unserved=True and is
  checked against a non-served schema; never serve it.

Calling from a server: generation is synchronous and CPU-bound (an MST block, the slowest type, takes
about 4 ms to build and about 7 ms with validation, median on a dev laptop with CPython 3.13; far
more for a whole pool). Never call it inside an `async def` route: it blocks the event loop. Use a
plain `def` route (FastAPI runs those in a thread pool), `run_in_threadpool`, or a background worker
that fills pools ahead of time (BE-04's dispatcher).

Length options and their defaults (the source of each is in its module):

  | schema_type     | option                    | default                          |
  |-----------------|---------------------------|----------------------------------|
  | n_back          | trials                    | 60                               |
  | stroop          | trials, inks              | 96 (48 + 48), "classic"          |
  | matrix          | generate_block size       | 12 items                         |
  | mental_rotation | trials_per_condition      | 50 per angle x 3 angles, blocked |
  | relational      | n_trials, per_level       | 30, n_trials                     |
  | tower           | generate_block            | TOL-F shape: 2 + 4 practice, 24 test |
  | ufov            | trials                    | 80                               |
  | mst             | repeats, lures, foils     | 20 / 44 / 20 (oMST)              |
"""

from __future__ import annotations

import inspect
import random
from typing import Any, Callable

from . import matrix, mental_rotation, mst, n_back, relational, stroop, tower, ufov
from ._common import (
    DIMENSION_OF,
    MAX_TRIALS,
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
    "MAX_TRIALS",
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


def _merged_options(build: Callable[..., dict], options: dict[str, Any]) -> dict[str, Any]:
    """Every option the builder takes (after rng and theta), defaults filled in."""
    params = list(inspect.signature(build).parameters.values())[2:]
    unknown = set(options) - {p.name for p in params}
    if unknown:
        raise TypeError(f"unknown option(s) {sorted(unknown)}; this schema takes {[p.name for p in params]}")
    return {p.name: options.get(p.name, p.default) for p in params}


def _finish(schema_type: str, seed: int, params: dict, tag: str | None, validate: bool, allow_unserved: bool = False) -> dict:
    payload = envelope(schema_type, seed, params, tag)
    if validate:
        problems = validate_payload(payload, allow_unserved=allow_unserved)
        if problems:
            raise GenerationError(f"{payload['task_id']}: " + "; ".join(problems[:5]))
    return payload


def _build(schema_type: str, rng: random.Random, theta: float, build: Callable[..., dict], **options: Any) -> dict:
    try:
        return build(rng, theta, **options)
    except RuntimeError as e:  # a construction that ran out of tries (GenerationError included)
        raise GenerationError(f"{schema_type}: {e}") from e


def generate(
    schema_type: str,
    theta: float,
    seed: int,
    *,
    validate: bool = True,
    allow_unserved: bool = False,
    **options: Any,
) -> dict:
    """One task payload; options are the schema's length and preset knobs (see the table above)."""
    _check_schema_type(schema_type)
    theta, seed = check_theta(theta), check_seed(seed)
    build = BUILDERS[schema_type]
    merged = _merged_options(build, options)
    if schema_type == "stroop" and merged["inks"] in stroop.UNSERVED_PRESETS and not allow_unserved:
        raise ValueError(f"inks={merged['inks']!r} is not servable until Stroop.tsx maps its inks; pass allow_unserved=True to build it anyway")
    rng = make_rng(schema_type, theta, seed, canonical_json(merged))
    params = _build(schema_type, rng, theta, build, **merged)
    return _finish(schema_type, seed, params, None, validate, allow_unserved)


def generate_block(schema_type: str, theta: float, seed: int, *, size: int | None = None, validate: bool = True) -> list[dict]:
    """The payloads that make one block.

    - tower: a TOL-F-shaped series, 30 single-problem payloads. theta is checked but not used:
      the protocol fixes the move counts, so neither the problems nor the seeding depend on it.
      Tags p00..p05 mark the practice items, t00..t23 the test problems.
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
            rng = make_rng(schema_type, "tol-f", seed, tag)  # no theta: the series is the same at any theta
            out.append(_finish(schema_type, seed, tower.problem(rng, l_min, used), tag, validate))
        return out
    if schema_type == "matrix":
        n = size if size is not None else matrix.DEFAULT_BLOCK_SIZE
        if isinstance(n, bool) or not isinstance(n, int) or not 1 <= n <= MAX_TRIALS:
            raise ValueError(f"size must be an int in [1, {MAX_TRIALS}]")
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
