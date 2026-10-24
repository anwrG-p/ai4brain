"""Schmitt-Trigger Hysteresis Gate with Dwell-Time Filter.

Prevents rapid oscillating cluster jumps (anti-chattering filter) caused by
momentary fatigue, distraction, or lucky guesses.

A transition to target_cluster is only executed if:
    gamma_target(s_bar_t) - gamma_active(s_bar_t) > delta_hyst   (default: 0.15)
across N_confirm consecutive evaluation windows (default: 3).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Union


@dataclass
class HysteresisState:
    """Internal hysteresis tracking state for a single user."""

    active_cluster_id: int
    candidate_target_id: Optional[int] = None
    candidate_streak: int = 0
    transition_history: List[int] = field(default_factory=list)


@dataclass(frozen=True)
class TransitionDecision:
    """Output decision of the hysteresis gate at step t."""

    has_transitioned: bool
    active_cluster_id: int
    from_cluster: Optional[int]
    to_cluster: Optional[int]
    confidence_margin: float
    candidate_cluster_id: Optional[int]
    candidate_streak: int


class SchmittTriggerHysteresisGate:
    """Schmitt-Trigger Hysteresis Gate with dwell-time confirmation filter."""

    def __init__(
        self,
        delta_hyst: float = 0.15,
        n_confirm: int = 3,
        default_cluster_id: int = 1,
    ) -> None:
        """Initialize the hysteresis gate.

        Args:
            delta_hyst: Margin threshold required above active cluster probability (0.15).
            n_confirm: Consecutive frames the candidate must maintain margin before switching (3).
            default_cluster_id: Fallback cluster ID if unassigned (1..9).
        """
        if delta_hyst < 0.0 or delta_hyst >= 1.0:
            raise ValueError(f"delta_hyst must be in [0.0, 1.0), got {delta_hyst}")
        if n_confirm < 1:
            raise ValueError(f"n_confirm must be >= 1, got {n_confirm}")

        self.delta_hyst: float = float(delta_hyst)
        self.n_confirm: int = int(n_confirm)
        self.default_cluster_id: int = int(default_cluster_id)
        self._user_states: Dict[str, HysteresisState] = {}

    def process(
        self,
        user_id: str,
        responsibilities: Union[Dict[int, float], Dict[str, float]],
    ) -> TransitionDecision:
        """Process cluster responsibilities through the Schmitt-trigger and dwell filter.

        Args:
            user_id: Unique user session identifier.
            responsibilities: Cluster responsibilities keyed by int (1..9) or code ('C1'..'C9').

        Returns:
            TransitionDecision indicating active cluster, transition status, and margins.
        """
        # Normalize responsibilities into Dict[int, float]
        resp_by_id: Dict[int, float] = {}
        for k, v in responsibilities.items():
            if isinstance(k, str):
                cluster_num = int(k.replace("C", ""))
            else:
                cluster_num = int(k)
            resp_by_id[cluster_num] = float(v)

        if not resp_by_id:
            raise ValueError("Responsibilities dictionary cannot be empty.")

        # Candidate with highest responsibility at this window
        top_candidate_id = max(resp_by_id, key=resp_by_id.get)
        top_prob = resp_by_id[top_candidate_id]

        # First observation initialization
        if user_id not in self._user_states:
            self._user_states[user_id] = HysteresisState(
                active_cluster_id=top_candidate_id,
                candidate_target_id=None,
                candidate_streak=0,
                transition_history=[top_candidate_id],
            )
            return TransitionDecision(
                has_transitioned=False,
                active_cluster_id=top_candidate_id,
                from_cluster=None,
                to_cluster=None,
                confidence_margin=0.0,
                candidate_cluster_id=None,
                candidate_streak=0,
            )

        state = self._user_states[user_id]
        active_id = state.active_cluster_id
        active_prob = resp_by_id.get(active_id, 0.0)

        # If highest candidate is already active cluster
        if top_candidate_id == active_id:
            state.candidate_target_id = None
            state.candidate_streak = 0
            return TransitionDecision(
                has_transitioned=False,
                active_cluster_id=active_id,
                from_cluster=None,
                to_cluster=None,
                confidence_margin=0.0,
                candidate_cluster_id=None,
                candidate_streak=0,
            )

        # Margin over active cluster
        margin = top_prob - active_prob

        # Check Schmitt-trigger threshold
        if margin > self.delta_hyst:
            if state.candidate_target_id == top_candidate_id:
                state.candidate_streak += 1
            else:
                state.candidate_target_id = top_candidate_id
                state.candidate_streak = 1

            # Check dwell-time confirmation
            if state.candidate_streak >= self.n_confirm:
                # Trigger cluster jump
                from_cluster = active_id
                to_cluster = top_candidate_id
                state.active_cluster_id = to_cluster
                state.transition_history.append(to_cluster)
                state.candidate_target_id = None
                state.candidate_streak = 0

                return TransitionDecision(
                    has_transitioned=True,
                    active_cluster_id=to_cluster,
                    from_cluster=from_cluster,
                    to_cluster=to_cluster,
                    confidence_margin=float(round(margin, 4)),
                    candidate_cluster_id=None,
                    candidate_streak=0,
                )
            else:
                # Accumulating dwell confirmation frames
                return TransitionDecision(
                    has_transitioned=False,
                    active_cluster_id=active_id,
                    from_cluster=None,
                    to_cluster=None,
                    confidence_margin=float(round(margin, 4)),
                    candidate_cluster_id=top_candidate_id,
                    candidate_streak=state.candidate_streak,
                )
        else:
            # Margin condition not met, reset candidate streak to prevent chattering
            state.candidate_target_id = None
            state.candidate_streak = 0
            return TransitionDecision(
                has_transitioned=False,
                active_cluster_id=active_id,
                from_cluster=None,
                to_cluster=None,
                confidence_margin=float(round(margin, 4)),
                candidate_cluster_id=None,
                candidate_streak=0,
            )

    def get_active_cluster(self, user_id: str) -> int:
        """Get the active cluster ID for user, or default if uninitialized."""
        if user_id in self._user_states:
            return self._user_states[user_id].active_cluster_id
        return self.default_cluster_id

    def set_active_cluster(self, user_id: str, cluster_id: int) -> None:
        """Explicitly set or override active cluster for a user."""
        if not (1 <= cluster_id <= 9):
            raise ValueError(f"Cluster id must be in 1..9, got {cluster_id}")
        if user_id not in self._user_states:
            self._user_states[user_id] = HysteresisState(
                active_cluster_id=cluster_id,
                candidate_target_id=None,
                candidate_streak=0,
                transition_history=[cluster_id],
            )
        else:
            self._user_states[user_id].active_cluster_id = cluster_id
            self._user_states[user_id].candidate_target_id = None
            self._user_states[user_id].candidate_streak = 0

    def reset(self, user_id: Optional[str] = None) -> None:
        """Reset hysteresis state for specific user, or all users."""
        if user_id is None:
            self._user_states.clear()
        else:
            self._user_states.pop(user_id, None)
