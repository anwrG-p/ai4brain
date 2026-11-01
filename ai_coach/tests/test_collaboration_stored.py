"""Tests for CollaborationScorer.score_stored_history with CISTAC proposed weights."""

import pytest
from ai_coach.collaboration_scorer import (
    CISTAC_PROPOSED_WEIGHTS,
    CollaborationScorer,
    MIN_TYPED_TURNS,
)


def test_not_enough_data_under_ten_turns():
    scorer = CollaborationScorer()
    res = scorer.score_stored_history(["hello loti", "how are you?"])
    assert res == {"status": "not_enough_data"}


def test_score_stored_history_with_evidenced_turns():
    scorer = CollaborationScorer()
    # 10 turns providing evidence for clarification, verification, iteration, and autonomy
    turns = [
        "Why does this pattern rotate clockwise?",
        "Could you explain the rule for this task?",
        "Are you sure this is the right answer? Let me double-check.",
        "Verify if there is a counterexample to this hypothesis.",
        "Instead of that, let's try another way.",
        "Let me tweak my approach and try again.",
        "I think the solution is three moves.",
        "I decided to test my strategy first.",
        "What is the point of this exercise?",
        "Is this correct? Validate the assumption.",
    ]
    assert len(turns) >= MIN_TYPED_TURNS
    res = scorer.score_stored_history(turns)
    assert res["status"] == "ok"
    assert "composite_score" in res
    assert 0.0 <= res["composite_score"] <= 100.0
    assert "dimension_scores" in res
    assert "dimension_weights" in res
    assert "growth_recommendation" in res
    # Clarification and verification should be evidenced
    assert res["dimension_scores"]["clarification"] is not None
    assert res["dimension_scores"]["critical_verification"] is not None
    assert res["dimension_scores"]["iteration"] is not None
    assert res["dimension_scores"]["autonomy"] is not None
    # Growth recommendation should be a non-empty string
    assert len(res["growth_recommendation"]) > 10


def test_cistac_proposed_weights_structure():
    w = CISTAC_PROPOSED_WEIGHTS.to_dict()
    assert pytest.approx(w["clarification"]) == 0.20
    assert pytest.approx(w["critical_verification"]) == 0.25
    assert pytest.approx(w["iteration"]) == 0.20
    assert pytest.approx(w["autonomy"]) == 0.20
    assert pytest.approx(w["responsible_use"]) == 0.15
    assert pytest.approx(sum(w.values())) == 1.0

