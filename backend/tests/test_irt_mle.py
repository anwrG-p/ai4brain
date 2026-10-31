"""Test suite for 3PL-IRT theta estimation and standardized T-scores."""

import pytest
from app.tools.psychometric_engine import PsychometricEngine


def test_irt_theta_convergence_high_vs_low():
    """Verifies that high response accuracy produces positive theta and T-score > 50."""
    n_items = 20
    a_params = [1.2] * n_items
    b_params = [0.0] * n_items
    c_params = [0.0] * n_items

    high_responses = [True] * 18 + [False] * 2  # 90% correct
    low_responses = [False] * 16 + [True] * 4    # 20% correct

    theta_high, se_high, t_high = PsychometricEngine.fit_irt_3pl(high_responses, a_params, b_params, c_params)
    theta_low, se_low, t_low = PsychometricEngine.fit_irt_3pl(low_responses, a_params, b_params, c_params)

    assert theta_high > 0.0
    assert theta_low < 0.0
    assert t_high > 50.0
    assert t_low < 50.0
    # Standard formula verification: T = 50 + 10 * theta
    assert abs(t_high - (50.0 + 10.0 * theta_high)) < 0.1
    assert abs(t_low - (50.0 + 10.0 * theta_low)) < 0.1


def test_fisher_information_se_shrinkage():
    """Verifies that longer test blocks accumulate Fisher information and reduce SE(theta)."""
    # 5 items vs 30 items with same accuracy
    a_short = [1.0] * 6
    b_short = [0.0] * 6
    resp_short = [True, True, True, True, True, False]

    a_long = [1.0] * 30
    b_long = [0.0] * 30
    resp_long = ([True] * 25) + ([False] * 5)

    _, se_short, _ = PsychometricEngine.fit_irt_3pl(resp_short, a_short, b_short)
    _, se_long, _ = PsychometricEngine.fit_irt_3pl(resp_long, a_long, b_long)

    # Longer test gives more measurement precision -> lower standard error
    assert se_long < se_short
