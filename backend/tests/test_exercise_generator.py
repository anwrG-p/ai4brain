"""The 85% rule (the procedural generators moved to dynamic_cache, BE-03)."""

from app.tools.exercise_generator import ExerciseGenerator


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
