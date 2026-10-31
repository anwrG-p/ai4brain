"""Dual-stream n-back (3x3 position + centre symbol) with lures and rule switches."""

from __future__ import annotations

import random

from ._common import positive_int

# Default length. The research cites no minimum for n-back: online, overall accuracy and RT
# indices were reliable but per-n-level indices were not (Kulikowski & Potasz-Kulikowska, cited in
# docs/research/2026-10-31-improvement-opportunities.md §1). So one n per block, and 60 trials
# (design judgement) give about 15 rule-stream targets for the d' that pillars use.
DEFAULT_TRIALS = 60
TARGET_RATE = 0.25  # share of rule-stream targets (J); non-rule stream matches at the same rate
STIMULUS_MS = 500  # fixture value
SYMBOLS = "BCDFGHJKLMNPRSTVXZ"  # consonants: no words, no parity reading
SYMBOLS_PER_BLOCK = 8
STREAMS = ("position", "symbol")


def _avoid(values: list, i: int, n: int) -> set:
    """Values that would make trial i a target or a lure on this stream."""
    lags = [n, n + 1] + ([n - 1] if n >= 2 else [])
    return {values[i - lag] for lag in lags if i - lag >= 0}


def _rules(rng: random.Random, trials: int, n: int, switches: int) -> list[str]:
    """Rule per trial: segments of one rule, alternating, each at least n + 4 trials long.
    A switch trial is the first of a segment; the UI shows the new-rule banner on it."""
    rule = rng.choice(STREAMS)
    min_seg = n + 4
    switches = min(switches, max(0, trials // min_seg - 1))
    starts = {b * min_seg for b in rng.sample(range(1, trials // min_seg), switches)} if switches else set()
    out = []
    for i in range(trials):
        if i in starts:
            rule = "symbol" if rule == "position" else "position"
        out.append(rule)
    return out


def build(
    rng: random.Random,
    theta: float,
    trials: int = DEFAULT_TRIALS,
    n: int | None = None,
    lure_rate: float | None = None,
    switches: int | None = None,
) -> dict:
    trials = positive_int("trials", trials)
    n = positive_int("n", n) if n is not None else 1 + round(2 * theta)  # 1..3
    lure_rate = 0.10 + 0.20 * theta if lure_rate is None else lure_rate  # lure density (J)
    if switches is None:
        switches = 0 if theta < 0.5 else 1 if theta < 0.85 else 2
    symbols = rng.sample(SYMBOLS, SYMBOLS_PER_BLOCK)
    domain = {"position": list(range(9)), "symbol": symbols}
    rules = _rules(rng, trials, n, switches)
    values: dict[str, list] = {"position": [], "symbol": []}
    kinds: list[str] = []

    # Each trial is built as one kind on the rule stream, and the value is chosen so that no
    # higher-priority match (target > lure_minus > lure_plus) hides it; solvers.verify_n_back
    # re-classifies the finished sequence on its own.
    for i in range(trials):
        rule = rules[i]
        other = "symbol" if rule == "position" else "position"
        seq = values[rule]
        back = {lag: seq[i - lag] for lag in (n - 1, n, n + 1) if lag >= 1 and i - lag >= 0}
        kind = "switch" if i > 0 and rule != rules[i - 1] else "standard"
        pick = None
        r = rng.random()
        if kind == "standard" and n in back and r < TARGET_RATE:
            kind, pick = "target", back[n]
        elif kind == "standard" and r < TARGET_RATE + lure_rate:
            lags = [lag for lag in (n - 1, n + 1) if lag in back]  # n - 1 only exists for n >= 2
            if lags:
                lag = rng.choice(lags)
                cand = back[lag]
                higher = [back[x] for x in ((n,) if lag == n - 1 else (n, n - 1)) if x in back]
                if cand not in higher:
                    kind, pick = ("lure_minus" if lag == n - 1 else "lure_plus"), cand
        if pick is None:  # standard or switch: no match n-1, n or n+1 back
            pick = rng.choice([v for v in domain[rule] if v not in _avoid(seq, i, n)])
        seq.append(pick)
        kinds.append(kind)
        # the other stream: a match n back at the same rate, otherwise any value
        oseq = values[other]
        if i >= n and rng.random() < TARGET_RATE:
            oseq.append(oseq[i - n])
        else:
            oseq.append(rng.choice(domain[other]))

    out = []
    for i in range(trials):
        p = values["position"][i]
        out.append(
            {
                "pos": [p // 3, p % 3],
                "symbol": values["symbol"][i],
                "rule": rules[i],
                "trial_type": kinds[i],
                "answer": {s: i >= n and values[s][i] == values[s][i - n] for s in STREAMS},
            }
        )
    return {
        "n": n,
        "stimulus_ms": STIMULUS_MS,
        "interval_ms": round(2500 - 500 * theta),  # 2500 ms easy .. 2000 ms (fixture) hard
        "streams": list(STREAMS),
        "trials": out,
    }
