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
from typing import Any, Dict, List, Optional, Pattern
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
        self, typed_turns: List[str], weights: Optional[DimensionWeights] = None
    ) -> Dict[str, Any]:
        """The score from what the user typed to Loti, with evidence or not at all (OQ-3, R15).

        `typed_turns`: the user's typed messages from ai_coach/chat_store. Clicked chips are our own
        copy, so they never count. Telemetry is not used: response times say nothing about how
        someone works with an AI.

        Each dimension is the share of typed turns that show its markers (EVIDENCE_MARKERS),
        0-100. A dimension with fewer than MIN_EVIDENCE_TURNS marked turns is null: no base value
        stands in for missing evidence. responsible_use has only misuse markers, so it gets a
        value only when misuse shows up, as 100 minus the misuse share.

        {"status": "not_enough_data"} below MIN_TYPED_TURNS typed turns or MIN_DIMENSIONS
        evidenced dimensions. The composite is the mean of the evidenced dimensions (equal weights;
        no archetype is known until clustering lands, so none is claimed unless weights are provided).
        """
        if len(typed_turns) < MIN_TYPED_TURNS:
            return {"status": "not_enough_data"}
        texts = [t.lower().replace("’", "'") for t in typed_turns]
        marked = {
            dim: sum(1 for t in texts if rx.search(t)) for dim, rx in EVIDENCE_MARKERS.items()
        }
        n = len(texts)
        scores: Dict[str, Optional[float]] = {}
        for dim, count in marked.items():
            if count < MIN_EVIDENCE_TURNS:
                scores[dim] = None
            elif dim == CollaborationDimension.RESPONSIBLE_USE.value:
                scores[dim] = round(100.0 * (1 - count / n), 1)
            else:
                scores[dim] = round(100.0 * count / n, 1)
        evidenced = {k: v for k, v in scores.items() if v is not None}
        if len(evidenced) < MIN_DIMENSIONS:
            return {"status": "not_enough_data"}

        if weights is not None:
            raw_w = weights.to_dict() if hasattr(weights, "to_dict") else weights
            weight_sum = sum(raw_w[k] for k in evidenced)
            normalized_weights = {
                k: round(raw_w[k] / weight_sum, 4) if k in evidenced else None
                for k in scores
            }
        else:
            eq = round(1.0 / len(evidenced), 4)
            normalized_weights = {
                k: eq if k in evidenced else None
                for k in scores
            }

        composite = sum(evidenced[k] * normalized_weights[k] for k in evidenced)
        weakest = min(evidenced, key=evidenced.get)
        tip_scores = DimensionScores(**{k: (0.0 if k == weakest else 100.0) for k in scores})
        tip_weights = weights if weights is not None else CISTAC_PROPOSED_WEIGHTS
        return {
            "status": "ok",
            "composite_score": round(max(0.0, min(100.0, composite)), 1),
            "dimension_scores": scores,
            "dimension_weights": normalized_weights,
            "growth_recommendation": self._generate_growth_recommendation(tip_scores, tip_weights, None),
            "evidence": {"typed_turns": n, "marked_turns": marked},
        }


# GET /v1/coach/collaboration-score (see score_stored_history).
MIN_TYPED_TURNS = 10
MIN_EVIDENCE_TURNS = 2  # one phrase is a sentence, not a habit
MIN_DIMENSIONS = 3
# Markers on lowercased typed turns. A turn counts at most once per dimension.
EVIDENCE_MARKERS: Dict[str, Pattern[str]] = {
    CollaborationDimension.CLARIFICATION.value: re.compile(
        r"\b(?:why|how (?:do|does|did|can|should|come)|what does|what do you mean|explain|clarify|"
        r"for example|an example|break (?:it |this )?down|what is the (?:rule|goal|point of this))\b"
    ),
    CollaborationDimension.CRITICAL_VERIFICATION.value: re.compile(
        r"\b(?:are you sure|is (?:that|this|it) (?:right|correct|true)|verify|double[- ]check|"
        r"check (?:that|this|it|again)|source|what if|counter[- ]?example|evidence|assumption|validate)\b"
    ),
    CollaborationDimension.ITERATION.value: re.compile(
        r"\b(?:instead|rather|another way|try again|one more time|tweak|adjust|modify|"
        r"different (?:way|approach|strategy)|next time|refine)\b"
    ),
    CollaborationDimension.AUTONOMY.value: re.compile(
        r"\b(?:i think|i tried|my approach|my strategy|i decided|i solved|my solution|i noticed|"
        r"i figured|my guess|let me try|i'll try|i want to try)\b"
    ),
    # Misuse only: no phrase shows responsible use, so this dimension can only lose points.
    CollaborationDimension.RESPONSIBLE_USE.value: re.compile(
        r"\b(?:ignore (?:all |your |the |previous )*(?:instructions|rules)|jailbreak|cheat|bypass|"
        r"just give me the answer|do it for me)\b"
    ),
}
# Canonical CISTAC 1.0 proposed baseline weights (Layer C specification):
# clarification 20%, critical verification 25%, iteration 20%, autonomy 20%, responsible use 15%
CISTAC_PROPOSED_WEIGHTS = DimensionWeights(
    clarification=0.20,
    critical_verification=0.25,
    iteration=0.20,
    autonomy=0.20,
    responsible_use=0.15,
)
EQUAL_WEIGHTS = DimensionWeights(
    clarification=0.2, critical_verification=0.2, iteration=0.2, autonomy=0.2, responsible_use=0.2
)
