"""Computational Psychometric Engine.

Implements:
1. Closed-Form EZ-Diffusion Model (v, a, t0) via Wagenmakers et al. (2007)
2. 3-Parameter Logistic Item Response Theory (3PL-IRT) theta estimation & T-scores
3. Signal Detection Theory (d') with Hautus correction
4. Stop-Signal Reaction Time (SSRT) via integration method
5. Task Switch Cost (Delta RT)
6. Lure Discrimination Index (LDI)
7. Reliable Change Index (RCI) with p < 0.05 two-tailed significance
"""

from typing import List, Dict, Any, Tuple, Optional
import math
import numpy as np
from scipy import stats, optimize

from app.models.telemetry import TrialTelemetry
from app.models.brain_state import SessionMetrics, TaskSpecificMetrics


class PsychometricEngine:
    """Production-grade psychometric evaluation engine."""

    DEFAULT_S_SCALE: float = 0.1  # Standard within-trial diffusion scale
    DEFAULT_RELIABILITY_RXX: float = 0.85  # Normative cognitive test-retest reliability
    DEFAULT_SCORE_SD: float = 10.0  # T-score standard deviation

    @classmethod
    def fit_ez_diffusion(
        cls,
        trials: List[TrialTelemetry],
        s: float = DEFAULT_S_SCALE,
    ) -> Dict[str, float]:
        """Compute closed-form EZ-Diffusion Model parameters: drift rate (v), boundary separation (a),

        and non-decision time (t0 in ms).

        Reference: Wagenmakers, E. J., van der Maas, H. L., & Grasman, R. P. (2007).
        An EZ-diffusion model for response time and accuracy. Psychonomic Bulletin & Review, 14(1), 3-22.
        """
        n_trials = len(trials)
        if n_trials == 0:
            return {"drift_rate_v": 0.0, "boundary_a": 1.0, "non_decision_t0_ms": 200.0}

        # Partition responses
        correct_trials = [t for t in trials if t.is_correct]
        n_correct = len(correct_trials)
        n_errors = n_trials - n_correct

        # Raw accuracy (proportion correct Pc) with Wagenmakers edge correction
        if n_correct == n_trials:
            pc = 1.0 - (1.0 / (2.0 * n_trials))
        elif n_correct == 0:
            pc = 1.0 / (2.0 * n_trials)
        else:
            pc = float(n_correct) / float(n_trials)

        # Avoid logit singularity at exactly 0.5
        if abs(pc - 0.5) < 1e-5:
            pc = 0.5001 if pc >= 0.5 else 0.4999

        pe = 1.0 - pc

        # Reaction times of correct trials in seconds for diffusion math
        if n_correct > 1:
            rts_sec = [t.reaction_time_ms / 1000.0 for t in correct_trials]
            m_rt = float(np.mean(rts_sec))
            v_rt = float(np.var(rts_sec, ddof=1))
        elif n_correct == 1:
            m_rt = correct_trials[0].reaction_time_ms / 1000.0
            v_rt = 0.04  # Fallback variance ~200ms SD
        else:
            # Fallback to all trials RT if 0 correct
            all_rts = [t.reaction_time_ms / 1000.0 for t in trials]
            m_rt = float(np.mean(all_rts))
            v_rt = float(np.var(all_rts, ddof=1)) if len(all_rts) > 1 else 0.04

        # Safeguard variance
        v_rt = max(v_rt, 1e-4)

        # Wagenmakers inversion formulas:
        # L = logit(Pc) = ln(Pc / (1 - Pc))
        logit_p = math.log(pc / (1.0 - pc))

        # Drift rate v:
        # v = sign(Pc - 0.5) * s * [ (L * (Pc^2 * L - Pc * L + Pc - 0.5)) / V_RT ]^(1/4)
        sign = 1.0 if pc > 0.5 else -1.0
        numerator = logit_p * (pc**2 * logit_p - pc * logit_p + pc - 0.5)
        # Numerical guard: numerator / v_rt must be positive
        inner_term = max(float(numerator / v_rt), 1e-6)
        v = sign * s * (inner_term ** 0.25)

        # Boundary separation a = s^2 * L / v
        if abs(v) < 1e-6:
            v = 1e-6 * sign
        a = abs((s**2 * logit_p) / v)

        # Mean Decision Time: MDT = (a / (2*v)) * (1 - exp(-L)) / (1 + exp(-L))
        # Note: v*a/s^2 = L
        exp_neg_l = math.exp(-abs(logit_p))
        mdt = (a / (2.0 * abs(v))) * ((1.0 - exp_neg_l) / (1.0 + exp_neg_l))

        # Non-decision time t0 = MRT - MDT
        t0_sec = m_rt - mdt
        
        # Clinical plausibility bounds
        # Boundary a in [0.05, 4.0]
        a = float(np.clip(a, 0.05, 4.0))
        # Drift rate v in [-5.0, 5.0]
        v = float(np.clip(v, -5.0, 5.0))
        # Non-decision time t0 in [80ms, m_rt * 1000 - 10ms]
        max_t0_ms = max(80.0, (m_rt * 1000.0) - 20.0)
        t0_ms = float(np.clip(t0_sec * 1000.0, 80.0, max_t0_ms))

        return {
            "drift_rate_v": round(float(v), 4),
            "boundary_a": round(float(a), 4),
            "non_decision_t0_ms": round(float(t0_ms), 2),
        }

    @classmethod
    def fit_irt_3pl(
        cls,
        responses: List[bool],
        a_params: List[float],
        b_params: List[float],
        c_params: Optional[List[float]] = None,
        prior_mean: float = 0.0,
        prior_sd: float = 1.0,
    ) -> Tuple[float, float, float]:
        """Estimate latent ability theta in [-3.0, +3.0] via Penalized Maximum Likelihood Estimation

        (Maximum A Posteriori) with standard error and standardized T-score.

        P_i(theta) = c_i + (1 - c_i) / (1 + exp(-a_i * (theta - b_i)))
        Returns: (theta_hat, se_theta, t_score)
        """
        n_items = len(responses)
        if n_items == 0:
            return 0.0, 1.0, 50.0

        if c_params is None:
            c_params = [0.0] * n_items

        u = np.array([1.0 if r else 0.0 for r in responses], dtype=float)
        a = np.array(a_params, dtype=float)
        b = np.array(b_params, dtype=float)
        c = np.array(c_params, dtype=float)

        def neg_log_posterior(theta: float) -> float:
            # P_i(theta)
            exp_term = np.exp(-np.clip(a * (theta - b), -30.0, 30.0))
            p_i = c + (1.0 - c) / (1.0 + exp_term)
            p_i = np.clip(p_i, 1e-7, 1.0 - 1e-7)

            # Likelihood
            log_lik = np.sum(u * np.log(p_i) + (1.0 - u) * np.log(1.0 - p_i))
            # Gaussian Prior
            log_prior = -0.5 * ((theta - prior_mean) / prior_sd) ** 2
            return float(-(log_lik + log_prior))

        # Optimize theta over [-3.5, +3.5]
        res = optimize.minimize_scalar(neg_log_posterior, bounds=(-3.5, 3.5), method="bounded")
        theta_hat = float(np.clip(res.x, -3.0, 3.0))

        # Compute Fisher Information at theta_hat:
        # I_i(theta) = a_i^2 * ((P_i - c_i)^2 / (1 - c_i)^2) * ((1 - P_i) / P_i)
        exp_term = np.exp(-np.clip(a * (theta_hat - b), -30.0, 30.0))
        p_hat = c + (1.0 - c) / (1.0 + exp_term)
        p_hat = np.clip(p_hat, 1e-7, 1.0 - 1e-7)

        one_minus_c = np.clip(1.0 - c, 1e-4, 1.0)
        q_term = (p_hat - c) / one_minus_c
        fisher_items = (a**2) * (q_term**2) * ((1.0 - p_hat) / p_hat)
        fisher_prior = 1.0 / (prior_sd**2)
        total_info = np.sum(fisher_items) + fisher_prior

        se_theta = float(1.0 / math.sqrt(max(total_info, 1e-4)))
        t_score = float(50.0 + 10.0 * theta_hat)

        return round(theta_hat, 4), round(se_theta, 4), round(t_score, 2)

    @classmethod
    def compute_signal_detection_d_prime(
        cls,
        hits: int,
        total_targets: int,
        false_alarms: int,
        total_distractors: int,
    ) -> float:
        """Calculate d' with Hautus (1995) log-linear correction to avoid infinite values."""
        if total_targets == 0 or total_distractors == 0:
            return 0.0

        hit_rate = (hits + 0.5) / (total_targets + 1.0)
        fa_rate = (false_alarms + 0.5) / (total_distractors + 1.0)

        hit_rate = float(np.clip(hit_rate, 1e-5, 1.0 - 1e-5))
        fa_rate = float(np.clip(fa_rate, 1e-5, 1.0 - 1e-5))

        z_hit = stats.norm.ppf(hit_rate)
        z_fa = stats.norm.ppf(fa_rate)
        return round(float(z_hit - z_fa), 4)

    @classmethod
    def compute_ssrt(
        cls,
        go_rts_ms: List[float],
        stop_signal_delays_ms: List[float],
        p_respond_given_signal: float,
    ) -> float:
        """Calculate Stop-Signal Reaction Time (SSRT) via the nonparametric integration method."""
        if not go_rts_ms:
            return 0.0

        sorted_rts = sorted(go_rts_ms)
        n = len(sorted_rts)
        p_resp = float(np.clip(p_respond_given_signal, 0.01, 0.99))
        nth_idx = int(np.clip(round(n * p_resp) - 1, 0, n - 1))
        nth_rt = sorted_rts[nth_idx]

        mean_ssd = float(np.mean(stop_signal_delays_ms)) if stop_signal_delays_ms else 250.0
        ssrt = max(0.0, nth_rt - mean_ssd)
        return round(ssrt, 2)

    @classmethod
    def compute_switch_cost(
        cls,
        repeat_rts_ms: List[float],
        switch_rts_ms: List[float],
    ) -> float:
        """Calculate task switch cost (Delta RT = Switch RT - Repeat RT in ms)."""
        if not repeat_rts_ms or not switch_rts_ms:
            return 0.0
        return round(float(np.mean(switch_rts_ms) - np.mean(repeat_rts_ms)), 2)

    @classmethod
    def compute_ldi(
        cls,
        lure_hits: int,
        total_lures: int,
        foil_false_alarms: int,
        total_foils: int,
    ) -> float:
        """Lure Discrimination Index (LDI): P(Correct Rejection | Lure) - P(False Alarm | Foil)."""
        p_lure = (lure_hits / total_lures) if total_lures > 0 else 0.0
        p_foil = (foil_false_alarms / total_foils) if total_foils > 0 else 0.0
        return round(float(p_lure - p_foil), 4)

    @classmethod
    def compute_rci(
        cls,
        current_score: float,
        baseline_score: float,
        sem: Optional[float] = None,
        reliability_rxx: float = DEFAULT_RELIABILITY_RXX,
        sd: float = DEFAULT_SCORE_SD,
    ) -> Tuple[float, bool]:
        """Compute Reliable Change Index (RCI) against baseline.

        RCI = (X2 - X1) / S_diff
        S_diff = sqrt(2 * SEM^2)
        SEM = SD * sqrt(1 - r_xx)
        Returns: (rci_value, is_statistically_significant)
        """
        if sem is None:
            sem = sd * math.sqrt(max(1.0 - reliability_rxx, 0.01))

        s_diff = math.sqrt(2.0 * (sem**2))
        if s_diff < 1e-4:
            s_diff = 1.0

        rci = (current_score - baseline_score) / s_diff
        # Two-tailed significance at alpha = 0.05 (|z| >= 1.96)
        sig = abs(rci) >= 1.96
        return round(float(rci), 4), bool(sig)

    @classmethod
    def process_session_telemetry(
        cls,
        trials: List[TrialTelemetry],
        baseline_t_score: float = 50.0,
        item_difficulties: Optional[List[float]] = None,
        item_discriminations: Optional[List[float]] = None,
    ) -> SessionMetrics:
        """Full end-to-end evaluation pipeline for incoming raw session telemetry."""
        n_trials = len(trials)
        if n_trials == 0:
            raise ValueError("Telemetry trials array cannot be empty")

        # 1. Basic accuracy and RT stats
        correct_trials = [t for t in trials if t.is_correct]
        accuracy = len(correct_trials) / n_trials
        correct_rts = [t.reaction_time_ms for t in correct_trials]
        all_rts = [t.reaction_time_ms for t in trials]
        mean_rt = float(np.mean(correct_rts)) if correct_rts else float(np.mean(all_rts))
        rt_jitter = float(np.std(all_rts, ddof=1)) if len(all_rts) > 1 else 0.0

        # 2. Closed-form EZ-Diffusion
        ez_ddm = cls.fit_ez_diffusion(trials)

        # 3. 3PL-IRT theta & T-score
        responses = [t.is_correct for t in trials]
        b_params = item_difficulties if item_difficulties and len(item_difficulties) == n_trials else [0.0] * n_trials
        a_params = item_discriminations if item_discriminations and len(item_discriminations) == n_trials else [1.0] * n_trials
        c_params = [0.0] * n_trials

        theta, se_theta, t_score = cls.fit_irt_3pl(responses, a_params, b_params, c_params)

        # 4. Reliable Change Index (RCI)
        rci, is_sig = cls.compute_rci(current_score=t_score, baseline_score=baseline_t_score)

        # 5. Task-specific metrics
        # Signal detection (target present vs absent)
        target_trials = [t for t in trials if t.target_present]
        distractor_trials = [t for t in trials if not t.target_present]
        hits = sum(1 for t in target_trials if t.user_response)
        false_alarms = sum(1 for t in distractor_trials if t.user_response)
        d_prime = cls.compute_signal_detection_d_prime(
            hits=hits,
            total_targets=len(target_trials),
            false_alarms=false_alarms,
            total_distractors=len(distractor_trials),
        )

        # Lure discrimination if lure trials exist
        lure_trials = [t for t in trials if t.stimulus_features.is_lure]
        foil_trials = [t for t in trials if not t.stimulus_features.is_lure and not t.target_present]
        ldi = None
        if lure_trials:
            lure_correct = sum(1 for t in lure_trials if t.is_correct)
            foil_errors = sum(1 for t in foil_trials if not t.is_correct)
            ldi = cls.compute_ldi(lure_correct, len(lure_trials), foil_errors, len(foil_trials))

        # Switch cost if rule switch flags present
        switch_trials = [t for t in trials if t.stimulus_features.rule_switched]
        repeat_trials = [t for t in trials if not t.stimulus_features.rule_switched]
        switch_cost = None
        if switch_trials and repeat_trials:
            switch_rts = [t.reaction_time_ms for t in switch_trials if t.is_correct]
            repeat_rts = [t.reaction_time_ms for t in repeat_trials if t.is_correct]
            if switch_rts and repeat_rts:
                switch_cost = cls.compute_switch_cost(repeat_rts, switch_rts)

        task_metrics = TaskSpecificMetrics(
            signal_detection_d_prime=d_prime,
            reaction_time_jitter_ms=round(rt_jitter, 2),
            lure_discrimination_index=ldi,
            task_switch_cost_ms=switch_cost,
        )

        return SessionMetrics(
            ddm_drift_rate_v=ez_ddm["drift_rate_v"],
            ddm_boundary_a=ez_ddm["boundary_a"],
            ddm_non_decision_t0_ms=ez_ddm["non_decision_t0_ms"],
            theta_ability=theta,
            t_score=t_score,
            rci_vs_baseline=rci,
            statistically_significant=is_sig,
            accuracy=round(accuracy, 4),
            mean_correct_rt_ms=round(mean_rt, 2),
            task_specific=task_metrics,
        )
