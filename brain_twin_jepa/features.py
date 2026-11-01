"""Session features: a faithful Python port of the frontend's scorers.

Ports `frontend/src/features/insights/taskScores.ts` (telemetry events -> the doc's 0-100 inputs)
and `pillars.ts` (inputs -> the five pillars and the unified score) as committed in 700af3c (F-B:
Stop Light, Pair Finder and Arrow Focus, with its fix round: PAL is plain FAMS / pal_total and the
Stroop ANT_Conflict fallback is a proxy), which carries ruling R16: n-back is scored on the rule's
stream only (`telemetry/types.ts` NBACK_RULE_STREAM, parity answered on `symbol`).
Every constant, gate and evaluation order matches the TS, so both sides agree to 1e-6 on
`data/fixtures/golden_sessions.json` (generated from the TS by `scripts/golden/make_golden.mjs`).
Neither file rounds: the UI rounds only for display.

Events are the stored JSONL rows (dicts). Pure: the caller passes one session's events, already
deduplicated (`telemetry_io.dedupe`).

Output shapes mirror the TS: an input is `{"score", "trials"}` plus `"proxy": True` for a stand-in;
a pillar is `{"score" (None below MIN_COVERAGE), "uncertainty", "coverage", "proxies"}`.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Iterable, Sequence
from typing import Any

Event = dict[str, Any]

# ---- taskScores.ts ---------------------------------------------------------------------------

# Scale anchors and gates. ASSUMPTIONS to tune against Member 3's data, not evidence, except the
# UFOV range (the payload's duration grid) and Stroop chance (4 inks).
D_PRIME_MAX = 4  # d' 0 -> 0, 4 -> 100
D_PRIME_GATE = 1  # the switch cost counts fully from d' 1
SWITCH_COST_MAX = 0.5  # switch cost 0 -> 100, 0.5 -> 0
STROOP_COST_MAX_MS = 300  # RT cost 0 ms -> 100, 300 ms -> 0
STROOP_CHANCE = 0.25  # red, green, blue, yellow
PLAN_SHARE = 0.8  # OTS_Planning = 0.8 x solved in minimum moves + 0.2 x planning speed
PLAN_TIME_MAX_MS = 30_000  # half of the TOL-F 60 s limit
UFOV_MIN_MS = 17  # one 60 Hz frame
UFOV_MAX_MS = 500  # the top of the UFOV duration grid
SSRT_BEST_MS = 150  # SSRT 150 ms -> 100, 450 ms -> 0
SSRT_WORST_MS = 450
SST_CHANCE = 0.5  # two arrows on the go task
DDM_CAUTION_MAX = 0.25  # boundary a: 0 -> 0, 0.25 -> 100
FLANKER_COST_MAX_MS = 200  # flanker cost 0 ms -> 100, 200 ms -> 0
FLANKER_CHANCE = 0.5  # two arrows
# Exclusion rules of the consensus guide (Verbruggen et al. 2019), evidence, not tuning: outside
# this P(respond | signal) range the integration estimate is unreliable.
SST_P_RESPOND_MIN = 0.25
SST_P_RESPOND_MAX = 0.75

# R16: the stream whose key the rule's hint names (frontend `telemetry/types.ts` NBACK_RULE_STREAM);
# parity is answered with L (symbol).
NBACK_RULE_STREAM = {"position": "position", "symbol": "symbol", "parity": "symbol"}

_MISSING = object()


def _meta(e: Event) -> dict[str, Any]:
    return e.get("trial_meta") or {}


def _is_number(v: Any) -> bool:
    """JS `typeof v === 'number'`: bool is an int in Python but not a number in JS."""
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def schema_of(e: Event) -> str | None:
    """The exercise an event came from, read from its trial_meta signature (unique per exercise).
    Matrix logs no extra keys, so it is the pattern_induction event without relational's `hops`.
    The newer exercises are read first: their keys are their own (Arrow Focus logs `flanker`, never
    Stroop's `congruent`)."""
    m = _meta(e)
    if "stop_trial" in m:
        return "stop_signal"
    if "pal_level" in m:
        return "pal"
    if "flanker" in m:
        return "flanker"
    if "stream" in m:
        return "n_back"
    if "congruent" in m:
        return "stroop"
    if "angle_deg" in m:
        return "mental_rotation"
    if "hops" in m:
        return "relational"
    if "l_min" in m:
        return "tower"
    if "shown_ms" in m or "peripheral_ok" in m:
        return "ufov"
    if "kind" in m:
        return "mst"
    if e.get("dimension") == "pattern_induction":
        return "matrix"
    return None


_A = (-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239)
_B = (-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572)
_C = (-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783)
_D = (0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416)


def probit(p: float) -> float:
    """Inverse standard normal CDF (Acklam's rational approximation, |error| < 1.2e-9)."""
    a0, a1, a2, a3, a4, a5 = _A
    b0, b1, b2, b3, b4 = _B
    c0, c1, c2, c3, c4, c5 = _C
    d0, d1, d2, d3 = _D

    def tail(q: float) -> float:
        return (((((c0 * q + c1) * q + c2) * q + c3) * q + c4) * q + c5) / (
            (((d0 * q + d1) * q + d2) * q + d3) * q + 1
        )

    if p < 0.02425:
        return tail(math.sqrt(-2 * math.log(p)))
    if p > 1 - 0.02425:
        return -tail(math.sqrt(-2 * math.log(1 - p)))
    q = p - 0.5
    r = q * q
    return ((((((a0 * r + a1) * r + a2) * r + a3) * r + a4) * r + a5) * q) / (
        ((((b0 * r + b1) * r + b2) * r + b3) * r + b4) * r + 1
    )


def d_prime(hits: int, n_signal: int, fas: int, n_noise: int) -> float:
    """d' with the log-linear correction on every table (Hautus 1995)."""
    return probit((hits + 0.5) / (n_signal + 1)) - probit((fas + 0.5) / (n_noise + 1))


def ldi(similar_lures: int, n_lures: int, similar_new: int, n_new: int) -> float:
    """Lure Discrimination Index: P("similar" | lure) - P("similar" | new)."""
    return similar_lures / n_lures - similar_new / n_new


def _clamp01(x: float) -> float:
    return min(1, max(0, x))


def _mean(xs: Sequence[float]) -> float:
    total = 0
    for x in xs:  # left to right, as Array.reduce does
        total += x
    return total / len(xs)


def _ok(e: Event) -> bool:
    return not e.get("error_flag")


def _share(es: Sequence[Event], f: Callable[[Event], bool]) -> float:
    return sum(1 for e in es if f(e)) / len(es)


def _num(e: Event, key: str) -> float | None:
    v = _meta(e).get(key)
    return v if _is_number(v) and math.isfinite(v) else None


def _input(fraction: float, trials: int) -> dict[str, Any]:
    return {"score": 100 * _clamp01(fraction), "trials": trials}


def _js_strict_eq(a: Any, b: Any) -> bool:
    """JS `a === b` on JSON values (`_MISSING` is undefined): bool is distinct from number, and
    int 1 equals float 1.0."""
    if a is _MISSING or b is _MISSING or a is None or b is None:
        return a is b
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if _is_number(a) and _is_number(b):
        return a == b
    return type(a) is type(b) and isinstance(a, str) and a == b


def on_rule_stream(e: Event) -> bool:
    """taskScores.ts `onRuleStream`: the n-back event on the stream whose key the rule's hint names
    (NBACK_RULE_STREAM; symbol for parity). An unknown or non-string rule falls back to
    `stream === rule`."""
    m = _meta(e)
    rule = m.get("rule", _MISSING)
    want = NBACK_RULE_STREAM[rule] if isinstance(rule, str) and rule in NBACK_RULE_STREAM else rule
    return _js_strict_eq(m.get("stream", _MISSING), want)


def _rule_stream(nb: Iterable[Event]) -> list[Event]:
    return [e for e in nb if on_rule_stream(e)]


def _is_switch(e: Event) -> bool:
    return _meta(e).get("trial_type") == "switch"


def _is_target(e: Event) -> bool:
    return _meta(e).get("trial_type") == "target"


def _nback_d_prime(nb: Sequence[Event]) -> float | None:
    """d' on the n-back rule stream, switch trials left out. Signal = a rule-stream match (target);
    noise = every other non-switch rule-stream trial. An off-rule press marks the rule event wrong
    (R16), so on a target it is a miss and elsewhere a false alarm. Floored at 0 when the raw hit
    rate is not above the raw false-alarm rate. None without both signal and noise trials."""
    scored = [e for e in _rule_stream(nb) if not _is_switch(e)]
    signal = [e for e in scored if _is_target(e)]
    noise = [e for e in scored if not _is_target(e)]
    if not signal or not noise:
        return None
    hits = sum(1 for e in signal if _ok(e))
    fas = sum(1 for e in noise if not _ok(e))
    if hits / len(signal) <= fas / len(noise):
        return 0
    return max(0, d_prime(hits, len(signal), fas, len(noise)))


def quantile6(sorted_xs: Sequence[float], p: float) -> float:
    """Hyndman & Fan (1996) type-6 sample quantile of ascending `sorted_xs` (R's quantile(type = 6)):
    h = (n + 1) p, interpolated between the order statistics around h, clamped to the ends."""
    n = len(sorted_xs)
    h = (n + 1) * p
    if h <= 1:
        return sorted_xs[0]
    if h >= n:
        return sorted_xs[n - 1]
    lo = math.floor(h)
    return sorted_xs[lo - 1] + (h - lo) * (sorted_xs[lo] - sorted_xs[lo - 1])


def _responded(e: Event) -> bool:
    r = _meta(e).get("response", _MISSING)
    return isinstance(r, str) and r != "none"


def _is_stop_trial(e: Event) -> bool:
    return _meta(e).get("stop_trial", _MISSING) is True


def _is_go_trial(e: Event) -> bool:
    return _meta(e).get("stop_trial", _MISSING) is False


def ssrt(events: Sequence[Event]) -> float | None:
    """Stop-signal reaction time by the integration method with go omissions replaced by the
    slowest go RT (Verbruggen et al. 2019): the type-6 quantile of the go RTs (choice errors
    included) at p = P(respond | signal), minus the mean SSD. None under the guide's exclusion
    rules: no stop trial or go response, a stop trial without a numeric SSD, P(respond | signal)
    outside [0.25, 0.75], or a mean signal-respond RT not below the mean go RT."""
    go = [e for e in events if _is_go_trial(e)]
    stop = [e for e in events if _is_stop_trial(e)]
    go_rts = [e["response_time_ms"] for e in go if _responded(e)]
    ssds = [v for v in (_num(e, "ssd_ms") for e in stop) if v is not None]
    if not stop or not go_rts or len(ssds) != len(stop):
        return None
    p_respond = _share(stop, _responded)
    if p_respond < SST_P_RESPOND_MIN or p_respond > SST_P_RESPOND_MAX:
        return None
    # Race-model check (p_respond >= 0.25 guarantees a signal-respond trial).
    if _mean([e["response_time_ms"] for e in stop if _responded(e)]) >= _mean(go_rts):
        return None
    slowest = max(go_rts)
    dist = sorted(e["response_time_ms"] if _responded(e) else slowest for e in go)
    return quantile6(dist, p_respond) - _mean(ssds)


def _stop_signal_input(ss: Sequence[Event]) -> dict[str, Any] | None:
    """SST_SSRT from Stop Light: SSRT 150 ms -> 100, 450 ms -> 0, times the go gate
    (go accuracy - 1/2) / (1/2). A gate of 0 scores 0; an excluded SSRT gives no input.
    `trials` = stop trials."""
    go = [e for e in ss if _is_go_trial(e)]
    stops = sum(1 for e in ss if _is_stop_trial(e))
    if not stops:
        return None
    gate = _accuracy_gate(go, SST_CHANCE) if go else 0
    if gate == 0:
        return _input(0, stops)
    value = ssrt(ss)
    if value is None:
        return None
    return _input(_clamp01((SSRT_WORST_MS - value) / (SSRT_WORST_MS - SSRT_BEST_MS)) * gate, stops)


def _pal_input(pal: Sequence[Event]) -> dict[str, Any] | None:
    """PAL_FirstTrialMemory from Pair Finder, per task_id: CANTAB's first-attempt memory score,
    right on attempt 1 over pal_total (every pattern, so unreached stages count as missed), with no
    chance correction (a failed stage ends the run, so guessing earns next to nothing); pooled
    weighted by pal_total. A task without pal_total >= 1 on its first event is left out."""
    by_task: dict[Any, list[Event]] = {}
    for e in pal:
        by_task.setdefault(e.get("task_id"), []).append(e)
    total = weighted = 0
    for es in by_task.values():
        n = _num(es[0], "pal_total")
        if n is None or n < 1:
            continue
        # JS `attempt === 1`: a number equal to 1 (1.0 counts), never bool True.
        fams = sum(1 for e in es if _js_strict_eq(_meta(e).get("attempt", _MISSING), 1) and _ok(e))
        total += n
        weighted += n * _clamp01(fams / n)
    return _input(weighted / total, total) if total else None


def _accuracy_gate(es: Sequence[Event], chance: float) -> float:
    """0 at accuracy `chance` or below, 1 at perfect accuracy."""
    return _clamp01((_share(es, _ok) - chance) / (1 - chance))


def _conflict_input(
    es: Sequence[Event],
    is_inc: Callable[[Event], bool],
    is_con: Callable[[Event], bool],
    chance: float,
    cost_max: float,
) -> dict[str, Any] | None:
    """A conflict cost (Stroop, Arrow Focus): mean correct incongruent RT minus mean correct
    congruent RT, 0 ms -> 100, `cost_max` -> 0, clamped, times the accuracy gate over all trials.
    Without a correct trial in either condition: 0 over all trials when the gate is 0, else None."""
    if not es:
        return None
    inc_ok = [e for e in es if is_inc(e) and _ok(e)]
    con_ok = [e for e in es if is_con(e) and _ok(e)]
    gate = _accuracy_gate(es, chance)
    if inc_ok and con_ok:
        cost = _mean([e["response_time_ms"] for e in inc_ok]) - _mean([e["response_time_ms"] for e in con_ok])
        # The RT term is clamped before the gate: a negative cost must not lift a guesser.
        return _input(_clamp01(1 - cost / cost_max) * gate, len(inc_ok) + len(con_ok))
    return _input(0, len(es)) if gate == 0 else None


def _stroop_gate(st: Sequence[Event]) -> float:
    """0 at chance accuracy (1 in 4 inks) or below, 1 at perfect accuracy."""
    return _accuracy_gate(st, STROOP_CHANCE)


def _at_chance(task_events: Sequence[Event]) -> bool:
    schema = schema_of(task_events[0]) if task_events else None
    if schema == "n_back":
        return _nback_d_prime(task_events) == 0
    if schema == "stroop":
        return _stroop_gate(task_events) == 0
    if schema == "flanker":
        return _accuracy_gate(task_events, FLANKER_CHANCE) == 0
    return False


# Exercises whose errors are not the user's to recover from: Stop Light's staircase holds stop
# trials near half wrong by design; in Pair Finder the next pattern is a separate memory.
NO_RECOVERY = frozenset({"stop_signal", "pal"})


def _error_recovery(events: Sequence[Event]) -> dict[str, Any] | None:
    """Accuracy on the trial right after an error, within each task. A trial is wrong when any of
    its events is; for n-back only the rule-stream event (the trial's verdict) is read (R16). Tasks
    played at chance or below (n-back d' 0, Stroop accuracy <= 1 in 4, flanker <= 1 in 2) are left
    out, and so are the NO_RECOVERY exercises (read by the task's first event)."""
    by_task: dict[Any, list[Event]] = {}
    for e in events:
        by_task.setdefault(e.get("task_id"), []).append(e)
    after = recovered = 0
    for task_events in by_task.values():
        if schema_of(task_events[0]) in NO_RECOVERY or _at_chance(task_events):
            continue
        read = _rule_stream(task_events) if schema_of(task_events[0]) == "n_back" else task_events
        trials: dict[Any, bool] = {}
        for e in read:
            idx = e.get("trial_index")
            trials[idx] = trials.get(idx, True) and _ok(e)
        seq = [correct for _, correct in sorted(trials.items(), key=lambda kv: kv[0])]
        for k in range(1, len(seq)):
            if seq[k - 1]:
                continue
            after += 1
            if seq[k]:
                recovered += 1
    return _input(recovered / after, after) if after else None


def ez_diffusion_boundary(trials: Sequence[Event], s: float = 0.1) -> float | None:
    """EZ-diffusion model boundary separation a (Wagenmakers et al. 2007) for speeded 2AFC trials."""
    n = len(trials)
    if n < 6:
        return None
    correct = [e for e in trials if _ok(e)]
    n_correct = len(correct)
    if n_correct == n:
        pc = 1.0 - (1.0 / (2.0 * n))
    elif n_correct == 0:
        pc = 1.0 / (2.0 * n)
    else:
        pc = n_correct / n
    if abs(pc - 0.5) < 1e-5:
        pc = 0.5001 if pc >= 0.5 else 0.4999

    rts_sec = [e.get("response_time_ms", 0.0) / 1000.0 for e in correct]
    if len(rts_sec) > 1:
        m = sum(rts_sec) / len(rts_sec)
        v_rt = sum((x - m) ** 2 for x in rts_sec) / (len(rts_sec) - 1)
    elif len(rts_sec) == 1:
        v_rt = 0.04
    else:
        all_rts = [e.get("response_time_ms", 0.0) / 1000.0 for e in trials]
        m = sum(all_rts) / len(all_rts)
        v_rt = sum((x - m) ** 2 for x in all_rts) / (len(all_rts) - 1) if len(all_rts) > 1 else 0.04
    v_rt = max(v_rt, 1e-4)

    logit_p = math.log(pc / (1.0 - pc))
    sign = 1.0 if pc > 0.5 else -1.0
    num_val = logit_p * (pc * pc * logit_p - pc * logit_p + pc - 0.5)
    inner = max(num_val / v_rt, 1e-6)
    v = sign * s * (inner ** 0.25)
    if abs(v) < 1e-6:
        v = 1e-6 * sign
    return abs((s * s * logit_p) / v)


def task_scores(events: Sequence[Event]) -> dict[str, dict[str, Any]]:
    """One session's events -> the doc's 0-100 inputs (only the inputs that have data)."""
    by: dict[str, list[Event]] = {}
    for e in events:
        s = schema_of(e)
        if s:
            by.setdefault(s, []).append(e)

    def get(s: str) -> list[Event]:
        return by.get(s, [])

    out: dict[str, dict[str, Any]] = {}

    # n-back: d' on the rule stream, switch trials left out (they feed the switch cost).
    nb = get("n_back")
    d = _nback_d_prime(nb)
    rs = _rule_stream(nb)
    if d is not None:
        out["OSPAN"] = _input(d / D_PRIME_MAX, sum(1 for e in rs if not _is_switch(e)))
    # Switch cost: switch trials against the rule stream's non-switch noise trials, gated by d'.
    switches = [e for e in rs if _is_switch(e)]
    quiet = [e for e in rs if not _is_switch(e) and not _is_target(e)]
    if d is not None and switches and quiet:
        cost = _share(quiet, _ok) - _share(switches, _ok)
        out["DCCS_SwitchCost"] = _input(
            (1 - cost / SWITCH_COST_MAX) * _clamp01(d / D_PRIME_GATE), len(switches) + len(quiet)
        )

    # ANT_Conflict: Arrow Focus's flanker cost when the session played it; else Stroop's RT cost,
    # flagged a proxy (both Color Clash fallbacks are proxies). Stroop's incongruent accuracy
    # stands in for SSRT only when Stop Light was not played.
    st = get("stroop")
    inc = [e for e in st if _meta(e).get("congruent", _MISSING) is False]
    fl = get("flanker")
    if fl:
        conflict = _conflict_input(
            fl,
            lambda e: _meta(e).get("flanker") == "incongruent",
            lambda e: _meta(e).get("flanker") == "congruent",
            FLANKER_CHANCE,
            FLANKER_COST_MAX_MS,
        )
    else:
        conflict = _conflict_input(
            st,
            lambda e: _meta(e).get("congruent", _MISSING) is False,
            lambda e: _meta(e).get("congruent", _MISSING) is True,
            STROOP_CHANCE,
            STROOP_COST_MAX_MS,
        )
        if conflict:
            conflict = {**conflict, "proxy": True}
    if conflict:
        out["ANT_Conflict"] = conflict
    ss = get("stop_signal")
    if ss:
        sst = _stop_signal_input(ss)
        if sst:
            out["SST_SSRT"] = sst
    elif inc:
        out["SST_SSRT"] = {**_input(_share(inc, _ok), len(inc)), "proxy": True}

    # Tower: one event per problem.
    tw = [e for e in get("tower") if _num(e, "l_min") is not None and _num(e, "l_user") is not None]
    if tw:

        def solved(e: Event) -> bool:
            return _meta(e).get("solved", _MISSING) is True

        def ratio(e: Event) -> float:
            return min(1, _num(e, "l_min") / max(1, _num(e, "l_user"))) if solved(e) else 0

        out["OTS_Execution"] = _input(_mean([ratio(e) for e in tw]), len(tw))
        perfect = [e for e in tw if solved(e) and _num(e, "l_user") <= _num(e, "l_min")]

        def planning(e: Event) -> float:
            t = _num(e, "planning_time_ms")
            return PLAN_TIME_MAX_MS if t is None else t

        speed = _mean([_clamp01(1 - planning(e) / PLAN_TIME_MAX_MS) for e in perfect]) if perfect else 0
        out["OTS_Planning"] = _input(PLAN_SHARE * (len(perfect) / len(tw)) + (1 - PLAN_SHARE) * speed, len(tw))

    # Matrix accuracy and hop-weighted relational accuracy, averaged.
    mx = get("matrix")
    rel = get("relational")

    def hops(e: Event) -> float:
        h = _num(e, "hops")
        return max(1, 1 if h is None else h)

    parts: list[float] = []
    if mx:
        parts.append(_share(mx, _ok))
    if rel:
        won = total = 0
        for e in rel:
            won += hops(e) if _ok(e) else 0
        for e in rel:
            total += hops(e)
        parts.append(won / total)
    if parts:
        out["FluidMatrices"] = _input(_mean(parts), len(mx) + len(rel))

    # Pair Finder: first-attempt memory over every pattern of the task.
    pal = _pal_input(get("pal"))
    if pal:
        out["PAL_FirstTrialMemory"] = pal

    # MST: a timeout ('none') counts as not "similar".
    ms = get("mst")
    lures = [e for e in ms if _meta(e).get("kind") == "lure"]
    news = [e for e in ms if _meta(e).get("kind") == "new"]

    def similar(e: Event) -> bool:
        return _meta(e).get("response") == "similar"

    if lures and news:
        out["MST_LDI"] = _input(
            ldi(sum(map(similar, lures)), len(lures), sum(map(similar, news)), len(news)), len(lures) + len(news)
        )

    # UFOV: the QUEST threshold rides on each task's last event; several tasks are averaged.
    uf = get("ufov")
    thresholds = [t for t in (_num(e, "quest_threshold_ms") for e in uf) if t is not None]
    if thresholds:
        out["UFOV_SOA"] = _input((UFOV_MAX_MS - _mean(thresholds)) / (UFOV_MAX_MS - UFOV_MIN_MS), len(uf))
    fl_cues = [e for e in fl if _meta(e).get("cue") in ("center", "spatial")]
    if len(fl_cues) >= 8:
        center = [e for e in fl_cues if _meta(e).get("cue") == "center" and _ok(e)]
        spatial = [e for e in fl_cues if _meta(e).get("cue") == "spatial" and _ok(e)]
        if center and spatial:
            orienting_benefit_ms = _mean([_rt(e) for e in center]) - _mean([_rt(e) for e in spatial])
            gate = max(0.0, (_share(fl_cues, _ok) - 0.5) / 0.5)
            fraction = _clamp01(orienting_benefit_ms / 100.0) * gate
            out["ANT_Orienting"] = _input(fraction, len(fl_cues))
    elif uf:
        out["ANT_Orienting"] = _input(_share(uf, lambda e: _meta(e).get("peripheral_ok", _MISSING) is True), len(uf))

    # DDM_Caution: EZ-diffusion boundary separation a on 2AFC speeded decisions (Stop Light go trials,
    # Flanker, Stroop), Wagenmakers et al. 2007.
    speeded = [e for e in ss if _is_go_trial(e)] + fl + st
    speeded = [e for e in speeded if e.get("response_time_ms", 0) > 0]
    if len(speeded) >= 6:
        a = ez_diffusion_boundary(speeded)
        if a is not None:
            out["DDM_Caution"] = _input(a / DDM_CAUTION_MAX, len(speeded))

    recovery = _error_recovery(events)
    if recovery:
        out["ErrorRecovery"] = recovery
    return out


# ---- pillars.ts ------------------------------------------------------------------------------

PILLAR_IDS = ("focus", "agility", "impulse", "memory", "visual")
PILLAR_LABELS = {
    "focus": "Focus & Strategy",
    "agility": "Mental Agility",
    "impulse": "Impulse Control",
    "memory": "Deep Memory",
    "visual": "Visual Radar",
}
INPUT_IDS = (
    "OSPAN",
    "OTS_Planning",
    "OTS_Execution",
    "FluidMatrices",
    "ANT_Conflict",
    "DCCS_SwitchCost",
    "ErrorRecovery",
    "SST_SSRT",
    "DDM_Caution",
    "PAL_FirstTrialMemory",
    "MST_LDI",
    "UFOV_SOA",
    "ANT_Orienting",
)
# The doc's weights, verbatim, in the TS's order (it sets the float summation order).
PILLAR_WEIGHTS: dict[str, dict[str, float]] = {
    "focus": {"OSPAN": 0.45, "OTS_Planning": 0.3, "FluidMatrices": 0.25},
    "agility": {"ANT_Conflict": 0.4, "DCCS_SwitchCost": 0.4, "ErrorRecovery": 0.2},
    "impulse": {"SST_SSRT": 0.5, "OTS_Execution": 0.3, "DDM_Caution": 0.2},
    "memory": {"MST_LDI": 0.55, "PAL_FirstTrialMemory": 0.45},
    "visual": {"UFOV_SOA": 0.5, "ANT_Orienting": 0.5},
}
MIN_COVERAGE = 0.3
MAX_UNCERTAINTY = 50
# Inputs with no source by design: they lower `coverage` but do not widen the band forever.
UNSOURCED_INPUTS = ()


def pillar_scores(inputs: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Every pillar from the inputs that are there, weights renormalised over them. Score is None
    below MIN_COVERAGE. Uncertainty: worst-case binomial SE 50/sqrt(trials) per input, combined with
    the renormalised weights, divided by the sourceable coverage, times 1.96, capped at 50."""
    out: dict[str, dict[str, Any]] = {}
    for pillar in PILLAR_IDS:
        coverage = sourceable = total = 0
        used: list[tuple[float, dict[str, Any]]] = []
        proxies: list[str] = []
        for input_id, w in PILLAR_WEIGHTS[pillar].items():
            if input_id not in UNSOURCED_INPUTS:
                sourceable += w
            inp = inputs.get(input_id)
            if not inp:
                continue
            coverage += w
            total += w * inp["score"]
            used.append((w, inp))
            if inp.get("proxy"):
                proxies.append(input_id)
        uncertainty = MAX_UNCERTAINTY
        if coverage > 0 and all(i["trials"] > 0 for _, i in used):
            variance = 0
            for w, i in used:
                variance += (w / coverage) ** 2 * (2500 / i["trials"])
            uncertainty = min(MAX_UNCERTAINTY, (1.96 * math.sqrt(variance)) / min(1, coverage / sourceable))
        out[pillar] = {
            "score": total / coverage if coverage >= MIN_COVERAGE else None,
            "uncertainty": uncertainty,
            "coverage": coverage,
            "proxies": proxies,
        }
    return out


def unified_score(pillars: dict[str, dict[str, Any]]) -> float | None:
    """The plain mean of the pillars that have a score, or None when none has."""
    scores = [pillars[p]["score"] for p in PILLAR_IDS if pillars[p]["score"] is not None]
    if not scores:
        return None
    total = 0
    for s in scores:
        total += s
    return total / len(scores)


def session_features(events: Sequence[Event]) -> dict[str, Any]:
    """One session's (deduplicated) events -> inputs, pillars and the unified score."""
    inputs = task_scores(events)
    pillars = pillar_scores(inputs)
    return {"inputs": inputs, "pillars": pillars, "unified": unified_score(pillars)}
