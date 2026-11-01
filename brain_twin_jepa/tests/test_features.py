"""BE-07: the Python port matches the TS scorers on the shared golden vectors."""

import json
import math
from pathlib import Path

import pytest

from app.api.routes.v1_telemetry import TelemetryEvent
from brain_twin_jepa import features
from brain_twin_jepa.features import (
    d_prime,
    on_rule_stream,
    probit,
    schema_of,
    session_features,
    task_scores,
)
from brain_twin_jepa.telemetry_io import dedupe

GOLDEN = Path(__file__).resolve().parents[2] / "data" / "fixtures" / "golden_sessions.json"
DATA = json.loads(GOLDEN.read_text(encoding="utf-8"))
TOL = DATA["tolerance"]
CASES = {c["name"]: c for c in DATA["cases"]}


def close(a, b):
    if a is None or b is None:
        return a is b
    return math.isclose(a, b, rel_tol=0, abs_tol=TOL)


@pytest.mark.parametrize("name", list(CASES))
def test_golden_case_matches_the_ts(name):
    case = CASES[name]
    expected = case["expected"]
    unique = dedupe(case["events"])
    assert len(unique) == expected["unique_events"]
    got = session_features(unique)

    assert list(got["inputs"]) == list(expected["inputs"])  # same inputs, same order
    for input_id, want in expected["inputs"].items():
        have = got["inputs"][input_id]
        assert close(have["score"], want["score"]), (input_id, have, want)
        assert have["trials"] == want["trials"], input_id
        assert have.get("proxy") == want.get("proxy"), input_id

    assert list(got["pillars"]) == list(expected["pillars"])
    for pillar, want in expected["pillars"].items():
        have = got["pillars"][pillar]
        assert close(have["score"], want["score"]), (pillar, have, want)
        assert close(have["uncertainty"], want["uncertainty"]), pillar
        assert close(have["coverage"], want["coverage"]), pillar
        assert have["proxies"] == want["proxies"], pillar

    assert close(got["unified"], expected["unified"])


def test_golden_set_covers_every_schema_and_the_edge_cases():
    assert len(CASES) == 32
    schemas = {schema_of(e) for c in DATA["cases"] for e in c["events"]}
    assert schemas == {
        "n_back", "stroop", "mental_rotation", "relational", "tower", "ufov", "mst", "matrix",
        "stop_signal", "pal", "flanker",
    }  # fmt: skip
    assert CASES["empty"]["events"] == []
    # F-B's new exercises: the SSRT exclusions, the PAL stage cut-off and the flanker precedence.
    assert "SST_SSRT" not in CASES["stop_signal_race_violation"]["expected"]["inputs"]
    assert "SST_SSRT" not in CASES["stop_signal_all_respond"]["expected"]["inputs"]
    assert CASES["stop_signal_nonresponder"]["expected"]["inputs"]["SST_SSRT"]["score"] == 0
    assert "proxy" not in CASES["full_session_new_exercises"]["expected"]["inputs"]["SST_SSRT"]
    assert CASES["flanker_at_chance"]["expected"]["inputs"]["ANT_Conflict"]["score"] == 0
    # F-B's fix round: the Stroop fallback of ANT_Conflict is a proxy, the flanker cost is not.
    assert CASES["stroop"]["expected"]["inputs"]["ANT_Conflict"]["proxy"] is True
    assert "proxy" not in CASES["flanker_over_stroop"]["expected"]["inputs"]["ANT_Conflict"]
    assert CASES["stroop_at_chance"]["expected"]["inputs"]["ANT_Conflict"]["score"] == 0
    assert CASES["nback_chance_nonresponder"]["expected"]["inputs"]["OSPAN"]["score"] == 0
    dup = CASES["duplicates"]
    assert len(dup["events"]) > dup["expected"]["unique_events"]
    rules = {e["trial_meta"].get("rule") for c in DATA["cases"] for e in c["events"]}
    assert "parity" in rules


def test_golden_events_are_contract_valid():
    for case in DATA["cases"]:
        for e in case["events"]:
            TelemetryEvent.model_validate(e)


def test_duplicates_are_counted_once():
    events = CASES["duplicates"]["events"]
    raw = task_scores(events)
    once = task_scores(dedupe(events))
    # Without the dedupe the repeats would be scored twice and the trial counts inflated.
    assert raw != once
    assert sum(i["trials"] for i in raw.values()) > sum(i["trials"] for i in once.values())
    # Deduping is idempotent and drops exactly the repeated rows.
    assert dedupe(dedupe(events)) == dedupe(events)
    assert len(events) - len(dedupe(events)) == 32


def _nb(i, rule, stream, trial_type, ok=True, task="t"):
    return {
        "session_id": "s",
        "task_id": task,
        "trial_index": i,
        "dimension": "working_memory",
        "error_flag": not ok,
        "response_time_ms": 500,
        "trial_meta": {"item_id": f"{task}:{i}", "trial_type": trial_type, "rule": rule, "stream": stream},
    }


def test_nback_streams_of_one_trial_are_not_duplicates():
    a = _nb(0, "position", "position", "target")
    b = _nb(0, "position", "symbol", "standard")
    assert dedupe([a, b, dict(a)]) == [a, b]
    # Keys compare as the JS JSON.stringify key does: stream true is not stream 1, 1 is 1.0.
    t = _nb(1, True, True, "target")
    one = _nb(1, True, 1, "standard")
    one_f = _nb(1, True, 1.0, "standard")
    assert dedupe([t, one, one_f]) == [t, one]


def test_r16_parity_is_scored_on_the_symbol_stream():
    events = []
    for i in range(8):
        target = i % 2 == 0
        events.append(_nb(i, "parity", "position", "standard", ok=True))
        events.append(_nb(i, "parity", "symbol", "target" if target else "standard", ok=i != 0))
    scores = task_scores(events)
    # 8 symbol-stream events scored (the position stream is off-rule); 3 of 4 hits, no false alarm.
    assert scores["OSPAN"]["trials"] == 8
    assert scores["OSPAN"]["score"] == pytest.approx(100 * d_prime(3, 4, 0, 4) / 4)


def test_r16_offrule_press_on_a_target_is_a_miss_not_a_false_alarm():
    # Trial 1 is a target whose rule event is wrong because the off-rule key was pressed.
    events = [
        *[_nb(0, "position", s, "standard") for s in ("position", "symbol")],
        _nb(1, "position", "position", "target", ok=False),
        _nb(1, "position", "symbol", "lure_stream", ok=False),
        *[_nb(2, "position", s, t) for s, t in (("position", "target"), ("symbol", "standard"))],
        *[_nb(3, "position", s, "standard") for s in ("position", "symbol")],
    ]
    scores = task_scores(events)
    assert scores["OSPAN"]["score"] == pytest.approx(100 * d_prime(1, 2, 0, 2) / 4)


def test_r16_error_recovery_reads_only_the_rule_stream():
    events = []
    for i in range(6):
        events.append(_nb(i, "symbol", "symbol", "target" if i % 2 else "standard", ok=i != 2))
        events.append(_nb(i, "symbol", "position", "standard", ok=i % 2 == 0))  # off-rule errors
    rec = task_scores(events)["ErrorRecovery"]
    assert rec == {"score": 100, "trials": 1}  # only trial 2 was an error; trial 3 recovered


def test_probit_and_number_rules():
    assert probit(0.5) == 0
    assert probit(0.975) == pytest.approx(1.959963985, abs=1e-8)
    assert probit(0.01) == pytest.approx(-2.326347874, abs=1e-8)
    # A bool is not a number (JS typeof): hops=True falls back to 1.
    e = {"task_id": "r", "trial_index": 0, "dimension": "pattern_induction", "error_flag": False,
         "trial_meta": {"hops": True}}
    assert features._num(e, "hops") is None


def test_unknown_rule_falls_back_to_stream_equals_rule_with_js_strict_equality():
    def e(rule, stream):
        return {"trial_meta": {"rule": rule, "stream": stream}}

    assert on_rule_stream(e("parity", "symbol"))
    assert not on_rule_stream(e("parity", "parity"))
    assert on_rule_stream(e("shape", "shape"))  # not in NBACK_RULE_STREAM: stream === rule
    assert not on_rule_stream(e("shape", "position"))
    assert on_rule_stream(e(1, 1)) and on_rule_stream(e(1, 1.0))  # 1 === 1.0 in JS
    assert not on_rule_stream(e(True, 1)) and not on_rule_stream(e(1, True))  # bool !== number
    assert on_rule_stream(e(True, True))
    assert on_rule_stream(e("toString", "toString"))  # own keys only (Object.hasOwn): falls back
    assert not on_rule_stream({"trial_meta": {"stream": "position"}})  # undefined rule


def test_error_recovery_skips_stroop_at_chance_but_counts_the_nback():
    case = CASES["error_recovery_stroop_chance_nback_counted"]
    stroop = [e for e in case["events"] if e["task_id"] == "stx"]
    nback = [e for e in case["events"] if e["task_id"] == "nbx"]
    # Alone, the at-chance Stroop task gives no ErrorRecovery although it has error -> correct pairs.
    assert "ErrorRecovery" not in task_scores(stroop)
    alone = task_scores(nback)["ErrorRecovery"]
    together = task_scores(case["events"])["ErrorRecovery"]
    assert together == alone == {"score": pytest.approx(200 / 3), "trials": 3}


# ---- F-B's exercises: the parts the golden cases do not pin by themselves ------------------------


def _pal(i, attempt, ok, task="pa", total=4, boxes=8):
    return {
        "task_id": task,
        "trial_index": i,
        "dimension": "episodic_memory",
        "error_flag": not ok,
        "response_time_ms": 1500,
        "trial_meta": {"pal_level": 2, "attempt": attempt, "pattern": i, "box": i, "chosen": i,
                       "pal_total": total, "boxes": boxes},
    }  # fmt: skip


def test_pal_attempt_one_is_a_number_never_bool_true():
    # JS `attempt === 1`: 1 and 1.0 count, True (== 1 in Python) does not.
    events = [_pal(0, 1, True), _pal(1, 1.0, True), _pal(2, True, True), _pal(3, 2, True)]
    # plain FAMS / pal_total, no chance correction (F-B fix round)
    assert task_scores(events)["PAL_FirstTrialMemory"] == {"score": pytest.approx(100 * 2 / 4), "trials": 4}


def test_pal_skips_a_task_without_a_valid_total():
    bad = [_pal(0, 1, True, task="a", total=0), _pal(0, 1, True, task="b", total=True)]
    assert "PAL_FirstTrialMemory" not in task_scores(bad)
    assert task_scores([_pal(0, 1, True, boxes=1)])["PAL_FirstTrialMemory"]["trials"] == 4  # boxes unread
    # PAL and Stop Light errors are not the user's to recover from (NO_RECOVERY).
    misses = [_pal(i, 1, i % 2 == 0) for i in range(4)]
    assert "ErrorRecovery" not in task_scores(misses)


def test_quantile6_is_r_type_6():
    xs = [1.0, 2.0, 3.0, 4.0]
    assert features.quantile6(xs, 0.5) == 2.5  # R: quantile(1:4, .5, type = 6)
    assert features.quantile6(xs, 0.1) == 1.0  # h <= 1: the first
    assert features.quantile6(xs, 0.95) == 4.0  # h >= n: the last
    assert features.quantile6(xs, 0.3) == pytest.approx(1.5)  # h = 1.5


def test_stop_signal_needs_a_numeric_ssd_on_every_stop_trial():
    def ev(i, stop, response, rt):
        meta = {"stop_trial": stop, "dir": "left", "response": response}
        if stop:
            meta["ssd_ms"] = 200
        wrong = response != "none" if stop else response != "left"
        return {"task_id": "ss", "trial_index": i, "dimension": "executive_function",
                "error_flag": wrong, "response_time_ms": rt, "trial_meta": meta}  # fmt: skip

    events = [ev(0, False, "left", 500), ev(1, True, "left", 400), ev(2, True, "none", 1250), ev(3, False, "left", 520)]
    assert features.ssrt(events) is not None
    events[2]["trial_meta"]["ssd_ms"] = True  # a bool is not a number
    assert features.ssrt(events) is None
    assert "SST_SSRT" not in task_scores(events)
