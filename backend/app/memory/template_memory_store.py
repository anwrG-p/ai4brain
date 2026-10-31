"""Memory Module & Canonical Template Store.

Stores:
1. Canonical test templates and blueprints.
2. Psychometric item difficulty curves (3PL-IRT norms).
3. Demographic normative distributions (mean T=50, SD=10).
4. User historical longitudinal states and active sessions.
Dual-mode: In-memory dictionary/SQLite cache with pluggable Redis/Postgres support.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import json

from app.models.brain_state import DigitalBrainEvaluation
from app.models.task_schema import TaskConfigPayload, TaskType, CorticalNode


class TemplateMemoryStore:
    """Relational and vector-ready repository for cognitive blueprints and user state."""

    def __init__(self):
        # In-memory session and user state tables
        self._user_brain_states: Dict[str, Dict[str, Any]] = {}
        self._user_evaluation_history: Dict[str, List[Dict[str, Any]]] = {}
        self._active_sessions: Dict[str, Dict[str, Any]] = {}

        # Canonical normative curves (T-scores: mean=50.0, sd=10.0)
        self._normative_distributions: Dict[str, Dict[str, float]] = {
            "dlPFC": {"mean": 50.0, "sd": 10.0, "r_xx": 0.86},
            "ACC": {"mean": 50.0, "sd": 10.0, "r_xx": 0.84},
            "vlPFC_Striatum": {"mean": 50.0, "sd": 10.0, "r_xx": 0.82},
            "Hippocampus_DG": {"mean": 50.0, "sd": 10.0, "r_xx": 0.88},
            "Parieto_Occipital": {"mean": 50.0, "sd": 10.0, "r_xx": 0.85},
        }

        # Item difficulty blueprints for IRT anchoring
        self._item_difficulty_banks: Dict[str, List[Dict[str, float]]] = {
            TaskType.INTERFERENCE_N_BACK.value: [
                {"b": -1.2, "a": 1.1, "c": 0.0},
                {"b": -0.5, "a": 1.2, "c": 0.0},
                {"b": 0.0, "a": 1.3, "c": 0.0},
                {"b": 0.8, "a": 1.4, "c": 0.0},
                {"b": 1.6, "a": 1.5, "c": 0.0},
            ],
            TaskType.RELATIONAL_RESPONDING_RFT.value: [
                {"b": -1.0, "a": 1.0, "c": 0.5},
                {"b": -0.2, "a": 1.2, "c": 0.5},
                {"b": 0.5, "a": 1.3, "c": 0.5},
                {"b": 1.2, "a": 1.5, "c": 0.5},
                {"b": 2.0, "a": 1.7, "c": 0.5},
            ]
        }

    def get_user_brain_state(self, user_id: str) -> Dict[str, Any]:
        """Fetch active user state, initializing to normative 50.0 T-scores if new."""
        if user_id not in self._user_brain_states:
            self._user_brain_states[user_id] = {
                "means": {
                    "dlPFC": 50.0,
                    "ACC": 50.0,
                    "vlPFC_Striatum": 50.0,
                    "Hippocampus_DG": 50.0,
                    "Parieto_Occipital": 50.0,
                },
                "variances": {node: 16.0 for node in self._normative_distributions.keys()},
                "last_active": datetime.utcnow().isoformat(),
                "session_count": 0,
            }
        return self._user_brain_states[user_id]

    def save_evaluation(self, eval_data: DigitalBrainEvaluation) -> None:
        """Persist evaluation results and update current brain state."""
        user_id = eval_data.user_id
        current = self.get_user_brain_state(user_id)

        # Update means
        for node in ["dlPFC", "ACC", "vlPFC_Striatum", "Hippocampus_DG", "Parieto_Occipital"]:
            node_delta = getattr(eval_data.digital_brain_delta, node)
            current["means"][node] = node_delta.updated

        current["last_active"] = eval_data.evaluation_timestamp.isoformat()
        current["session_count"] = current.get("session_count", 0) + 1
        self._user_brain_states[user_id] = current

        # Append to historical ledger
        if user_id not in self._user_evaluation_history:
            self._user_evaluation_history[user_id] = []
        self._user_evaluation_history[user_id].append(eval_data.model_dump())

    def get_user_history(self, user_id: str) -> List[Dict[str, Any]]:
        """Retrieve longitudinal sequence of evaluations for user."""
        return self._user_evaluation_history.get(user_id, [])

    def cache_session(self, session_id: str, session_info: Dict[str, Any]) -> None:
        """Store active session payload in low-latency cache."""
        session_info["cached_at"] = datetime.utcnow().isoformat()
        self._active_sessions[session_id] = session_info

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve active session by ID."""
        return self._active_sessions.get(session_id)

    def set_user_brain_state(self, user_id: str, state: Dict[str, Any]) -> None:
        """Explicitly set user brain state."""
        self._user_brain_states[user_id] = state

    def clear_user_data(self, user_id: str) -> int:
        """Clear all historical and active data for a user; return how many evaluations were dropped."""
        self._user_brain_states.pop(user_id, None)
        history = self._user_evaluation_history.pop(user_id, [])
        mine = [s for s, info in self._active_sessions.items() if info.get("context", {}).get("user_id") == user_id]
        for session_id in mine:
            del self._active_sessions[session_id]
        return len(history)

    def get_normative_baseline(self, node: str) -> Dict[str, float]:
        """Fetch population norm for a target cortical node."""
        return self._normative_distributions.get(node, {"mean": 50.0, "sd": 10.0, "r_xx": 0.85})


# Global singleton instance
memory_store = TemplateMemoryStore()
