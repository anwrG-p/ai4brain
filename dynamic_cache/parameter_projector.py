"""Parameter projector (BE-12): a user's pillar scores -> the generator difficulty theta, per schema.

Interim mapping until the brain twin (BE-10) gives a latent mu_k: theta is a linear map of the
weighted mean of the pillar scores that bear on the schema, clipped to the schema's bounds. Each
generator (BE-03) turns theta into its concrete knobs (n-back level, time limits, distractor count,
tower moves, ...), so this module only picks the scalar.

Properties the tests hold it to:
- bounded: lo <= theta <= hi for every schema, whatever the input;
- monotone: raising any pillar score never lowers theta (each weight is >= 0);
- honest: no relevant pillar score -> None, never a made-up level (R15). The dispatcher then starts
  from START_THETA, a design prior, and the 85% rule walks it from the user's own accuracy.
"""

from __future__ import annotations

import math
from collections.abc import Mapping

from .generators import SCHEMA_TYPES

PILLAR_IDS: tuple[str, ...] = ("focus", "agility", "impulse", "memory", "visual")

# Which pillar inputs each schema feeds, with the doc's weights (frontend pillars.ts PILLAR_WEIGHTS):
#   n_back: OSPAN (focus .45), DCCS_SwitchCost (agility .40)
#   stroop: ANT_Conflict (agility .40), SST_SSRT proxy (impulse .50)
#   tower:  OTS_Planning (focus .30), OTS_Execution (impulse .30)
#   matrix, relational: FluidMatrices (focus .25)
#   mst:    MST_LDI (memory .55)
#   ufov:   UFOV_SOA (visual .50), ANT_Orienting (visual .50)
#   mental_rotation: no pillar input, so no projection (None).
#   stop_signal: SST_SSRT (impulse .50); pal: PAL_FirstTrialMemory (memory .45);
#   flanker: ANT_Conflict (agility .40). Their theta is pinned (BOUNDS), so this only matters if
#   one of them ever takes a difficulty knob.
# ErrorRecovery reads every exercise, so it informs no single schema and is left out.
SCHEMA_PILLAR_WEIGHTS: dict[str, dict[str, float]] = {
    "stop_signal": {"impulse": 0.50},
    "pal": {"memory": 0.45},
    "flanker": {"agility": 0.40},
    "n_back": {"focus": 0.45, "agility": 0.40},
    "stroop": {"agility": 0.40, "impulse": 0.50},
    "tower": {"focus": 0.30, "impulse": 0.30},
    "matrix": {"focus": 0.25},
    "relational": {"focus": 0.25},
    "mst": {"memory": 0.55},
    "ufov": {"visual": 1.00},
    "mental_rotation": {},
}

# Per-schema theta bounds. Every generator already maps [0, 1] onto its designed range (n-back
# n 1..3, tower 2..6 moves, ufov 2..16 distractors, ...), so the bounds are the full range, except
# the fixed designs: their generators ignore theta (MST's oMST delta spread, Stop Light's guide
# design with its in-block SSD staircase, Pair Finder's CANTAB stage series, Arrow Focus's ANT
# block), so each is pinned to one level and its pool never splits by difficulty.
FIXED_DESIGNS = ("mst", "stop_signal", "pal", "flanker")
BOUNDS: dict[str, tuple[float, float]] = {s: (0.0, 1.0) for s in SCHEMA_TYPES} | {s: (0.5, 0.5) for s in FIXED_DESIGNS}

# (A) Where a schema starts when nothing is known about the user: the middle of its range, the
# usual starting point of an adaptive staircase. A design prior, not an estimate of the user.
START_THETA: dict[str, float] = {s: (lo + hi) / 2 for s, (lo, hi) in BOUNDS.items()}


def clamp(schema_type: str, theta: float) -> float:
    lo, hi = BOUNDS[schema_type]
    return min(hi, max(lo, theta))


def project(pillars: Mapping[str, float | None] | None, schema_type: str) -> float | None:
    """theta for `schema_type` from 0-100 pillar scores, or None when no relevant score is known.

    Missing or None pillars are left out and the weights renormalise over the rest (as pillars.ts
    does). Scores outside 0..100 are clipped; a non-finite score counts as missing.
    """
    if schema_type not in BOUNDS:
        raise ValueError(f"schema_type must be one of {SCHEMA_TYPES}, got {schema_type!r}")
    total = weight = 0.0
    for pillar, w in SCHEMA_PILLAR_WEIGHTS[schema_type].items():
        score = (pillars or {}).get(pillar)
        if score is None or isinstance(score, bool) or not math.isfinite(score):
            continue
        total += w * min(100.0, max(0.0, float(score)))
        weight += w
    if weight == 0.0:
        return None
    lo, hi = BOUNDS[schema_type]
    return clamp(schema_type, lo + (hi - lo) * (total / weight) / 100.0)  # clamp: float rounding
