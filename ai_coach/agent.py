"""Loti's conversational runner (Member 2).

Order of a chat turn:
1. Input gates on every USER turn the LLM would see (each turn, then all of them joined): crisis
   check, then health signpost. A hit sends a fixed reply and the LLM is never called. The user's
   text is never rewritten.
2. AI Collaboration Score and the XAI adaptation reason (Member 3's Δc).
3. Loti's reply: the LLM if one is configured, else the deterministic offline reply. An LLM error
   is logged, counted and answered with the offline reply; nothing fails silently.
4. Output guardrail: a reply that trips banned_terms.json is withheld whole and the offline reply
   goes out instead.
"""

from __future__ import annotations

import logging
from collections import Counter
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from ai_coach.collaboration_scorer import CollaborationScorer
from ai_coach.safety_guardrails import SafetyGuardrailEngine
from ai_coach.schemas import (
    ArchetypeTier,
    ChatMessage,
    ChatMessageRole,
    ChatRequest,
    CoachingResponse,
    CollaborationScoreResult,
    ReplySource,
    SafetyMetadata,
)
from ai_coach.xai_explainer import XAIExplainer

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

# Loti's voice: at most 12 words per bubble. Bubbles in one reply are separated by a blank line.
MAX_BUBBLE_WORDS = 12
BUBBLE_SEPARATOR = "\n\n"
# Turns sent to the LLM. Every USER turn in this window passes the input gates first.
HISTORY_WINDOW = 8


def split_bubbles(text: str) -> List[str]:
    """Split a reply into its speech bubbles (blank-line separated)."""
    return [b.strip() for b in text.split(BUBBLE_SEPARATOR) if b.strip()]


def _load_prompt_template(filename: str, fallback_default: str = "") -> str:
    """Safely load a text prompt template from the prompts directory."""
    target_file = PROMPTS_DIR / filename
    if target_file.is_file():
        return target_file.read_text(encoding="utf-8")
    return fallback_default


class AICoachAgent:
    """Loti's runner: input gates, XAI injection, LLM call with explicit fallback, output guardrail."""

    def __init__(
        self,
        scorer: Optional[CollaborationScorer] = None,
        explainer: Optional[XAIExplainer] = None,
        guardrail: Optional[SafetyGuardrailEngine] = None,
        llm_callable: Optional[Callable[[List[Dict[str, str]]], str]] = None,
    ):
        self.scorer = scorer or CollaborationScorer()
        self.explainer = explainer or XAIExplainer()
        self.guardrail = guardrail or SafetyGuardrailEngine()
        self.llm_callable = llm_callable
        # Every non-LLM reply path is counted (research area 7, "Log fallbacks"). Keys: ReplySource values.
        self.reply_source_counts: Counter[str] = Counter()

        # Cache base prompt
        self.system_prompt_base = _load_prompt_template(
            "system_coach.txt",
            fallback_default="You are Loti, a guide inside SynapseTwin. Warm, short, specific.",
        )

    def assemble_system_prompt(
        self,
        cluster_id: int = 4,
        delta_vector: Optional[Dict[str, float]] = None,
        uncertainty: float = 0.0,
    ) -> str:
        """Compose the full system instruction with XAI injection and safety rules."""
        xai_context = self.explainer.format_xai_prompt_context(
            delta_vector=delta_vector,
            cluster_id=cluster_id,
        )
        guardrail_mandate = self.guardrail.get_system_prompt_guardrails()

        return (
            f"{self.system_prompt_base}\n\n"
            f"{guardrail_mandate}\n\n"
            f"{xai_context}\n"
        )

    def handle_chat(self, request: ChatRequest) -> CoachingResponse:
        """Gate the user's text, then score, explain, reply and lint Loti's reply."""
        session_history = list(request.chat_history)
        session_history.append(ChatMessage(role=ChatMessageRole.USER, content=request.message))

        # 1. Input gates on every piece of user text the LLM would see, as written. On a hit
        #    nothing reaches the LLM.
        gated = self._gate_user_text(session_history[-HISTORY_WINDOW:])
        if gated is not None:
            return gated

        cluster_id = request.active_cluster_id if request.active_cluster_id is not None else 4
        delta_vec = request.delta_vector or {}

        # 2. AI Collaboration Score and the adaptation reason
        dimension_scores = self.scorer.evaluate_interaction_signals(session_history)
        collab_result: CollaborationScoreResult = self.scorer.calculate_score(
            dimension_scores=dimension_scores,
            cluster_id=cluster_id,
        )
        xai_justification = self.explainer.generate_adaptation_rationale(
            delta_vector=delta_vec,
            active_cluster_id=cluster_id,
        )

        # 3 + 4. Loti's reply, linted, with an explicit fallback
        safe_reply, safety_meta, source = self._generate_response(
            message=request.message,
            history=session_history,
            cluster_id=cluster_id,
            delta_vector=delta_vec,
            collab_result=collab_result,
        )

        suggested_actions = self._generate_suggested_actions(
            cluster_id=cluster_id,
            collab_result=collab_result,
            delta_vector=delta_vec,
        )

        return CoachingResponse(
            reply_text=safe_reply,
            xai_explanation=xai_justification,
            suggested_actions=suggested_actions,
            collab_score_snapshot=collab_result,
            safety_metadata=safety_meta,
            reply_source=source,
        )

    def _gate_user_text(self, window: List[ChatMessage]) -> Optional[CoachingResponse]:
        """Run both gates over each USER turn in the LLM window, then over those turns joined.

        Joining catches a phrase split across turns ("I want to" / "end it all"). The current
        message is the last turn, so its result wins the reply language. Crisis beats signpost.
        """
        user_turns = [m.content for m in window if m.role == ChatMessageRole.USER]
        texts = list(reversed(user_turns)) + [" ".join(user_turns)]
        for gate, source in (
            (self.guardrail.crisis_check, ReplySource.CRISIS),
            (self.guardrail.health_signpost, ReplySource.HEALTH_SIGNPOST),
        ):
            for text in texts:
                result = gate(text)
                if result.hit:
                    return self._fixed_reply(result.reply or "", source)
        return None

    def _fixed_reply(self, text: str, source: ReplySource) -> CoachingResponse:
        """A scripted reply from an input gate: no LLM, no chips, no scores."""
        self.reply_source_counts[source.value] += 1
        # The user's text is not logged: it may be the most sensitive thing they ever type here.
        logger.info("coach input gate hit (%s); fixed reply sent, LLM not called", source.value)
        return CoachingResponse(
            reply_text=text,
            suggested_actions=[],
            safety_metadata=SafetyMetadata(is_safe=True),
            reply_source=source,
        )

    def _generate_response(
        self,
        message: str,
        history: List[ChatMessage],
        cluster_id: int,
        delta_vector: Dict[str, float],
        collab_result: CollaborationScoreResult,
    ) -> Tuple[str, SafetyMetadata, ReplySource]:
        """Call the LLM if one is configured. Any failure is logged, counted and answered offline."""
        offline_reply = self._generate_offline_coaching_response(
            message=message,
            cluster_id=cluster_id,
            collab_result=collab_result,
        )

        if self.llm_callable is None:
            return offline_reply, self.guardrail.check_safety(offline_reply), ReplySource.OFFLINE

        system_prompt = self.assemble_system_prompt(
            cluster_id=cluster_id,
            delta_vector=delta_vector,
        )
        messages_payload = [{"role": "system", "content": system_prompt}]
        for msg in history[-HISTORY_WINDOW:]:  # the same window the input gates checked
            messages_payload.append({"role": msg.role.value, "content": msg.content})

        try:
            raw_reply: Any = self.llm_callable(messages_payload)
            if not isinstance(raw_reply, str) or not raw_reply.strip():
                raise ValueError(f"LLM returned an empty or non-text reply ({type(raw_reply).__name__})")
        except Exception as exc:  # noqa: BLE001 - an LLM failure must degrade the reply, never the chat
            self.reply_source_counts[ReplySource.OFFLINE_AFTER_LLM_ERROR.value] += 1
            # Log the error type only: the message of an LLM error can echo the user's words.
            logger.warning(
                "coach LLM call failed (%s); sending the offline reply",
                type(exc).__name__,
            )
            return (
                offline_reply,
                self.guardrail.check_safety(offline_reply),
                ReplySource.OFFLINE_AFTER_LLM_ERROR,
            )

        safe_reply, meta = self.guardrail.sanitize(raw_reply, fallback=offline_reply)
        if meta.sanitized:
            self.reply_source_counts[ReplySource.OFFLINE_AFTER_LINT.value] += 1
            logger.warning(
                "coach LLM reply withheld (banned terms: %s); sending the offline reply",
                ", ".join(meta.clinical_terms_detected),
            )
            return safe_reply, meta, ReplySource.OFFLINE_AFTER_LINT
        return safe_reply, meta, ReplySource.LLM

    def _generate_offline_coaching_response(
        self,
        message: str,
        cluster_id: int,
        collab_result: CollaborationScoreResult,
    ) -> str:
        """Deterministic reply in Loti's voice: at most 12 words per bubble, lint-clean.

        The adaptation reason itself travels in `CoachingResponse.xai_explanation`.
        """
        lower_msg = message.lower()
        tier = self.scorer.get_tier_for_cluster(cluster_id)

        if any(w in lower_msg for w in ["why", "harder", "faster", "change", "adapted", "pacing", "different"]):
            return "I tuned the pace to fit your recent rounds." + BUBBLE_SEPARATOR + "The reason is just below."

        if any(w in lower_msg for w in ["score", "collab", "collaboration", "rating", "progress"]):
            return (
                f"Your AI teamwork score is {collab_result.composite_score:.0f} out of 100."
                + BUBBLE_SEPARATOR
                + "Want one tip to grow it?"
            )

        tier_guidance = {
            ArchetypeTier.EXPLORER: "Small, steady steps work well right now.",
            ArchetypeTier.PRACTITIONER: "Nice rhythm. Try testing your first guess.",
            ArchetypeTier.STRATEGIST: "You're steering well. Keep checking your answers.",
        }[tier]

        return tier_guidance + BUBBLE_SEPARATOR + "What would you like to work on next?"

    def _generate_suggested_actions(
        self,
        cluster_id: int,
        collab_result: CollaborationScoreResult,
        delta_vector: Dict[str, float],
    ) -> List[str]:
        """Generate 2-3 dynamic next action cards for the user."""
        actions: List[str] = []

        # Collaboration enhancement tip
        actions.append(collab_result.growth_recommendation)

        # Dimension targeted exercise tip
        if delta_vector:
            top_dim = max(delta_vector, key=lambda k: abs(delta_vector[k]))
            actions.append(f"Try a 3-minute round on {top_dim.replace('_', ' ')}.")
        else:
            actions.append("Start your next short round.")

        actions.append("Compare your approach with your last try.")

        return actions

    def generate_learning_path(
        self,
        user_id: str,
        cluster_id: int,
        delta_vector: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """Produce a structured, personalized cognitive learning curriculum."""
        tier = self.scorer.get_tier_for_cluster(cluster_id)
        deltas = delta_vector or {}

        modules = [
            {
                "module_id": "MOD-WM-01",
                "title": "Working Memory Stabilization",
                "focus": "Dual N-Back sequence stability and chunking heuristics",
                "target_duration_mins": 10,
            },
            {
                "module_id": "MOD-PI-02",
                "title": "Matrix Pattern Induction Agility",
                "focus": "Rule-extrapolation speed across progressive rotational matrices",
                "target_duration_mins": 12,
            },
            {
                "module_id": "MOD-EF-03",
                "title": "Executive Task-Switching Conditioning",
                "focus": "Cognitive flexibility under variable distractor loads",
                "target_duration_mins": 8,
            },
        ]

        return {
            "user_id": user_id,
            "archetype_id": cluster_id,
            "archetype_tier": tier.value,
            "learning_path_title": f"{tier.value.title()} Adaptive Cognitive Track",
            "modules": modules,
            "recommended_weekly_sessions": 3 if tier == ArchetypeTier.EXPLORER else 4,
            "explainability_anchor": self.explainer.generate_adaptation_rationale(deltas, cluster_id),
            "safety_certified": True,
        }
