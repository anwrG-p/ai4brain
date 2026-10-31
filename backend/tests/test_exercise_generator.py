"""Test suite for procedural exercise generation, non-duplication, and 85% rule."""

import pytest
from app.tools.exercise_generator import ExerciseGenerator
from app.models.task_schema import TaskType


def test_no_duplicate_stimuli_in_relational_responding():
    """Verifies that all procedurally generated RFT trials possess unique stimulus IDs."""
    task = ExerciseGenerator.generate_relational_responding_task(num_trials=40, difficulty_b=0.5, seed=123)
    stimulus_ids = [t.stimulus_id for t in task.trials]

    # Zero duplicate stimulus IDs
    assert len(stimulus_ids) == len(set(stimulus_ids))
    assert len(task.trials) == 40
    assert task.task_type == TaskType.RELATIONAL_RESPONDING_RFT


def test_no_duplicate_stimuli_in_interference_n_back():
    """Verifies that all procedurally generated N-Back trials possess unique stimulus IDs."""
    task = ExerciseGenerator.generate_interference_n_back_task(num_trials=50, difficulty_b=1.2, seed=456)
    stimulus_ids = [t.stimulus_id for t in task.trials]

    # Zero duplicate stimulus IDs
    assert len(stimulus_ids) == len(set(stimulus_ids))
    assert len(task.trials) == 50
    assert task.task_type == TaskType.INTERFERENCE_N_BACK


def test_proactive_lures_distribution_in_n_back():
    """Verifies that interference N-Back includes proactive lures (N-1 or N+1)."""
    task = ExerciseGenerator.generate_interference_n_back_task(num_trials=40, difficulty_b=1.0, seed=789)
    lure_trials = [t for t in task.trials if t.is_lure]

    # Must contain lures
    assert len(lure_trials) > 0
    # Must specify lure type
    for lt in lure_trials:
        assert lt.lure_type in ["N-1", "N+1", "conflict"]
        # In a lure trial, target_present must be False (distractor familiarity)
        assert lt.target_present is False
        assert lt.correct_key == "NO_MATCH"


def test_85_percent_rule_difficulty_scaling():
    """Verifies that difficulty b scales adaptively toward 85% accuracy."""
    current_b = 0.0

    # User performed with 98% accuracy (too easy) -> difficulty must increase
    higher_b = ExerciseGenerator.apply_85_percent_rule(historical_accuracy=0.98, current_difficulty_b=current_b)
    assert higher_b > current_b

    # User performed with 60% accuracy (too hard) -> difficulty must decrease
    lower_b = ExerciseGenerator.apply_85_percent_rule(historical_accuracy=0.60, current_difficulty_b=current_b)
    assert lower_b < current_b

    # User performed at exactly 85% accuracy (optimal) -> difficulty remains stable
    stable_b = ExerciseGenerator.apply_85_percent_rule(historical_accuracy=0.85, current_difficulty_b=current_b)
    assert abs(stable_b - current_b) < 1e-4
