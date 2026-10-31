"""Coach routes (BE-06), mounted by backend/app/main.py.

POST /v1/coach/chat
    Request (unknown fields anywhere: 422). Only what the user read and did ("only fed what the
    user read", coachAdapter.ts):
        {"user_id": "<anonymous id>",
         "transcript": [{"from": "loti" | "you", "text": "..."}],   # bubbles shown, choices picked
         "message": "...",                                           # the typed text or the choice's label
         "kind": "typed" | "choice"}
    Pipeline (R14): keyword crisis gate -> LLM backup crisis classifier -> health signpost ->
    AICoachAgent with GeminiRunner as llm_callable -> output lint (sanitize) -> chat store.
    With no GEMINI_API_KEY there is no classifier and no LLM: the reply is the scripted offline one.
    Response, shaped like the frontend's CrisisResult and LotiMessage:
        {"crisis": bool, "message": {"id", "text", "choices": [], "pose"?}, "reply_source": "..."}
    `crisis` is true for the crisis reply and the crisis signpost. Bubbles inside `message.text`
    are separated by a blank line.

GET /v1/coach/collaboration-score?user_id=...
    From the stored chat history and the user's telemetry. 200 {"status": "not_enough_data"}
    until there is enough of both; then {"status": "ok", "composite_score", ...}.

Logs carry reply sources and error types only, never user text, never the key.
"""

from __future__ import annotations

import json
import logging
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
from app.privacy.telemetry_store import ID_PATTERN, LockTimeout, telemetry_dir, telemetry_lock, user_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Coach"])

UserId = Annotated[str, Query(pattern=ID_PATTERN)]
BodyUserId = Annotated[str, StringConstraints(pattern=ID_PATTERN)]
# One bubble or one typed message. Loti's bubbles are short; this bounds what a client can send.
Text = Annotated[str, StringConstraints(min_length=1, max_length=1000)]
# lotiSession keeps at most 200 turns (MAX_TURNS); the LLM sees only the last few.
MAX_TRANSCRIPT_TURNS = 200

# Replies whose exchange is stored. Gated turns (crisis, signposts) and fail-closed turns are not.
STORED_SOURCES = {
    ReplySource.LLM,
    ReplySource.OFFLINE,
    ReplySource.OFFLINE_AFTER_LLM_ERROR,
    ReplySource.OFFLINE_AFTER_LINT,
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


def get_runner() -> Optional[GeminiRunner]:
    """The configured GeminiRunner, or None without GEMINI_API_KEY. Tests override this."""
    global _runner
    config = config_from_env()
    if config is None:
        return None
    if _runner is None or not _runner.matches(config):
        if _runner is not None:
            _runner.close()
        _runner = GeminiRunner(*config)
    return _runner


@router.post("/v1/coach/chat", response_model=CoachChatResponse, response_model_exclude_none=True)
def coach_chat(
    req: CoachChatRequest, runner: Optional[GeminiRunner] = Depends(get_runner)
) -> CoachChatResponse:
    key = user_key(req.user_id)
    history = [
        ChatMessage(
            role=ChatMessageRole.ASSISTANT if t.from_ == "loti" else ChatMessageRole.USER,
            content=t.text,
        )
        for t in req.transcript
    ]
    # R14: one key configures both, so the coach LLM never runs without the backup classifier.
    agent = AICoachAgent(
        llm_callable=runner,
        crisis_classifier=CrisisClassifier.from_runner(runner) if runner is not None else None,
    )
    resp = agent.handle_chat(ChatRequest(user_id=key, message=req.message, chat_history=history))
    source = resp.reply_source
    REPLY_SOURCE_COUNTS.update(agent.reply_source_counts)
    REPLY_SOURCE_COUNTS["turns"] += 1
    logger.info("coach chat turn answered (%s)", source.value)

    if source in STORED_SOURCES:
        try:
            chat_store.append_exchange(key, req.message, req.kind, resp.reply_text, source.value)
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


def telemetry_summary(key: str) -> Dict[str, Any]:
    """{"sessions", "trials", "avg_response_time_ms", "hesitation_jitter"} from the user's events.

    ponytail: a direct read of the telemetry JSONL; switch to BE-07's read_events (with dedupe)
    once it lands.
    """
    path = telemetry_dir() / f"{key}.jsonl"
    if not path.is_file():
        return {"sessions": 0, "trials": 0}
    with telemetry_lock(path.parent):
        try:
            text = path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return {"sessions": 0, "trials": 0}
    sessions, rts, jitters = set(), [], []
    for line in text.splitlines():
        try:
            row = json.loads(line)
            sessions.add(row["session_id"])
            rts.append(float(row["response_time_ms"]))
            jitters.append(float(row["hesitation_jitter"]))
        except (ValueError, KeyError, TypeError):
            continue
    if not rts:
        return {"sessions": 0, "trials": 0}
    return {
        "sessions": len(sessions),
        "trials": len(rts),
        "avg_response_time_ms": sum(rts) / len(rts),
        "hesitation_jitter": sum(jitters) / len(jitters),
    }


def _busy() -> HTTPException:
    return HTTPException(status_code=503, detail="store busy", headers={"Retry-After": "1"})


@router.get("/v1/coach/collaboration-score", responses={503: {}})
def collaboration_score(user_id: UserId) -> Dict[str, Any]:
    key = user_key(user_id)
    try:
        rows = chat_store.read_turns(key)
        summary = telemetry_summary(key)
    except LockTimeout:
        raise _busy()
    user_turns = [r["text"] for r in rows if r.get("from") == "you" and isinstance(r.get("text"), str)]
    return CollaborationScorer().score_stored_history(user_turns, summary)
