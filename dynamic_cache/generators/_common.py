"""Shared pieces of the task generators: seeds, theta, task ids and the payload envelope."""

from __future__ import annotations

import hashlib
import json
import math
import random
import re
from typing import Any

SCHEMA_TYPES: tuple[str, ...] = (
    "n_back",
    "stroop",
    "matrix",
    "mental_rotation",
    "relational",
    "tower",
    "ufov",
    "mst",
)

# The dimension each schema type reports under, as in frontend/.../tasks/fixtures.json and the
# contract table in assessment_engine/README.md.
DIMENSION_OF: dict[str, str] = {
    "n_back": "working_memory",
    "stroop": "executive_function",
    "matrix": "pattern_induction",
    "mental_rotation": "spatial_orientation",
    "relational": "pattern_induction",
    "tower": "executive_function",
    "ufov": "processing_speed",
    "mst": "episodic_memory",
}

# The client's check (taskSource.ts). JS `\w` is ASCII-only, hence re.ASCII.
TASK_ID_RE = re.compile(r"^[\w:.-]{1,48}$", re.ASCII)
SEED_LIMIT = 2**32  # seeds are 0 <= seed < 2**32, so a task id stays well under 48 chars


class GenerationError(RuntimeError):
    """A generator produced a payload its own schema or solver rejects (a bug, not bad input)."""


def check_theta(theta: float) -> float:
    """theta is the difficulty in [0, 1]: 0 is the easiest block, 1 the hardest."""
    if isinstance(theta, bool) or not isinstance(theta, (int, float)):
        raise TypeError("theta must be a number in [0, 1]")
    theta = float(theta)
    if not math.isfinite(theta) or not 0.0 <= theta <= 1.0:
        raise ValueError(f"theta must be in [0, 1], got {theta!r}")
    return theta


def check_seed(seed: int) -> int:
    if isinstance(seed, bool) or not isinstance(seed, int):
        raise TypeError("seed must be an int")
    if not 0 <= seed < SEED_LIMIT:
        raise ValueError(f"seed must be in [0, 2**32), got {seed}")
    return seed


def make_rng(schema_type: str, theta: float, seed: int, salt: str = "") -> random.Random:
    # String seeds are hashed with SHA-512 (Random version 2), so the stream is stable across runs,
    # platforms and Python 3 versions.
    return random.Random(f"{schema_type}|{theta!r}|{seed}|{salt}")


def derive_seed(seed: int, tag: str) -> int:
    """A per-item seed for block members, in the same [0, 2**32) range."""
    digest = hashlib.sha256(f"{seed}|{tag}".encode()).digest()
    return int.from_bytes(digest[:4], "big")


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def make_task_id(schema_type: str, seed: int, params: dict, tag: str | None = None) -> str:
    """`{schema}-{seed}[-{tag}]-{hash}`: the hash covers the params, so equal content gets equal ids
    and different content (other theta or options) never shares one."""
    h = hashlib.sha256(canonical_json(params).encode()).hexdigest()[:10]
    parts = [schema_type, str(seed)] + ([tag] if tag else []) + [h]
    task_id = "-".join(parts)
    if not TASK_ID_RE.match(task_id):  # longest: mental_rotation-4294967295-<10 hex> = 37 chars
        raise GenerationError(f"task_id {task_id!r} breaks ^[\\w:.-]{{1,48}}$")
    return task_id


def envelope(schema_type: str, seed: int, params: dict, tag: str | None = None) -> dict:
    return {
        "task_id": make_task_id(schema_type, seed, params, tag),
        "dimension": DIMENSION_OF[schema_type],
        "schema_type": schema_type,
        "params": params,
        "surface_seed": seed,
    }


def positive_int(name: str, value: Any, minimum: int = 1) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValueError(f"{name} must be an int >= {minimum}, got {value!r}")
    return value
