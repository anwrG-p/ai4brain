"""Colour-word Stroop: every block mixes congruent and incongruent trials."""

from __future__ import annotations

import random

from ._common import positive_int

# Ink sets. Button order is the key order (1..4), so it stays fixed across sessions.
INK_PRESETS: dict[str, tuple[str, ...]] = {
    # Default: the four names Stroop.tsx INK maps to theme tokens today (HANDOVER, Member 5).
    "classic": ("red", "green", "blue", "yellow"),
    # Colour-vision-deficiency-safe set from docs/research/2026-10-31-improvement-opportunities.md
    # §6 improvement 1 ("blue, yellow/orange, red and black/ink"; they differ in luminance and
    # there is no red/green pair). Red/green weakness slowed colour naming in 821 adults
    # (Maastricht study, §6). Yellow is used rather than orange because orange sits between red and
    # yellow in hue; black (the research's "black/ink") takes the fourth slot, and keeps
    # STROOP_CHANCE = 1/4 in taskScores.ts true.
    # Not servable yet: Stroop.tsx INK has no "black" (it falls back to --color-ink, which is light
    # in the dark theme), so the frontend must map it first.
    "cvd_safe": ("blue", "yellow", "red", "black"),
}

# Default length: 96 trials, 48 congruent + 48 incongruent. The research gives no classic-Stroop
# minimum (a 520-614-trial claim was refuted and must not be cited; evidence review 2026-10-30
# §4). The nearest figure is a "double-shot" variant reaching r ~ .8 within about 50 trials
# (Kucina et al. 2023, evidence review §1.1, medium confidence). The RT cost is a difference of two
# condition means, so each condition gets about 50 trials on its own.
DEFAULT_TRIALS = 96
CONGRUENT_SHARE = 0.5


def build(
    rng: random.Random,
    theta: float,
    trials: int = DEFAULT_TRIALS,
    inks: str = "classic",
    congruent_share: float = CONGRUENT_SHARE,
) -> dict:
    trials = positive_int("trials", trials, minimum=2)
    if inks not in INK_PRESETS:
        raise ValueError(f"inks must be one of {sorted(INK_PRESETS)}")
    if not 0 < congruent_share < 1:
        raise ValueError("congruent_share must be strictly between 0 and 1")
    colors = list(INK_PRESETS[inks])
    n_cong = min(trials - 1, max(1, round(trials * congruent_share)))
    n_incong = trials - n_cong

    # Balanced: inks cycle evenly; incongruent trials cycle through every (word, ink) pair.
    cong = [(c, c) for c in (colors * (n_cong // len(colors) + 1))[:n_cong]]
    pairs = [(w, c) for c in colors for w in colors if w != c]
    rng.shuffle(pairs)
    incong = (pairs * (n_incong // len(pairs) + 1))[:n_incong]
    stimuli = cong + incong

    # No stimulus twice in a row (a repeat would prime the answer): reshuffle, then repair.
    rng.shuffle(stimuli)
    for i in range(1, len(stimuli)):
        if stimuli[i] == stimuli[i - 1]:
            j = next((j for j in range(len(stimuli)) if _swap_ok(stimuli, i, j)), None)
            if j is not None:
                stimuli[i], stimuli[j] = stimuli[j], stimuli[i]

    return {
        "colors": colors,
        "trials": [{"word": w.upper(), "ink": c, "answer": c} for w, c in stimuli],
        "time_limit_ms": round(3000 - 1000 * theta),  # 3000 ms (fixture) easy .. 2000 ms hard
    }


def _swap_ok(s: list, i: int, j: int) -> bool:
    """Swapping s[i] and s[j] leaves no equal neighbours around either position."""
    if s[i] == s[j]:
        return False
    t = s[:]
    t[i], t[j] = t[j], t[i]
    return all(t[k] != t[k - 1] for k in {i, i + 1, j, j + 1} if 0 < k < len(t))
