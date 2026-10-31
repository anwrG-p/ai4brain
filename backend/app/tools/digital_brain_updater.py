"""Digital Brain State Agent & Multi-Region Cortical Updater.

Manages the 5-node cognitive state space:
- dlPFC: Working Memory, Planning, Fluid Reasoning
- ACC: Conflict Monitoring, Task Switching, Error Recovery
- vlPFC_Striatum: Inhibitory Motor Control, Impulsivity Gating
- Hippocampus_DG: Mnemonic Separation, Associative Binding
- Parieto_Occipital: Processing Speed, Divided Attention, Spatial Orienting

Applies a Multidimensional Kalman Filter to track latent capacity theta while
filtering out momentary fatigue, distractions, and circadian fluctuations.
"""

from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime
import math
import numpy as np

from app.models.brain_state import (
    NodeDelta,
    DigitalBrainDelta,
    SessionMetrics,
    DigitalBrainEvaluation,
)
from app.models.task_schema import TaskType


class KalmanBrainFilter:
    """Discrete-time linear Kalman filter over 5 cortical capacity states."""

    NODES = ["dlPFC", "ACC", "vlPFC_Striatum", "Hippocampus_DG", "Parieto_Occipital"]

    def __init__(
        self,
        process_variance_q: float = 0.25,      # Biological plasticity variance between sessions
        observation_variance_r: float = 2.25,  # Measurement noise of single testing session
    ):
        self.dim = len(self.NODES)
        # State transition matrix A (identity with slight regression to mean)
        self.A = np.eye(self.dim) * 0.995 + 0.005 * np.ones((self.dim, self.dim)) * (1.0 / self.dim)
        # Process noise covariance Q
        self.Q = np.eye(self.dim) * process_variance_q
        # Measurement noise covariance R
        self.R = np.eye(self.dim) * observation_variance_r

    def step(
        self,
        current_state: np.ndarray,      # 5x1 prior mean T-scores
        current_cov: np.ndarray,        # 5x5 prior covariance
        measurement: np.ndarray,        # 5x1 observed T-scores
        active_mask: np.ndarray,        # 5x1 binary mask indicating which nodes were tested
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Kalman Predict and Update cycle."""
        # 1. Prediction (Time update)
        x_pred = self.A @ current_state
        P_pred = self.A @ current_cov @ self.A.T + self.Q

        # 2. Measurement Update
        # Construct observation matrix H based on active_mask
        H = np.diag(active_mask)
        # Innovation / Measurement residual
        y = measurement - H @ x_pred

        # Innovation covariance S = H P H^T + R
        S = H @ P_pred @ H.T + self.R
        # Kalman Gain K = P H^T S^-1
        K = P_pred @ H.T @ np.linalg.pinv(S)

        # Updated state estimate
        x_updated = x_pred + K @ y
        # Updated covariance estimate (Joseph form for numerical stability)
        I_KH = np.eye(self.dim) - K @ H
        P_updated = I_KH @ P_pred @ I_KH.T + K @ self.R @ K.T

        return x_updated, P_updated


class DigitalBrainUpdater:
    """Manages longitudinal user cortical state representation and updates."""

    @classmethod
    def get_initial_brain_state(cls) -> Dict[str, Any]:
        """Normative initial baseline: T-score 50.0 (mean) with variance 10.0 (SD=10.0)."""
        return {
            "means": {node: 50.0 for node in KalmanBrainFilter.NODES},
            "variances": {node: 16.0 for node in KalmanBrainFilter.NODES},  # Initial SEM ~4.0
            "covariance_matrix": (np.eye(5) * 16.0).tolist(),
            "updated_at": datetime.utcnow().isoformat(),
        }

    @classmethod
    def identify_plasticity_bottleneck(cls, brain_means: Dict[str, float]) -> str:
        """Find the node with lowest capacity / highest room for neuroplastic gain."""
        # Find minimum T-score node
        bottleneck = min(brain_means.items(), key=lambda kv: kv[1])
        return bottleneck[0]

    @classmethod
    def map_session_to_node_observations(
        cls,
        task_type: str,
        session_metrics: SessionMetrics,
        current_means: Dict[str, float],
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Maps session psychometrics and task dimensions to the 5 cortical nodes.

        Returns: (measurement_vector_5x1, active_mask_5x1)
        """
        obs = np.array([current_means[node] for node in KalmanBrainFilter.NODES], dtype=float)
        active_mask = np.zeros(5, dtype=float)

        t_score = session_metrics.t_score
        # DDM drift rate modifier: high drift rate v boosts processing efficiency
        drift_bonus = np.clip(session_metrics.ddm_drift_rate_v * 1.5, -5.0, 5.0)
        adj_t_score = float(np.clip(t_score + drift_bonus, 20.0, 80.0))

        if task_type == TaskType.INTERFERENCE_N_BACK.value or task_type == "INTERFERENCE_N_BACK":
            # N-back primarily exercises dlPFC (working memory), ACC (conflict monitoring), and vlPFC_Striatum
            obs[0] = adj_t_score  # dlPFC
            active_mask[0] = 1.0

            # If lure discrimination is measured, ACC and vlPFC are updated
            if session_metrics.task_specific.lure_discrimination_index is not None:
                ldi = session_metrics.task_specific.lure_discrimination_index
                acc_score = float(np.clip(50.0 + ldi * 20.0, 20.0, 80.0))
                obs[1] = acc_score  # ACC
                obs[2] = float(np.clip(acc_score - 1.5, 20.0, 80.0))  # vlPFC_Striatum
                active_mask[1] = 1.0
                active_mask[2] = 1.0
            else:
                obs[1] = adj_t_score
                active_mask[1] = 1.0

            # Processing speed reflected in Parieto_Occipital
            rt = session_metrics.mean_correct_rt_ms
            # Faster RT (< 500ms) -> higher T-score
            rt_score = float(np.clip(50.0 + (650.0 - rt) / 15.0, 25.0, 75.0))
            obs[4] = rt_score
            active_mask[4] = 0.5  # Partial weight

        elif task_type == TaskType.RELATIONAL_RESPONDING_RFT.value or task_type == "RELATIONAL_RESPONDING_RFT":
            # RFT tests dlPFC (transitive reasoning) and Hippocampus_DG (associative binding)
            obs[0] = adj_t_score  # dlPFC
            active_mask[0] = 1.0

            obs[3] = float(np.clip(adj_t_score + 1.0, 20.0, 80.0))  # Hippocampus_DG
            active_mask[3] = 1.0

            # Rule switch cost impacts ACC
            if session_metrics.task_specific.task_switch_cost_ms is not None:
                cost = session_metrics.task_specific.task_switch_cost_ms
                # Lower switch cost is better
                acc_score = float(np.clip(50.0 + (150.0 - cost) / 10.0, 20.0, 80.0))
                obs[1] = acc_score
                active_mask[1] = 1.0

            # Parieto_Occipital partial observation
            obs[4] = float(np.clip(50.0 + (700.0 - session_metrics.mean_correct_rt_ms) / 20.0, 25.0, 75.0))
            active_mask[4] = 0.5

        else:
            # Generic mapping across all nodes
            for i in range(5):
                obs[i] = adj_t_score
                active_mask[i] = 0.7

        return obs, active_mask

    @classmethod
    def update_brain_state(
        cls,
        user_id: str,
        session_id: str,
        task_type: str,
        session_metrics: SessionMetrics,
        current_brain_state: Optional[Dict[str, Any]] = None,
    ) -> DigitalBrainEvaluation:
        """Runs the Kalman filter over incoming session psychometrics to update the Digital Brain."""
        if current_brain_state is None:
            current_brain_state = cls.get_initial_brain_state()

        prev_means = current_brain_state["means"]
        current_cov = np.array(current_brain_state.get("covariance_matrix", (np.eye(5) * 16.0).tolist()))

        # Current state vector
        x_curr = np.array([prev_means[node] for node in KalmanBrainFilter.NODES], dtype=float)

        # Observations from session
        z_obs, active_mask = cls.map_session_to_node_observations(task_type, session_metrics, prev_means)

        # Kalman step
        kf = KalmanBrainFilter()
        x_updated, P_updated = kf.step(x_curr, current_cov, z_obs, active_mask)

        # Build NodeDeltas
        deltas: Dict[str, NodeDelta] = {}
        updated_means: Dict[str, float] = {}

        for idx, node in enumerate(KalmanBrainFilter.NODES):
            prev_val = round(float(x_curr[idx]), 2)
            upd_val = round(float(x_updated[idx]), 2)
            variance = float(P_updated[idx, idx])
            sd = math.sqrt(max(variance, 0.01))
            # 95% Confidence Interval: mean +/- 1.96 * SD
            ci_lower = round(float(upd_val - 1.96 * sd), 2)
            ci_upper = round(float(upd_val + 1.96 * sd), 2)

            deltas[node] = NodeDelta(
                previous=prev_val,
                updated=upd_val,
                confidence_interval=(ci_lower, ci_upper),
                drift_rate=session_metrics.ddm_drift_rate_v if idx == 0 else None,
            )
            updated_means[node] = upd_val

        # Detect the plasticity bottleneck for targeted next-session training
        bottleneck = cls.identify_plasticity_bottleneck(updated_means)

        brain_delta = DigitalBrainDelta(
            dlPFC=deltas["dlPFC"],
            ACC=deltas["ACC"],
            vlPFC_Striatum=deltas["vlPFC_Striatum"],
            Hippocampus_DG=deltas["Hippocampus_DG"],
            Parieto_Occipital=deltas["Parieto_Occipital"],
        )

        return DigitalBrainEvaluation(
            user_id=user_id,
            session_id=session_id,
            evaluation_timestamp=datetime.utcnow(),
            session_metrics=session_metrics,
            digital_brain_delta=brain_delta,
            plasticity_bottleneck=bottleneck,
        )
