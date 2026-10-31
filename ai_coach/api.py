"""Coach routes (BE-06), mounted by backend/app/main.py.

POST /v1/coach/chat
    Request (unknown fields anywhere: 422). Only what the user read and did ("only fed what the
    user read", coachAdapter.ts):
        {"user_id": "<anonymous id>",
         "transcript": [{"from": "loti" | "you", "text": "..."}],   # bubbles shown, choices picked
         "message": "...",                                           # the typed text or the choice's label
         "kind": "typed" | "choice"}
    Pipeline (R14): keyword crisis gate -> LLM backup crisis classifier -> health signpost ->
    AICoachAgent with GeminiRunner as llm_callable -> output checks (banned terms, at most 3
    bubbles of at most 12 words, no number the user has not seen) -> chat store.
    With no GEMINI_API_KEY there is no classifier and no LLM: the reply is the scripted offline one.
    Response, shaped like the frontend's CrisisResult and LotiMessage:
        {"crisis": bool, "message": {"id", "text", "choices": [], "pose"?}, "reply_source": "..."}
    `crisis` is true for the crisis reply and the crisis signpost.

    BUBBLES: `message.text` may hold up to 3 bubbles separated by a blank line ("\\n\\n"). Show each
    as its own bubble. In a later `transcript`, send Loti's text back either whole or one turn per
    bubble; both are recognised (crisis replies included, so they stay out of the LLM).

    TIME: Gemini gets one deadline for the whole turn, TURN_DEADLINE_S = 5 s, shared by the
    classifier and the coach call. Past it, the turn falls back to a scripted reply. The route
    answers within about TURN_DEADLINE_S + 1 s; set the client timeout above that (8 s is safe).
    An exchange answered later than TURN_DEADLINE_S + STORE_GRACE_S is not stored: the client
    may have given up on it, so the user may never have seen it.

GET /v1/coach/collaboration-score?user_id=...
    From the stored typed turns only (never clicked chips, never telemetry). 200
    {"status": "not_enough_data"} until there are 10 typed turns with marker evidence on at least
    3 dimensions; then {"status": "ok", "composite_score", "dimension_scores" (null where there
    is no evidence), "dimension_weights", "growth_recommendation", "evidence"}.

Logs carry reply sources and error types only, never user text, never the key.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import Counter
from typing import Annotated, Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from ai_coach import chat_store
from ai_coach.agent import AICoachAgent
from ai_coach.collaboration_scorer import CollaborationScorer
from ai_coach.crisis_classifier import CrisisClassifier
from ai_coach.llm_gemini import GeminiRunner, config_from_env
from ai_coach.schemas import ChatMessage, ChatMessageRole, ChatRequest, ReplySource
from app.privacy.telemetry_store import ID_PATTERN, LockTimeout, user_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Coach"])

UserId = Annotated[str, Query(pattern=ID_PATTERN)]
BodyUserId = Annotated[str, StringConstraints(pattern=ID_PATTERN)]
# One bubble or one typed message. Loti's bubbles are short; this bounds what a client can send.
Text = Annotated[str, StringConstraints(min_length=1, max_length=1000)]
# lotiSession keeps at most 200 turns (MAX_TURNS); the LLM sees only the last few.
MAX_TRANSCRIPT_TURNS = 200
# One Gemini deadline per chat turn (classifier + coach), and the slack before a reply counts as
# late for storing.
TURN_DEADLINE_S = 5.0
STORE_GRACE_S = 1.0

# Replies whose exchange is stored. Gated turns (crisis, signposts) and fail-closed turns are not.
STORED_SOURCES = {
    ReplySource.LLM,
    ReplySource.OFFLINE,
    ReplySource.OFFLINE_AFTER_LLM_ERROR,
    ReplySource.OFFLINE_AFTER_LINT,
    ReplySource.OFFLINE_AFTER_CHECK,
}
MESSAGE_IDS = {
    ReplySource.CRISIS: "crisis",  # the frontend's CRISIS_MESSAGE id
    ReplySource.CRISIS_SIGNPOST: "crisis-signpost",
    ReplySource.HEALTH_SIGNPOST: "health-signpost",
}

# Every reply source since the process started (research area 7, "Log fallbacks").
REPLY_SOURCE_COUNTS: Counter[str] = Counter()


class ShownTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    from_: Literal["loti", "you"] = Field(alias="from")
    text: Text


class CoachChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: BodyUserId
    transcript: Annotated[List[ShownTurn], Field(max_length=MAX_TRANSCRIPT_TURNS)] = []
    message: Text
    kind: Literal["typed", "choice"]


class LotiMessageOut(BaseModel):
    id: str
    text: str
    choices: List[Dict[str, Any]] = []
    pose: Optional[str] = None


class CoachChatResponse(BaseModel):
    crisis: bool
    message: LotiMessageOut
    reply_source: ReplySource


# -- the runner: built from the environment, reused while the key and model stay the same -------

_runner: Optional[GeminiRunner] = None
_runner_lock = threading.Lock()


def get_runner() -> Optional[GeminiRunner]:
    """The configured GeminiRunner, or None without GEMINI_API_KEY. Tests override this.

    Swapping (a new key or model) happens under a lock, so two requests never build or close the
    same runner at once. A request still using the old runner when it is closed gets an error,
    which fails closed like any other.
    """
    global _runner
    config = config_from_env()
    with _runner_lock:
        if config is None:
            return None
        if _runner is None or not _runner.matches(config):
            if _runner is not None:
                _runner.close()
            _runner = GeminiRunner(*config)
        return _runner


class TurnRunner:
    """A runner bound to one turn's deadline: the classifier and the coach call share it."""

    def __init__(self, runner: Any, deadline: float):
        self._runner, self._deadline = runner, deadline

    def __call__(self, messages: List[Dict[str, str]]) -> str:
        return self._runner(messages, deadline=self._deadline)

    def generate(self, *args: Any, **kwargs: Any) -> str:
        return self._runner.generate(*args, deadline=self._deadline, **kwargs)


@router.post("/v1/coach/chat", response_model=CoachChatResponse, response_model_exclude_none=True)
def coach_chat(
    req: CoachChatRequest, runner: Optional[GeminiRunner] = Depends(get_runner)
) -> CoachChatResponse:
    deadline = time.monotonic() + TURN_DEADLINE_S
    key = user_key(req.user_id)
    history = [
        ChatMessage(
            role=ChatMessageRole.ASSISTANT if t.from_ == "loti" else ChatMessageRole.USER,
            content=t.text,
        )
        for t in req.transcript
    ]
    turn = TurnRunner(runner, deadline) if runner is not None else None
    # R14: one key configures both, so the coach LLM never runs without the backup classifier.
    agent = AICoachAgent(
        llm_callable=turn,
        crisis_classifier=CrisisClassifier.from_runner(turn) if turn is not None else None,
    )
    resp = agent.handle_chat(ChatRequest(user_id=key, message=req.message, chat_history=history))
    source = resp.reply_source
    REPLY_SOURCE_COUNTS.update(agent.reply_source_counts)
    REPLY_SOURCE_COUNTS["turns"] += 1
    logger.info("coach chat turn answered (%s)", source.value)

    if source in STORED_SOURCES:
        room = deadline + STORE_GRACE_S - time.monotonic()
        if room <= 0:
            REPLY_SOURCE_COUNTS["late_not_stored"] += 1
            logger.warning("coach chat turn answered late; this exchange was not stored")
        else:
            try:
                chat_store.append_exchange(
                    key, req.message, req.kind, resp.reply_text, source.value, lock_timeout=room
                )
            except LockTimeout:
                # The reply is still sent: a busy store must not cost the user their answer.
                logger.warning("coach chat store busy; this exchange was not stored")

    crisis = source in (ReplySource.CRISIS, ReplySource.CRISIS_SIGNPOST)
    return CoachChatResponse(
        crisis=crisis,
        message=LotiMessageOut(
            id=MESSAGE_IDS.get(source, "coach"),
            text=resp.reply_text,
            pose="idle" if crisis else None,
        ),
        reply_source=source,
    )


# -- collaboration score ------------------------------------------------------------------------


@router.get("/v1/coach/collaboration-score", responses={503: {}})
def collaboration_score(user_id: UserId) -> Dict[str, Any]:
    key = user_key(user_id)
    try:
        rows = chat_store.read_turns(key)
    except LockTimeout:
        raise HTTPException(status_code=503, detail="store busy", headers={"Retry-After": "1"})
    typed = [
        r["text"]
        for r in rows
        if r.get("from") == "you" and r.get("kind") == "typed" and isinstance(r.get("text"), str)
    ]
    return CollaborationScorer().score_stored_history(typed)
