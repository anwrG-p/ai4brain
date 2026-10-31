"""The eval harness with mocked classifiers (the live run needs a key; see the BE-06 report)."""

import json

from ai_coach.eval import crisis_eval
from ai_coach.eval.crisis_eval import (
    error_classifier,
    evaluate,
    load_sets,
    oracle_classifier,
    summary,
)


def test_sets_come_from_the_test_file():
    sets = load_sets()
    assert {k: len(v) for k, v in sets.items()} == {
        "HELD_OUT_CRISIS": 19,
        "BENIGN_HELD_OUT": 20,
        "BENIGN_TRAINING_MESSAGES": 54,
    }


def test_keyword_only_is_todays_floor():
    report = evaluate(None)
    assert report["HELD_OUT_CRISIS"]["crisis_routed"] == 5
    assert report["BENIGN_HELD_OUT"]["crisis_routed"] == 3
    assert report["BENIGN_TRAINING_MESSAGES"]["crisis_routed"] == 0


def test_mock_oracle_shows_the_composition_routes_every_flag():
    sets = load_sets()
    report = evaluate(oracle_classifier(sets), sets)
    crisis = report["HELD_OUT_CRISIS"]
    assert crisis["crisis_routed"] == 19 and crisis["keyword"] == 5 and crisis["high"] == 14
    # The classifier cannot undo a keyword false hit: the gate runs first and answers.
    assert report["BENIGN_HELD_OUT"]["crisis_routed"] == 3
    assert summary(report)["held-out crisis routed to a crisis reply"] == "19/19"


def test_mock_error_fails_closed_on_every_message_the_gate_missed():
    report = evaluate(error_classifier())
    crisis = report["HELD_OUT_CRISIS"]
    assert crisis["keyword"] == 5 and crisis["error"] == 14 and crisis["none"] == 0
    assert report["BENIGN_TRAINING_MESSAGES"]["error"] == 54


def test_cli_runs_without_a_key(capsys):
    assert crisis_eval.main([]) == 0
    out = json.loads(capsys.readouterr().out)
    assert set(out) == {"keyword", "mock_oracle", "mock_error", "live"}
    assert out["live"].startswith("skipped")
