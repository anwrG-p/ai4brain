"""Relational reasoning over nonsense words, as staircase levels of 1..4 hops (easiest first)."""

from __future__ import annotations

import random

from ._common import positive_int

# Length. The research cites no minimum for relational reasoning (design judgement): 30 trials on
# Relational.tsx's 85% staircase. Each level holds n_trials items, so no item repeats however long
# the staircase stays on one level.
DEFAULT_TRIALS = 30
TIME_LIMIT_MS = 15000  # fixture value

CONSONANTS = "bdfgjklmnprstvwz"
VOWELS = "aeiou"
# Real or rude CVC words the nonsense tokens must not spell.
BLOCKED = {
    "bad", "bed", "big", "bit", "bug", "bum", "but", "dad", "did", "dig", "fat", "fit", "fun", "gag",
    "god", "gun", "gut", "jaw", "job", "kid", "kil", "kit", "lad", "lip", "lot", "mad", "man", "map",
    "men", "mob", "mom", "mud", "nag", "nap", "net", "nut", "pat", "pen", "pet", "pig", "pit", "pot",
    "pub", "rat", "rib", "rob", "rot", "rub", "sad", "sat", "set", "sex", "sin", "sit", "sob", "sod",
    "sum", "sun", "tab", "tan", "tap", "ten", "tip", "top", "tub", "vet", "wet", "wig", "win", "wit",
    "zip",
}


def _token(rng: random.Random, taken: set) -> str:
    while True:
        w = rng.choice(CONSONANTS) + rng.choice(VOWELS) + rng.choice(CONSONANTS)
        if w not in taken and w not in BLOCKED:
            taken.add(w)
            return w


def _item(rng: random.Random, hops: int, theta: float) -> dict:
    taken: set = set()
    t = [_token(rng, taken) for _ in range(hops + 1)]
    family = rng.choice(("equivalence", "comparison", "temporal", "contains"))
    flip = theta * 0.5  # chance a premise is stated the other way round (b less a)
    premises = []
    if family == "equivalence":
        opposite = False
        for j in range(hops):
            rel = rng.choice(("same", "opposite"))
            opposite ^= rel == "opposite"
            a, b = (t[j], t[j + 1]) if rng.random() >= flip else (t[j + 1], t[j])
            premises.append({"a": a, "rel": rel, "b": b})
        ends = (t[0], t[-1]) if rng.random() < 0.5 else (t[-1], t[0])
        truth = rng.random() < 0.5
        rel = ("opposite" if opposite else "same") if truth else ("same" if opposite else "opposite")
        question = {"a": ends[0], "rel": rel, "b": ends[1]}
    else:
        # the chain runs t0 > t1 > ... (more / before / contains)
        fwd, back = {"comparison": ("more", "less"), "temporal": ("before", "after"), "contains": ("contains", None)}[family]
        for j in range(hops):
            if back and rng.random() < flip:
                premises.append({"a": t[j + 1], "rel": back, "b": t[j]})
            else:
                premises.append({"a": t[j], "rel": fwd, "b": t[j + 1]})
        truth = rng.random() < 0.5
        if not back:  # "contains" has no inverse word: a false question swaps the terms
            question = {"a": t[0], "rel": fwd, "b": t[-1]} if truth else {"a": t[-1], "rel": fwd, "b": t[0]}
        elif rng.random() < 0.5:
            question = {"a": t[0], "rel": fwd if truth else back, "b": t[-1]}
        else:
            question = {"a": t[-1], "rel": back if truth else fwd, "b": t[0]}
    if rng.random() < theta:  # harder: premises out of chain order
        rng.shuffle(premises)
    inverted = rng.random() < 0.15 + 0.2 * theta
    return {"premises": premises, "question": question, "inverted": inverted, "hops": hops, "answer": truth != inverted}


def build(rng: random.Random, theta: float, n_trials: int = DEFAULT_TRIALS, per_level: int | None = None) -> dict:
    n_trials = positive_int("n_trials", n_trials)
    per_level = positive_int("per_level", per_level) if per_level is not None else n_trials
    top = 3 if theta < 0.5 else 4  # levels are 1..top hops
    levels = [[_item(rng, hops, theta) for _ in range(per_level)] for hops in range(1, top + 1)]
    return {"n_trials": n_trials, "time_limit_ms": TIME_LIMIT_MS, "levels": levels}
