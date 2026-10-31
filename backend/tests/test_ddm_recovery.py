"""Test suite for Drift-Diffusion Model (DDM) parameter recovery and edge cases."""

import pytest
import numpy as np
from app.models.telemetry import TrialTelemetry, StimulusFeatures, DeviceTelemetry
from app.tools.psychometric_engine import PsychometricEngine


def generate_synthetic_trials(
    n_trials: int,
    true_accuracy: float,
    mean_rt_ms: float,
    rt_sd_ms: float,
    seed: int = 42,
) -> list[TrialTelemetry]:
    """Generates synthetic trial telemetry for parameter recovery verification."""
    rng = np.random.RandomState(seed)
    trials = []
    for i in range(n_trials):
        correct = rng.rand() < true_accuracy
        # Reaction time sampled from truncated normal / Wald distribution proxy
        rt = max(180.0, float(rng.normal(mean_rt_ms, rt_sd_ms)))
        trials.append(
            TrialTelemetry(
                trial_index=i,
                stimulus_id=f"syn_stim_{i}",
                stimulus_features=StimulusFeatures(),
                target_present=True,
                user_response=correct,
                is_correct=correct,
                reaction_time_ms=rt,
                device_telemetry=DeviceTelemetry(input_type="keyboard"),
            )
        )
    return trials


def test_ddm_drift_rate_recovery():
    """Verifies that higher accuracy & faster processing yield a higher drift rate v."""
    # Fast, high-accuracy cohort (high drift rate)
    high_trials = generate_synthetic_trials(n_trials=80, true_accuracy=0.92, mean_rt_ms=420.0, rt_sd_ms=60.0, seed=10)
    # Slow, low-accuracy cohort (low drift rate)
    low_trials = generate_synthetic_trials(n_trials=80, true_accuracy=0.62, mean_rt_ms=750.0, rt_sd_ms=180.0, seed=20)

    res_high = PsychometricEngine.fit_ez_diffusion(high_trials)
    res_low = PsychometricEngine.fit_ez_diffusion(low_trials)

    # High drift rate must strictly exceed low drift rate
    assert res_high["drift_rate_v"] > res_low["drift_rate_v"]
    assert res_high["drift_rate_v"] > 0.0
    # Plausible boundary separation
    assert 0.05 <= res_high["boundary_a"] <= 4.0
    assert 0.05 <= res_low["boundary_a"] <= 4.0


def test_ddm_boundary_separation_recovery():
    """Verifies that cautious, low-error responding with wide RT variance yields higher boundary a."""
    # Cautious: slow RT, very high accuracy
    cautious_trials = generate_synthetic_trials(n_trials=100, true_accuracy=0.95, mean_rt_ms=850.0, rt_sd_ms=120.0, seed=30)
    # Impulsive: fast RT, lower accuracy
    impulsive_trials = generate_synthetic_trials(n_trials=100, true_accuracy=0.70, mean_rt_ms=380.0, rt_sd_ms=50.0, seed=40)

    res_cautious = PsychometricEngine.fit_ez_diffusion(cautious_trials)
    res_impulsive = PsychometricEngine.fit_ez_diffusion(impulsive_trials)

    assert res_cautious["boundary_a"] > res_impulsive["boundary_a"]


def test_ddm_non_decision_time_bounds():
    """Verifies that non-decision time t0 is within physiological limits (< mean RT, >= 80ms)."""
    trials = generate_synthetic_trials(n_trials=50, true_accuracy=0.84, mean_rt_ms=500.0, rt_sd_ms=80.0, seed=50)
    res = PsychometricEngine.fit_ez_diffusion(trials)

    assert 80.0 <= res["non_decision_t0_ms"] < 500.0


def test_ddm_edge_cases():
    """Verifies robustness to 100% accuracy, 0% accuracy, and single trial datasets."""
    # 100% accuracy (no errors)
    perfect_trials = generate_synthetic_trials(n_trials=20, true_accuracy=1.0, mean_rt_ms=450.0, rt_sd_ms=50.0, seed=1)
    res_perfect = PsychometricEngine.fit_ez_diffusion(perfect_trials)
    assert res_perfect["drift_rate_v"] > 0.0
    assert res_perfect["boundary_a"] > 0.0

    # 0% accuracy (all errors)
    failing_trials = generate_synthetic_trials(n_trials=20, true_accuracy=0.0, mean_rt_ms=600.0, rt_sd_ms=70.0, seed=2)
    res_failing = PsychometricEngine.fit_ez_diffusion(failing_trials)
    assert res_failing["drift_rate_v"] < 0.0
    assert res_failing["boundary_a"] > 0.0
