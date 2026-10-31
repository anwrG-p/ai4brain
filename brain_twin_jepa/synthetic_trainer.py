"""Synthetic Data Generator & Self-Supervised Trainer for SAT-JEPA Brain Twin.

Generates realistic multi-trial behavioral sessions across cognitive archetypes
and refines SAT-JEPA weights via pure-NumPy self-supervised JEPA updates.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Tuple
import numpy as np

from brain_twin_jepa.featurizer import CANONICAL_DIMENSIONS
from brain_twin_jepa.sat_jepa import SATJEPAModel


def generate_synthetic_session(
    archetype_tier: str = "operational",
    num_trials: int = 20,
    seed: int | None = None,
) -> List[Dict[str, Any]]:
    """Simulates a multi-trial cognitive assessment telemetry session."""
    rng = np.random.default_rng(seed)
    events: List[Dict[str, Any]] = []

    tier = archetype_tier.lower()
    if tier == "developing":
        score_base, score_std = 0.55, 0.15
        rt_base, rt_std = 2500.0, 800.0
        err_prob = 0.35
        jitter_base = 65.0
    elif tier == "strategic":
        score_base, score_std = 0.92, 0.06
        rt_base, rt_std = 950.0, 200.0
        err_prob = 0.05
        jitter_base = 15.0
    else:  # operational
        score_base, score_std = 0.78, 0.10
        rt_base, rt_std = 1400.0, 400.0
        err_prob = 0.15
        jitter_base = 35.0

    current_burst = 0
    for idx in range(num_trials):
        dim = rng.choice(CANONICAL_DIMENSIONS)
        score = float(np.clip(rng.normal(score_base, score_std), 0.0, 1.0))
        rt = float(np.clip(rng.normal(rt_base, rt_std), 200.0, 60000.0))
        is_error = bool(rng.random() < err_prob)

        if is_error:
            current_burst += 1
        else:
            current_burst = max(0, current_burst - 1)

        jitter = float(max(0.0, rng.normal(jitter_base, 15.0)))

        event: Dict[str, Any] = {
            "dimension": dim,
            "score_norm": score,
            "response_time_ms": rt,
            "error_flag": is_error,
            "error_burst": current_burst,
            "hesitation_jitter": jitter,
            "trial_index": idx,
        }
        events.append(event)

    return events


def _smooth_l1_and_grad(pred: np.ndarray, target: np.ndarray, beta: float = 1.0) -> Tuple[float, np.ndarray]:
    """Computes Smooth L1 loss and its analytical gradient."""
    diff = pred - target
    abs_diff = np.abs(diff)
    mask = abs_diff < beta

    loss = np.where(mask, 0.5 * (diff ** 2) / beta, abs_diff - 0.5 * beta)
    mean_loss = float(np.mean(loss))

    grad = np.where(mask, diff / beta, np.sign(diff)) / float(pred.size)
    return mean_loss, grad.astype(np.float32)


def train_sat_jepa(
    model: SATJEPAModel | None = None,
    num_sessions: int = 30,
    epochs: int = 3,
    lr: float = 0.01,
    save_path: str | Path | None = None,
) -> Tuple[SATJEPAModel, Dict[str, float]]:
    """Runs a pure-NumPy self-supervised JEPA training loop over synthetic sessions."""
    m = model or SATJEPAModel()
    tiers = ["developing", "operational", "strategic"]
    losses: List[float] = []

    # Pre-generate synthetic training sessions
    dataset = [
        generate_synthetic_session(archetype_tier=tiers[i % len(tiers)], num_trials=15, seed=100 + i)
        for i in range(num_sessions)
    ]

    for epoch in range(epochs):
        epoch_losses: List[float] = []
        for s_idx, session in enumerate(dataset):
            user_id = f"synth_user_{s_idx}"
            m.reset_user(user_id)

            for t, event in enumerate(session):
                s_t = m.process_event(user_id, event)

                # Horizon prediction task: forecast 1 step forward if available
                if t + 1 < len(session):
                    next_event = session[t + 1]
                    next_x = m.featurizer.featurize(next_event)
                    # Target encoder encodes the ground-truth next state
                    s_target, _ = m.target_encoder.encode_single(next_x, m.context_encoder._sessions[user_id])

                    # Latent predictor forward pass
                    s_hat, _ = m.predictor.predict_step(s_t, step_h=1, target_dimension=next_event["dimension"])

                    # Compute smooth L1 loss and gradient
                    loss_val, d_loss = _smooth_l1_and_grad(s_hat, s_target)
                    epoch_losses.append(loss_val)

                    # Simple gradient descent update on predictor residual head
                    pred_w = m.predictor.weights
                    # d_loss w.r.t w2: outer product of d_loss with z1
                    u = m.predictor._build_input(s_t, step_h=1, target_dimension=next_event["dimension"])
                    z1 = np.tanh(pred_w["w1"] @ u + pred_w["b1"])  # simplified activation for backprop
                    
                    grad_w2 = np.outer(d_loss, z1)
                    grad_b2 = d_loss

                    pred_w["w2"] -= (lr * grad_w2).astype(np.float32)
                    pred_w["b2"] -= (lr * grad_b2).astype(np.float32)

                    # Update target encoder via EMA
                    m.update_target(tau=0.996)

        losses.append(float(np.mean(epoch_losses)))

    if save_path:
        m.save_weights(save_path)

    metrics = {
        "initial_loss": losses[0] if losses else 0.0,
        "final_loss": losses[-1] if losses else 0.0,
        "total_epochs": epochs,
    }
    return m, metrics
