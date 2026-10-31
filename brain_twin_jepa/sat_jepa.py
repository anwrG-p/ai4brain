"""SAT-JEPA Unified Brain Twin Model.

Coordinates TelemetryFeaturizer, TemporalContextEncoder, TargetEncoder,
LatentPredictor, and Centroid Soft-Anchoring in pure NumPy.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union
import numpy as np

from brain_twin_jepa.encoder import TemporalContextEncoder
from brain_twin_jepa.featurizer import TelemetryFeaturizer
from brain_twin_jepa.predictor import LatentPredictor
from brain_twin_jepa.target_encoder import TargetEncoder


class SATJEPAModel:
    """Unified Soft-Anchored Temporal JEPA (SAT-JEPA) Brain Twin.

    Connects:
        Member 1 Telemetry (x_t)
            → Featurizer (12D)
            → Context Encoder (f_θ) → s_t ∈ ℝ^64
            → Latent Predictor (g_φ) → ŝ_{t+h} ∈ ℝ^64
            → Target Encoder (f_{θ̄}) EMA momentum

    No fixed archetypes are assumed by default; the representation space
    is open, and anchoring adapts dynamically when user centroids are generated.
    """

    def __init__(
        self,
        latent_dim: int = 64,
        input_dim: int = 12,
        hidden_dim: int = 64,
        tau: float = 0.996,
        seed: int = 42,
    ) -> None:
        self.latent_dim = latent_dim
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.tau = tau

        self.featurizer = TelemetryFeaturizer()
        self.context_encoder = TemporalContextEncoder(
            input_dim=input_dim,
            hidden_dim=hidden_dim,
            latent_dim=latent_dim,
            seed=seed,
        )
        self.target_encoder = TargetEncoder(self.context_encoder, tau=tau)
        self.predictor = LatentPredictor(
            latent_dim=latent_dim,
            num_dimensions=len(self.featurizer.dimensions),
            hidden_dim=hidden_dim,
            seed=seed,
        )
        # No fixed archetypes by default; unconstrained continuous space

    def anchor_to_user_centroids(self, centroids: np.ndarray) -> None:
        """Dynamically anchors projection layer to user-generated centroids when discovered."""
        c = np.asarray(centroids, dtype=np.float32)
        if c.ndim != 2 or c.shape[1] != self.latent_dim:
            raise ValueError(f"Centroids must have shape (K, {self.latent_dim}), got {c.shape}")
        k = c.shape[0]
        if k == 0:
            return

        rng = np.random.default_rng(42)
        h_proto = rng.standard_normal((k, self.hidden_dim)).astype(np.float32)
        h_pinv = np.linalg.pinv(h_proto)
        w_proj = (c.T @ h_pinv.T).astype(np.float32)

        weights = self.context_encoder.get_weights()
        weights["w_proj"] = w_proj
        self.context_encoder.load_weights(weights)
        self.target_encoder.load_weights(weights)

    def process_event(self, user_id: str, event: Union[Dict[str, Any], Any]) -> np.ndarray:
        """Featurizes a telemetry event, steps the context encoder, and returns s_t ∈ ℝ^64."""
        x_t = self.featurizer.featurize(event)
        s_t = self.context_encoder.step(user_id, x_t)
        return s_t

    def get_user_state(self, user_id: str) -> Optional[np.ndarray]:
        """Retrieve current latent state s_t for an active user session."""
        return self.context_encoder.get_state(user_id)

    def forecast_trajectory(
        self,
        user_id: str,
        horizon: int = 5,
        target_dimensions: Optional[Sequence[Optional[Union[str, int]]]] = None,
    ) -> List[Tuple[np.ndarray, float]]:
        """Forecast forward cognitive states for an active user session.

        Returns:
            List of (ŝ_{t+h}, uncertainty_σ_{t+h}) for h ∈ {1..horizon}.
        """
        s_t = self.get_user_state(user_id)
        if s_t is None:
            raise ValueError(f"User session '{user_id}' has not been observed yet. Cannot forecast.")

        return self.predictor.predict_horizon(
            s_t=s_t,
            horizon=horizon,
            target_dimensions=target_dimensions,
        )

    def update_target(self, tau: Optional[float] = None) -> None:
        """Perform EMA update on the target encoder."""
        self.target_encoder.update_ema(self.context_encoder, tau=tau)

    def reset_user(self, user_id: str) -> None:
        """Clear session memory for a user."""
        self.context_encoder.reset_user(user_id)

    def save_weights(self, filepath: Union[str, Path]) -> None:
        """Save model parameters to an NPZ archive."""
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)

        cw = {f"ctx_{k}": v for k, v in self.context_encoder.get_weights().items()}
        tw = {f"tgt_{k}": v for k, v in self.target_encoder.get_weights().items()}
        pw = {f"pred_{k}": v for k, v in self.predictor.get_weights().items()}

        np.savez_compressed(path, **cw, **tw, **pw)

    def load_weights(self, filepath: Union[str, Path]) -> None:
        """Load model parameters from an NPZ archive."""
        path = Path(filepath)
        if not path.is_file():
            raise FileNotFoundError(f"Weight file not found: {path}")

        data = np.load(path)
        cw: Dict[str, np.ndarray] = {}
        tw: Dict[str, np.ndarray] = {}
        pw: Dict[str, np.ndarray] = {}

        for k in data.files:
            if k.startswith("ctx_"):
                cw[k[4:]] = data[k]
            elif k.startswith("tgt_"):
                tw[k[4:]] = data[k]
            elif k.startswith("pred_"):
                pw[k[5:]] = data[k]

        if cw:
            self.context_encoder.load_weights(cw)
        if tw:
            self.target_encoder.load_weights(tw)
        if pw:
            self.predictor.load_weights(pw)
