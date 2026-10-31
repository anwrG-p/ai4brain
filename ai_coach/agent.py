"""Loti's conversational runner (Member 2).

Order of a chat turn:
1. Input gates, on the user's words as written (never rewritten), in this order (R14):
   a. the keyword crisis gate: the crisis reply goes out when the current message hits, or the
      previous user turn joined with it;
   b. the LLM backup crisis classifier, if one is configured (crisis_classifier.py): "high" gets
      the crisis reply, "low" the gentler crisis signpost. If it fails, the turn fails closed: the
      coach LLM is not called and the scripted offline reply goes out;
   c. the health signpost, when the current message raises health.
   On a hit the LLM is never called. Earlier user turns that trip the crisis check, and fixed
   crisis replies (whole or any bubble) with the user turn they answered, are redacted from the LLM
   payload, and the chat carries on. With a classifier configured (every API turn), the LLM sees
   only the current user message plus Loti's turns: no earlier user turn, since it may never have
   had a verdict of its own. (An agent built with an LLM but no classifier keeps the older window;
   the API never builds one.)
2. AI Collaboration Score and the XAI adaptation reason (Member 3's Δc).
3. Loti's reply: the LLM if one is configured, else the deterministic offline reply. An LLM error
   is logged, counted and answered with the offline reply; nothing fails silently.
4. Output guardrail: a reply that trips banned_terms.json is withheld whole and the offline reply
   goes out instead (offline_after_lint). Then the shape and number checks (research 7.3): at most
   3 bubbles; a bubble over 12 words keeps its leading whole sentences, or the reply is withheld;
   a number (digits or a spelled-out word) not found in the turns the user saw withholds the
   reply (offline_after_check).
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from ai_coach.collaboration_scorer import CollaborationScorer
from ai_coach.crisis_classifier import ClassifierError, CrisisClassifier, Risk
from ai_coach.safety_guardrails import (
    CRISIS_REPLY_EN,
    CRISIS_REPLY_FR,
    CRISIS_SIGNPOST_EN,
    CRISIS_SIGNPOST_FR,
    SafetyGuardrailEngine,
    is_fixed_crisis_reply,
    reads_french,
)
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


MAX_BUBBLES = 3

# The deterministic offline replies (see _generate_offline_coaching_response).
# No "see below" in the why reply: the chat route sends no adaptation reason with it.
OFFLINE_WHY_REPLY = "I tuned the pace to fit your recent rounds." + BUBBLE_SEPARATOR + "Want to try the next one?"
# No number here (R15): one chat is not enough data. The score has its own route, which answers
# not_enough_data until the stored chat history supports one.
OFFLINE_SCORE_REPLY = (
    "Your scores show on Home once there's enough data." + BUBBLE_SEPARATOR + "Want one tip for your next round?"
)
OFFLINE_TIER_GUIDANCE = {
    ArchetypeTier.EXPLORER: "Small, steady steps work well right now.",
    ArchetypeTier.PRACTITIONER: "Nice rhythm. Try testing your first guess.",
    ArchetypeTier.STRATEGIST: "You're steering well. Keep checking your answers.",
}
OFFLINE_NEXT_QUESTION = "What would you like to work on next?"


def known_loti_replies() -> Set[str]:
    """Every fixed or scripted reply the backend itself can send, whole and bubble by bubble."""
    from ai_coach import safety_guardrails as g

    replies = [
        OFFLINE_WHY_REPLY,
        OFFLINE_SCORE_REPLY,
        *(t + BUBBLE_SEPARATOR + OFFLINE_NEXT_QUESTION for t in OFFLINE_TIER_GUIDANCE.values()),
        g.CRISIS_REPLY_EN, g.CRISIS_REPLY_FR, g.CRISIS_SIGNPOST_EN, g.CRISIS_SIGNPOST_FR,
        g.FRONTEND_CRISIS_MESSAGE, g.HEALTH_SIGNPOST_REPLY, g.SAFE_FALLBACK_REPLY,
    ]
    return {part for r in replies for part in (r, *split_bubbles(r))}


def split_bubbles(text: str) -> List[str]:
    """Split a reply into its speech bubbles (blank-line separated)."""
    return [b.strip() for b in text.split(BUBBLE_SEPARATOR) if b.strip()]


_SENTENCE_END = re.compile(r"(?<=[.!?…])\s+")


def fit_bubbles(text: str) -> Optional[str]:
    """The reply in Loti's shape, or None when it cannot be made to fit.

    At most MAX_BUBBLES bubbles. A bubble over MAX_BUBBLE_WORDS words keeps its leading whole
    sentences that fit; if not even its first sentence fits, the reply is rejected (no mid-sentence
    cuts: a half sentence can change the meaning).
    """
    bubbles = split_bubbles(text)
    if not bubbles or len(bubbles) > MAX_BUBBLES:
        return None
    out = []
    for bubble in bubbles:
        kept: List[str] = []
        for sentence in _SENTENCE_END.split(bubble):
            if len(" ".join([*kept, sentence]).split()) > MAX_BUBBLE_WORDS:
                break
            kept.append(sentence)
        if not kept:
            return None
        out.append(" ".join(kept))
    return BUBBLE_SEPARATOR.join(out)


# Spelled-out numbers the check also catches (English and French). Left out on purpose, as words
# that are also something else: one / un / une (pronouns and articles: "try that one"), neuf
# ("new"), seize ("seize the moment") and sept (the English "Sept." for September).
_NUMBER_WORDS = {
    **dict(zip(
        "two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen "
        "sixteen seventeen eighteen nineteen twenty".split(), range(2, 21))),
    "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80,
    "ninety": 90, "hundred": 100, "thousand": 1000,
    "deux": 2, "trois": 3, "quatre": 4, "cinq": 5, "huit": 8,
    "dix": 10, "onze": 11, "douze": 12, "treize": 13, "quatorze": 14, "quinze": 15,
    "vingt": 20, "trente": 30, "quarante": 40, "cinquante": 50, "soixante": 60, "cent": 100,
    "mille": 1000,
}
_DIGITS = re.compile(r"\d+(?:[.,]\d+)?")


def numbers_in(text: str) -> Set[str]:
    """Every number in `text`, normalised ("20%" and "twenty" -> "20", "1,5" -> "1.5")."""
    found = {f"{float(d.replace(',', '.')):g}" for d in _DIGITS.findall(text)}
    for word in re.findall(r"[a-zà-ÿ]+", text.lower()):
        if word in _NUMBER_WORDS:
            found.add(f"{_NUMBER_WORDS[word]:g}")
    return found


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
        crisis_classifier: Optional[CrisisClassifier] = None,
    ):
        self.scorer = scorer or CollaborationScorer()
        self.explainer = explainer or XAIExplainer()
        self.guardrail = guardrail or SafetyGuardrailEngine()
        self.llm_callable = llm_callable
        # R14: wherever an LLM path is configured, a backup classifier must be too (the API builds
        # both from one GEMINI_API_KEY). It runs after the keyword gate, before the coach LLM.
        self.crisis_classifier = crisis_classifier
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

        # 1. Input gates on the user's words as written. On a hit nothing reaches the LLM. Older
        #    turns that hit are redacted from the LLM payload instead, so one false hit cannot lock
        #    the coach for the whole window.
        gated, llm_allowed, classified = self._gate_user_text(request.chat_history, request.message)
        if gated is not None:
            return gated
        window = session_history[-HISTORY_WINDOW:]
        if classified is not None:
            # R14: with a classifier, the LLM sees ONLY the current user message plus Loti's turns.
            # The classifier rates the current message; an earlier user turn was at most context
            # here and may never have had a verdict of its own (its call can have failed closed).
            # The number check's allowance follows the window, so numbers from dropped turns are
            # not allowed either.
            current = session_history[-1]
            dropped = sum(1 for m in window if m.role == ChatMessageRole.USER and m is not current)
            if dropped:
                self.reply_source_counts["earlier_user_turn_dropped"] += dropped
            window = [m for m in window if m.role != ChatMessageRole.USER or m is current]
        llm_window = self._redact_crisis_turns(window)

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
            history=llm_window,
            cluster_id=cluster_id,
            delta_vector=delta_vec,
            collab_result=collab_result,
            llm_allowed=llm_allowed,
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

    def _gate_user_text(
        self, history: List[ChatMessage], message: str
    ) -> Tuple[Optional[CoachingResponse], bool, Optional[List[ChatMessage]]]:
        """(fixed reply or None, whether the coach LLM may be called, the history turns the
        classifier read as context; None when no classifier is configured).

        Keyword gate: the crisis reply when the CURRENT message hits, or the previous user turn
        joined with it. The join catches a phrase split across the last two turns ("I want to" /
        "end it all"). Older turns never trigger the reply; `_redact_crisis_turns` keeps them from
        the LLM. Then the backup classifier. Then the health signpost, which looks at the current
        message only, so health mentioned earlier does not lock the chat into the doctor reply.
        The signpost also runs when the classifier failed: it is deterministic, and a fixed reply.
        """
        prev_idx = next(
            (i for i in range(len(history) - 1, -1, -1) if history[i].role == ChatMessageRole.USER),
            None,
        )
        previous = history[prev_idx].content if prev_idx is not None else None
        candidates = [message]
        # The join is for split phrases only. A previous turn that hit on its own already got the
        # crisis reply; joining it again would lock the next, benign message too.
        if previous and not self.guardrail.crisis_check(previous).hit:
            candidates.append(f"{previous} {message}")
        for text in candidates:
            crisis = self.guardrail.crisis_check(text)
            if crisis.hit:
                return self._fixed_reply(crisis.reply or "", ReplySource.CRISIS), False, None

        classified: Optional[List[ChatMessage]] = None
        llm_allowed = True
        if self.crisis_classifier is not None:
            # Context for split phrases, but never a turn that already got a crisis reply (same
            # reason as the join above), and never a crisis reply itself.
            answered = prev_idx is not None and any(
                m.role == ChatMessageRole.ASSISTANT and is_fixed_crisis_reply(m.content)
                for m in history[prev_idx + 1 : prev_idx + 2]
            )
            context_turn = history[prev_idx] if prev_idx is not None and not answered else None
            loti_said = next(
                (m.content for m in reversed(history) if m.role == ChatMessageRole.ASSISTANT), None
            )
            if loti_said is not None and is_fixed_crisis_reply(loti_said):
                loti_said = None
            classified = [context_turn] if context_turn is not None else []
            try:
                verdict = self.crisis_classifier.classify(
                    message,
                    previous=context_turn.content if context_turn is not None else None,
                    loti_said=loti_said,
                )
            except ClassifierError as exc:
                self.reply_source_counts["classifier_error"] += 1
                # ClassifierError messages are fixed strings, a GeminiError status or a type name:
                # no user text, and never the classifier's reason.
                logger.warning("coach crisis classifier failed (%s); failing closed, LLM not called", exc)
                verdict = None
                llm_allowed = False
            french = reads_french(message)
            if verdict is not None and verdict.risk is Risk.HIGH:
                self.reply_source_counts["classifier_high"] += 1
                reply = CRISIS_REPLY_FR if french else CRISIS_REPLY_EN
                return self._fixed_reply(reply, ReplySource.CRISIS), False, classified
            if verdict is not None and verdict.risk is Risk.LOW:
                reply = CRISIS_SIGNPOST_FR if french else CRISIS_SIGNPOST_EN
                return self._fixed_reply(reply, ReplySource.CRISIS_SIGNPOST), False, classified

        signpost = self.guardrail.health_signpost(message)
        if signpost.hit:
            return self._fixed_reply(signpost.reply or "", ReplySource.HEALTH_SIGNPOST), False, classified
        return None, llm_allowed, classified

    def _redact_crisis_turns(self, window: List[ChatMessage]) -> List[ChatMessage]:
        """Drop earlier USER turns that trip the crisis check, alone or joined with the next USER turn.

        The LLM never sees crisis text, and the chat goes on normally after a (possibly false) hit.
        Loti's own turns are kept: they are fixed, pre-checked text.

        Fixed crisis replies (backend or frontend copy) are dropped too, with the user turn they
        answered, so the LLM never sees an emergency line without its context (the BE-05 known gap).
        """
        user_idx = [i for i, m in enumerate(window) if m.role == ChatMessageRole.USER]
        alone = {i: self.guardrail.crisis_check(window[i].content).hit for i in user_idx}
        drop = {i for i in user_idx if alone[i]}
        # A fixed crisis reply, and the user turn it answered: that turn may be one only the backup
        # classifier caught, which crisis_check above cannot see.
        for k, m in enumerate(window):
            if m.role == ChatMessageRole.ASSISTANT and is_fixed_crisis_reply(m.content):
                drop.add(k)
                if k > 0 and window[k - 1].role == ChatMessageRole.USER:
                    drop.add(k - 1)
        # A split phrase: neither turn hits alone, the two together do. Drop both.
        for i, j in zip(user_idx, user_idx[1:]):
            if not alone[i] and not alone[j]:
                if self.guardrail.crisis_check(f"{window[i].content} {window[j].content}").hit:
                    drop.update((i, j))
        users = sum(1 for k in drop if window[k].role == ChatMessageRole.USER)
        if users:
            self.reply_source_counts["redacted_history_turn"] += users
            logger.info("coach redacted %d earlier user turn(s) from the LLM payload", users)
        if len(drop) > users:
            self.reply_source_counts["redacted_crisis_reply"] += len(drop) - users
        return [m for k, m in enumerate(window) if k not in drop]

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
        llm_allowed: bool = True,
    ) -> Tuple[str, SafetyMetadata, ReplySource]:
        """Call the LLM if one is configured. Any failure is logged, counted and answered offline."""
        offline_reply = self._generate_offline_coaching_response(
            message=message,
            cluster_id=cluster_id,
            collab_result=collab_result,
        )

        if not llm_allowed:  # the backup classifier failed: fail closed
            self.reply_source_counts[ReplySource.OFFLINE_AFTER_CLASSIFIER_ERROR.value] += 1
            return (
                offline_reply,
                self.guardrail.check_safety(offline_reply),
                ReplySource.OFFLINE_AFTER_CLASSIFIER_ERROR,
            )
        if self.llm_callable is None:
            return offline_reply, self.guardrail.check_safety(offline_reply), ReplySource.OFFLINE

        system_prompt = self.assemble_system_prompt(
            cluster_id=cluster_id,
            delta_vector=delta_vector,
        )
        messages_payload = [{"role": "system", "content": system_prompt}]
        for msg in history[-HISTORY_WINDOW:]:  # the redacted window from handle_chat
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
            # Rule categories only: the matched words may echo what the user wrote.
            logger.warning(
                "coach LLM reply withheld (banned-term rules: %s); sending the offline reply",
                ", ".join(sorted({v.rule_category for v in meta.violations})),
            )
            return safe_reply, meta, ReplySource.OFFLINE_AFTER_LINT

        # Shape and numbers (research 7.3). Allowed numbers are the ones in the turns the user saw;
        # the system prompt's rule numbers and the internal XAI block (cluster index, sigma) are not.
        allowed = numbers_in(" ".join(m.content for m in history))
        fitted = fit_bubbles(safe_reply)
        problem = None
        if fitted is None:
            problem = "bubbles"
        elif numbers_in(fitted) - allowed:
            problem = "numbers"
        if problem is not None:
            self.reply_source_counts[ReplySource.OFFLINE_AFTER_CHECK.value] += 1
            logger.warning("coach LLM reply withheld (%s check); sending the offline reply", problem)
            return offline_reply, self.guardrail.check_safety(offline_reply), ReplySource.OFFLINE_AFTER_CHECK
        return fitted, meta, ReplySource.LLM

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
            return OFFLINE_WHY_REPLY

        if any(w in lower_msg for w in ["score", "collab", "collaboration", "rating", "progress"]):
            return OFFLINE_SCORE_REPLY

        return OFFLINE_TIER_GUIDANCE[tier] + BUBBLE_SEPARATOR + OFFLINE_NEXT_QUESTION

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
