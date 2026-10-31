"""The 85% rule for optimal learning (Wilson et al., 2019).

His procedural generators (RFT relational, interference n-back) were removed in BE-00: the
dynamic_cache generators (BE-03) cover both schema types and emit what the frontend renders.
They remain recoverable from commit 1085ec8.
"""


class ExerciseGenerator:
    """Difficulty scaling toward ~85% accuracy, kept for BE-04's theta update."""

    @classmethod
    def apply_85_percent_rule(
        cls,
        historical_accuracy: float,
        current_difficulty_b: float,
        step_size: float = 0.25,
    ) -> float:
        """Enforces the Wilson et al. (2019) 85% Rule for Optimal Learning.

        Optimal learning occurs when error rate is ~15% (85% accuracy).
        - If accuracy > 85%: increase difficulty b.
        - If accuracy < 85%: decrease difficulty b.
        Bounds b in [-2.5, +2.5].
        """
        error_rate = 1.0 - historical_accuracy
        target_error_rate = 0.15

        # Delta proportional to divergence from 15% error rate
        delta = (target_error_rate - error_rate) * step_size * 2.0
        # If error_rate is 0.0 (too easy), delta is +0.15 * 0.5 = +0.075 -> increase difficulty
        # If error_rate is 0.30 (too hard), delta is -0.15 * 0.5 = -0.075 -> decrease difficulty
        new_b = current_difficulty_b + delta
        return round(float(max(-2.5, min(2.5, new_b))), 3)
