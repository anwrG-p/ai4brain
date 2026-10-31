"""Dynamic AI Collaboration Scorer for Member 2.

Implements the dynamic scoring equation from README:
    S_collab = sum_{i=1}^5 w_i(s_t) * V_i,  where sum(w_i) = 1.0

The 5 dimensions evaluated:
1. Clarification (V_1)
2. Critical Verification (V_2)
3. Iteration (V_3)
4. Autonomy (V_4)
5. Responsible Use (V_5)

Weights w_i(s_t) are dynamically tuned based on the active cognitive archetype
(e.g., K=9 GMM clusters from Member 3):
- Explorer / Beginner (Clusters 0, 1, 2): Prioritizes Clarification & Iteration.
- Practitioner / Intermediate (Clusters 3, 4, 5): Balanced scaffolding.
- Strategist / Advanced (Clusters 6, 7, 8): Prioritizes Critical Verification & Autonomy.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
from ai_coach.schemas import (
    ArchetypeTier,
    ChatMessage,
    ChatMessageRole,
    CollaborationDimension,
    CollaborationScoreResult,
    DimensionScores,
    DimensionWeights,
)


# Canonical weight configurations for the 9 GMM cluster archetypes (0..8)
# Each row guarantees sum(w_i) == 1.0
ARCHETYPE_WEIGHT_PROFILES: Dict[int, DimensionWeights] = {
    # Tier: Explorer / Beginner (Emphasis on Clarification and Iteration)
    0: DimensionWeights(
        clarification=0.35,
        critical_verification=0.10,
        iteration=0.30,
        autonomy=0.10,
        responsible_use=0.15,
    ),
    1: DimensionWeights(
        clarification=0.30,
        critical_verification=0.10,
        iteration=0.30,
        autonomy=0.10,
        responsible_use=0.20,
    ),
    2: DimensionWeights(
        clarification=0.25,
        critical_verification=0.15,
        iteration=0.30,
        autonomy=0.15,
        responsible_use=0.15,
    ),
    # Tier: Practitioner / Intermediate (Balanced Development)
    3: DimensionWeights(
        clarification=0.20,
        critical_verification=0.20,
        iteration=0.25,
        autonomy=0.20,
        responsible_use=0.15,
    ),
    4: DimensionWeights(
        clarification=0.20,
        critical_verification=0.20,
        iteration=0.20,
        autonomy=0.20,
        responsible_use=0.20,
    ),
    5: DimensionWeights(
        clarification=0.15,
        critical_verification=0.25,
        iteration=0.20,
        autonomy=0.25,
        responsible_use=0.15,
    ),
    # Tier: Strategist / Advanced (Emphasis on Critical Verification and Autonomy)
    6: DimensionWeights(
        clarification=0.10,
        critical_verification=0.30,
        iteration=0.15,
        autonomy=0.30,
        responsible_use=0.15,
    ),
    7: DimensionWeights(
        clarification=0.10,
        critical_verification=0.35,
        iteration=0.10,
        autonomy=0.30,
        responsible_use=0.15,
    ),
    8: DimensionWeights(
        clarification=0.05,
        critical_verification=0.35,
        iteration=0.10,
        autonomy=0.40,
        responsible_use=0.10,
    ),
}


class CollaborationScorer:
    """Engine for dynamically calculating AI Collaboration Scores."""

    def __init__(self, weight_profiles: Optional[Dict[int, DimensionWeights]] = None):
        self.weight_profiles = weight_profiles or ARCHETYPE_WEIGHT_PROFILES

    @staticmethod
    def get_tier_for_cluster(cluster_id: int) -> ArchetypeTier:
        """Map cluster index (0..8) to its categorical progression tier."""
        if cluster_id <= 2:
            return ArchetypeTier.EXPLORER
        elif cluster_id <= 5:
            return ArchetypeTier.PRACTITIONER
        else:
            return ArchetypeTier.STRATEGIST

    def get_weights(self, cluster_id: int) -> DimensionWeights:
        """Fetch the normalized weight vector for a given archetype cluster index."""
        clamped_id = max(0, min(8, cluster_id))
        return self.weight_profiles.get(clamped_id, self.weight_profiles[4])

    def calculate_score(
        self,
        dimension_scores: DimensionScores,
        cluster_id: int = 4
    ) -> CollaborationScoreResult:
        """Compute the weighted composite collaboration score S_collab in [0, 100].

        Formula:
            S_collab = sum_{i=1}^5 w_i(cluster_id) * V_i
        """
        weights = self.get_weights(cluster_id)
        tier = self.get_tier_for_cluster(cluster_id)

        w_dict = weights.to_dict()
        s_dict = dimension_scores.to_dict()

        weighted_contributions: Dict[str, float] = {}
        composite_score = 0.0

        for dim_key, score_val in s_dict.items():
            weight_val = w_dict[dim_key]
            contrib = weight_val * score_val
            weighted_contributions[dim_key] = round(contrib, 2)
            composite_score += contrib

        composite_score = round(max(0.0, min(100.0, composite_score)), 2)

        recommendation = self._generate_growth_recommendation(
            dimension_scores=dimension_scores,
            weights=weights,
            tier=tier
        )

        return CollaborationScoreResult(
            composite_score=composite_score,
            archetype_id=cluster_id,
            archetype_tier=tier,
            dimension_scores={k: round(v, 2) for k, v in s_dict.items()},
            dimension_weights={k: round(v, 4) for k, v in w_dict.items()},
            weighted_contributions=weighted_contributions,
            growth_recommendation=recommendation
        )

    def evaluate_interaction_signals(
        self,
        chat_history: List[ChatMessage],
        telemetry_summary: Optional[Dict[str, Any]] = None
    ) -> DimensionScores:
        """Heuristically estimate the 5 dimension scores V_i from user chat patterns & telemetry.
        
        Args:
            chat_history: Sequence of user and coach messages in the session.
            telemetry_summary: Optional behavioral signals from Member 1 / Member 3.
        """
        user_msgs = [m.content for m in chat_history if m.role == ChatMessageRole.USER]
        total_turns = len(user_msgs)

        if total_turns == 0:
            return DimensionScores()  # Default baseline 50s

        all_user_text = " ".join(user_msgs).lower()

        # 1. Clarification score (asking questions, seeking definitions, requesting examples)
        clarification_markers = len(re.findall(r"\b(why|how|what does|could you explain|clarify|example|break down|mean)\b", all_user_text))
        question_marks = all_user_text.count("?")
        clar_signal = (clarification_markers * 8.0) + (question_marks * 5.0)
        clarification_score = min(100.0, max(20.0, 40.0 + clar_signal / max(1, total_turns)))

        # 2. Critical Verification score (testing assumptions, double-checking, seeking justification)
        verification_markers = len(re.findall(r"\b(are you sure|verify|source|double check|what if|counterexample|is this correct|alternative|assumption|validate)\b", all_user_text))
        verif_signal = verification_markers * 15.0
        critical_verification_score = min(100.0, max(20.0, 35.0 + verif_signal / max(1, total_turns)))

        # 3. Iteration score (multi-turn back-and-forth, refining, tweaking)
        iter_signal = min(40.0, total_turns * 6.0)
        refine_markers = len(re.findall(r"\b(instead|rather|update|tweak|adjust|modify|next step|follow up|again)\b", all_user_text))
        iteration_score = min(100.0, max(25.0, 30.0 + iter_signal + (refine_markers * 7.0)))

        # 4. Autonomy score (independent synthesis, presenting own thoughts first)
        autonomy_markers = len(re.findall(r"\b(i think|my approach|i tried|i decided|i solved|my solution|i noticed|in my opinion)\b", all_user_text))
        autonomy_signal = autonomy_markers * 12.0
        autonomy_score = min(100.0, max(20.0, 40.0 + autonomy_signal / max(1, total_turns)))

        # 5. Responsible Use score (proper pacing, ethical and constructive communication)
        negative_markers = len(re.findall(r"\b(ignore previous instructions|jailbreak|cheat|bypass)\b", all_user_text))
        base_resp = 80.0 - (negative_markers * 30.0)
        responsible_use_score = min(100.0, max(10.0, base_resp))

        # Adjust with telemetry if available
        if telemetry_summary:
            avg_rt = telemetry_summary.get("avg_response_time_ms", 1000)
            if avg_rt > 600 and telemetry_summary.get("hesitation_jitter", 0.0) < 0.3:
                autonomy_score = min(100.0, autonomy_score + 5.0)

        return DimensionScores(
            clarification=round(clarification_score, 2),
            critical_verification=round(critical_verification_score, 2),
            iteration=round(iteration_score, 2),
            autonomy=round(autonomy_score, 2),
            responsible_use=round(responsible_use_score, 2),
        )

    def _generate_growth_recommendation(
        self,
        dimension_scores: DimensionScores,
        weights: DimensionWeights,
        tier: Optional[ArchetypeTier]
    ) -> str:
        """Provide a dynamic growth-mindset tip based on the highest-weighted opportunity."""
        s_dict = dimension_scores.to_dict()
        w_dict = weights.to_dict()

        # Find the dimension with high weight that has room for score improvement
        gap_scores = {k: (100.0 - s_dict[k]) * w_dict[k] for k in s_dict}
        priority_dim = max(gap_scores, key=gap_scores.get)

        recommendations = {
            CollaborationDimension.CLARIFICATION.value: (
                "Try asking the AI coach to deconstruct complex multi-step reasoning into intermediate checkpoints."
            ),
            CollaborationDimension.CRITICAL_VERIFICATION.value: (
                "Challenge AI suggestions by asking 'What counterexamples or edge cases could break this approach?'"
            ),
            CollaborationDimension.ITERATION.value: (
                "Deepen the dialogue: take a working response and ask for an optimized or refactored alternative."
            ),
            CollaborationDimension.AUTONOMY.value: (
                "Outline your hypothesis or proposed approach first before prompting the coach for guidance."
            ),
            CollaborationDimension.RESPONSIBLE_USE.value: (
                "Continue maintaining steady pacing and clear verification boundaries during cognitive challenges."
            ),
        }

        tier_prefix = {
            None: "",  # no archetype known: no tier claim
            ArchetypeTier.EXPLORER: "Foundational Step: ",
            ArchetypeTier.PRACTITIONER: "Skill Expansion: ",
            ArchetypeTier.STRATEGIST: "Mastery Refinement: ",
        }[tier]

        return tier_prefix + recommendations.get(priority_dim, "Keep exploring collaborative cognitive workflows!")

    def score_stored_history(
        self,
        user_turns: List[str],
        telemetry_summary: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """The score from the user's stored chat history and real session telemetry (OQ-3, R15).

        `user_turns`: what the user typed or picked, as stored by ai_coach/chat_store.
        `telemetry_summary`: {"sessions", "avg_response_time_ms", "hesitation_jitter"} from the
        user's telemetry, or None. Returns {"status": "not_enough_data"} below MIN_USER_TURNS
        stored turns or MIN_TELEMETRY_SESSIONS sessions: with fewer turns, a single phrase moves a
        dimension by 8 points or more, so the number would describe one sentence, not a habit.

        No archetype is known yet (clustering lands in BE-09/BE-11), so the weights are equal and
        no tier is claimed. They switch to the archetype's profile once the server knows it.
        """
        sessions = int((telemetry_summary or {}).get("sessions", 0))
        if len(user_turns) < MIN_USER_TURNS or sessions < MIN_TELEMETRY_SESSIONS:
            return {"status": "not_enough_data"}
        history = [ChatMessage(role=ChatMessageRole.USER, content=t) for t in user_turns]
        scores = self.evaluate_interaction_signals(history, telemetry_summary)
        s_dict, w_dict = scores.to_dict(), EQUAL_WEIGHTS.to_dict()
        contributions = {k: round(w_dict[k] * s_dict[k], 2) for k in s_dict}
        total = round(max(0.0, min(100.0, sum(w_dict[k] * s_dict[k] for k in s_dict))), 2)
        return {
            "status": "ok",
            "composite_score": total,
            "dimension_scores": {k: round(v, 2) for k, v in s_dict.items()},
            "dimension_weights": w_dict,
            "weighted_contributions": contributions,
            "growth_recommendation": self._generate_growth_recommendation(scores, EQUAL_WEIGHTS, None),
            "evidence": {"user_turns": len(user_turns), "sessions": sessions},
        }


# Below these, GET /v1/coach/collaboration-score answers not_enough_data (see score_stored_history).
MIN_USER_TURNS = 10
MIN_TELEMETRY_SESSIONS = 1
EQUAL_WEIGHTS = DimensionWeights(
    clarification=0.2, critical_verification=0.2, iteration=0.2, autonomy=0.2, responsible_use=0.2
)
