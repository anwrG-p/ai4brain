"""Test suite for Reliable Change Index (RCI), confidence intervals, and Kalman filter."""

import pytest
import numpy as np
from app.tools.psychometric_engine import PsychometricEngine
from app.tools.digital_brain_updater import DigitalBrainUpdater, KalmanBrainFilter


def test_rci_statistical_significance():
    """Verifies that large changes exceed the 1.96 critical z-value at alpha = 0.05."""
    baseline = 50.0

    # Small change (+2.0 points on T-score scale): within measurement error
    rci_small, is_sig_small = PsychometricEngine.compute_rci(current_score=52.0, baseline_score=baseline)
    assert not is_sig_small
    assert abs(rci_small) < 1.96

    # Large neuroplastic leap (+12.0 points on T-score scale): clinically significant
    rci_large, is_sig_large = PsychometricEngine.compute_rci(current_score=62.0, baseline_score=baseline)
    assert is_sig_large
    assert rci_large >= 1.96

    # Large regression (-12.0 points): significant negative change
    rci_drop, is_sig_drop = PsychometricEngine.compute_rci(current_score=38.0, baseline_score=baseline)
    assert is_sig_drop
    assert rci_drop <= -1.96


def test_kalman_filter_variance_contraction():
    """Verifies that Kalman filtering smooths state and contracts posterior covariance."""
    kf = KalmanBrainFilter(process_variance_q=0.2, observation_variance_r=2.0)

    # Initial state: prior mean 50, prior variance 16 (SD=4)
    x_prior = np.array([50.0] * 5)
    P_prior = np.eye(5) * 16.0

    # Observation: User scores 60 on dlPFC (node index 0)
    z_obs = np.array([60.0, 50.0, 50.0, 50.0, 50.0])
    active_mask = np.array([1.0, 0.0, 0.0, 0.0, 0.0])

    x_upd, P_upd = kf.step(x_prior, P_prior, z_obs, active_mask)

    # dlPFC updated state should move toward 60, but smoothed
    assert 50.0 < x_upd[0] < 60.0
    # Posterior variance on node 0 must shrink compared to prior variance (16.0)
    assert P_upd[0, 0] < P_prior[0, 0]


def test_plasticity_bottleneck_detection():
    """Verifies correct identification of the weakest cognitive node."""
    means = {
        "dlPFC": 58.0,
        "ACC": 42.5,  # Lowest capacity
        "vlPFC_Striatum": 49.0,
        "Hippocampus_DG": 55.0,
        "Parieto_Occipital": 53.0,
    }
    bottleneck = DigitalBrainUpdater.identify_plasticity_bottleneck(means)
    assert bottleneck == "ACC"
