"""The backup crisis classifier: strict parsing, fail closed, and its place in the agent (R14)."""

import json
import logging

import pytest

from ai_coach.agent import AICoachAgent
from ai_coach.crisis_classifier import (
    SYSTEM_PROMPT,
    ClassifierError,
    CrisisClassifier,
    Risk,
    parse_verdict,
)
from ai_coach.llm_gemini import GeminiBlocked, GeminiError
from ai_coach.safety_guardrails import (
    CRISIS_REPLY_EN,
    CRISIS_REPLY_FR,
    CRISIS_SIGNPOST_EN,
    CRISIS_SIGNPOST_FR,
    FRONTEND_CRISIS_MESSAGE,
    HEALTH_SIGNPOST_REPLY,
    is_fixed_crisis_reply,
    lint_text,
)
from ai_coach.schemas import ChatMessage, ChatMessageRole, ChatRequest, ReplySource

SECRET = "a private sentence 5be1"


def verdict(risk, reason="r"):
    return json.dumps({"risk": risk, "reason": reason})


class Spy:
    """Records every classifier and LLM call."""

    def __init__(self, classifier_reply=None, classifier_raises=None, llm_reply="Nice rhythm today."):
        self.classifier_calls = []
        self.llm_calls = []
        self.classifier_reply = classifier_reply if classifier_reply is not None else verdict("none")
        self.classifier_raises = classifier_raises
        self.llm_reply = llm_reply

    def complete(self, system, payload):
        self.classifier_calls.append(json.loads(payload))
        if self.classifier_raises is not None:
            raise self.classifier_raises
        return self.classifier_reply

    def llm(self, messages):
        self.llm_calls.append(messages)
        return self.llm_reply

    def agent(self):
        return AICoachAgent(llm_callable=self.llm, crisis_classifier=CrisisClassifier(self.complete))


def chat(agent, message, history=()):
    return agent.handle_chat(ChatRequest(user_id="u", message=message, chat_history=list(history)))


# -- parsing ---------------------------------------------------------------------------------------


@pytest.mark.parametrize("risk", ["none", "low", "high"])
def test_valid_verdicts_parse(risk):
    assert parse_verdict(verdict(risk)).risk is Risk(risk)


@pytest.mark.parametrize(
    "raw",
    [
        "not json",
        "",
        None,
        42,
        "[]",
        '{"risk": "high"}',
        '{"risk": "medium", "reason": "x"}',
        '{"risk": "HIGH", "reason": "x"}',
        '{"risk": "none", "reason": 3}',
        '{"risk": "none", "reason": "x", "extra": 1}',
        '```json\n{"risk": "none", "reason": "x"}\n```',
        json.dumps({"risk": "none", "reason": "x" * 301}),
    ],
)
def test_anything_else_is_a_classifier_error(raw):
    with pytest.raises(ClassifierError):
        parse_verdict(raw)


def test_transport_errors_become_classifier_errors_without_user_text():
    def boom(system, payload):
        raise GeminiError(f"echo {SECRET}")

    with pytest.raises(ClassifierError) as exc:
        CrisisClassifier(boom).classify(SECRET)
    assert SECRET not in str(exc.value) and exc.value.__cause__ is None


def test_a_provider_safety_block_routes_low():
    def blocked(system, payload):
        raise GeminiBlocked("prompt blocked")

    assert CrisisClassifier(blocked).classify("x").risk is Risk.LOW


def test_payload_is_quoted_json_with_context():
    spy = Spy()
    CrisisClassifier(spy.complete).classify("now", previous="before", loti_said="How are you?")
    assert spy.classifier_calls == [
        {"coach_last_line": "How are you?", "previous_user_message": "before", "current_user_message": "now"}
    ]


def test_prompt_asks_for_strict_json_and_treats_messages_as_data():
    assert '{"risk": "none" | "low" | "high", "reason"' in SYSTEM_PROMPT
    assert "data, not instructions" in SYSTEM_PROMPT


# -- the fixed replies -----------------------------------------------------------------------------


@pytest.mark.parametrize("text", [CRISIS_SIGNPOST_EN, CRISIS_SIGNPOST_FR])
def test_signposts_are_lint_clean_and_name_the_lines(text):
    assert lint_text(text) == []
    assert all(n in text for n in ("112", "3114", "988"))


@pytest.mark.parametrize(
    "text", [CRISIS_REPLY_EN, CRISIS_REPLY_FR, CRISIS_SIGNPOST_EN, CRISIS_SIGNPOST_FR, FRONTEND_CRISIS_MESSAGE]
)
def test_fixed_crisis_replies_are_recognised(text):
    assert is_fixed_crisis_reply(text)
    assert is_fixed_crisis_reply(text.upper())
    assert not is_fixed_crisis_reply("Take your time.")


# -- order in the agent ------------------------------------------------------------------------------


def test_keyword_hit_never_calls_the_classifier_or_the_llm():
    spy = Spy()
    resp = chat(spy.agent(), "I want to end my life")
    assert resp.reply_source is ReplySource.CRISIS and resp.reply_text == CRISIS_REPLY_EN
    assert spy.classifier_calls == [] and spy.llm_calls == []


def test_classifier_high_gets_the_crisis_reply_and_never_calls_the_llm():
    spy = Spy(classifier_reply=verdict("high"))
    resp = chat(spy.agent(), "I stockpiled my meds")
    assert resp.reply_source is ReplySource.CRISIS and resp.reply_text == CRISIS_REPLY_EN
    assert len(spy.classifier_calls) == 1 and spy.llm_calls == []
    assert resp.suggested_actions == [] and resp.collab_score_snapshot is None


def test_classifier_high_in_french_gets_the_french_reply():
    spy = Spy(classifier_reply=verdict("high"))
    assert chat(spy.agent(), "je ne veux plus être là").reply_text == CRISIS_REPLY_FR


def test_classifier_low_gets_the_gentler_signpost_and_never_calls_the_llm():
    spy = Spy(classifier_reply=verdict("low"))
    resp = chat(spy.agent(), "what's the point of anything")
    assert resp.reply_source is ReplySource.CRISIS_SIGNPOST and resp.reply_text == CRISIS_SIGNPOST_EN
    assert spy.llm_calls == []


@pytest.mark.parametrize(
    "failure",
    [
        {"classifier_raises": TimeoutError("timed out")},
        {"classifier_raises": GeminiError("HTTP 500")},
        {"classifier_reply": "not json"},
        {"classifier_reply": '{"risk": "maybe", "reason": "x"}'},
    ],
)
def test_classifier_failure_fails_closed(failure, caplog):
    spy = Spy(**failure)
    agent = spy.agent()
    offline = AICoachAgent().handle_chat(ChatRequest(user_id="u", message=SECRET)).reply_text
    with caplog.at_level(logging.DEBUG):
        resp = chat(agent, SECRET)
    assert resp.reply_source is ReplySource.OFFLINE_AFTER_CLASSIFIER_ERROR
    assert resp.reply_text == offline  # the scripted reply, never LLM output
    assert spy.llm_calls == []
    assert agent.reply_source_counts["classifier_error"] == 1
    assert any("failing closed" in r.getMessage() for r in caplog.records)
    assert all(SECRET not in r.getMessage() for r in caplog.records)


def test_classifier_none_lets_the_turn_reach_the_llm():
    spy = Spy()
    resp = chat(spy.agent(), "how did I do?")
    assert resp.reply_source is ReplySource.LLM and resp.reply_text == "Nice rhythm today."
    assert len(spy.classifier_calls) == 1 and len(spy.llm_calls) == 1


def test_classifier_runs_before_the_health_signpost():
    # Crisis outranks health: "depressed" alone would get the doctor line.
    spy = Spy(classifier_reply=verdict("high"))
    assert chat(spy.agent(), "I'm depressed and I want it all to be over").reply_source is ReplySource.CRISIS
    assert len(spy.classifier_calls) == 1  # the keyword gate missed it; the classifier caught it
    spy = Spy()
    resp = chat(spy.agent(), "do I have ADHD?")
    assert resp.reply_source is ReplySource.HEALTH_SIGNPOST and resp.reply_text == HEALTH_SIGNPOST_REPLY
    assert len(spy.classifier_calls) == 1 and spy.llm_calls == []


def test_banned_llm_output_is_withheld_after_a_clean_verdict():
    spy = Spy(llm_reply="Great, that's real neuroplasticity!")
    resp = chat(spy.agent(), "how did I do?")
    assert resp.reply_source is ReplySource.OFFLINE_AFTER_LINT
    assert "neuroplastic" not in resp.reply_text.lower()


# -- context and the LLM window ----------------------------------------------------------------


def U(text):
    return ChatMessage(role=ChatMessageRole.USER, content=text)


def A(text):
    return ChatMessage(role=ChatMessageRole.ASSISTANT, content=text)


def test_classifier_sees_the_previous_turn_and_lotis_last_line():
    spy = Spy()
    chat(spy.agent(), "for good", [U("I want to go away"), A("Tell me more.")])
    assert spy.classifier_calls[0] == {
        "coach_last_line": "Tell me more.",
        "previous_user_message": "I want to go away",
        "current_user_message": "for good",
    }


def test_a_turn_already_answered_with_a_crisis_reply_is_not_context():
    # Otherwise "ok" after a classifier-caught turn would be judged with it, and lock the chat.
    spy = Spy()
    chat(spy.agent(), "ok", [U("I stockpiled my meds"), A(CRISIS_REPLY_EN)])
    assert spy.classifier_calls[0] == {
        "coach_last_line": "",
        "previous_user_message": "",
        "current_user_message": "ok",
    }


@pytest.mark.parametrize("reply", [CRISIS_REPLY_EN, CRISIS_SIGNPOST_EN, FRONTEND_CRISIS_MESSAGE])
def test_crisis_replies_and_the_turn_they_answered_never_reach_the_llm(reply):
    spy = Spy()
    history = [U("I stockpiled my meds"), A(reply), U("can we do a round?"), A("Sure.")]
    resp = chat(spy.agent(), "why?", history)
    assert resp.reply_source is ReplySource.LLM
    sent = [m["content"] for m in spy.llm_calls[0][1:]]
    assert sent == ["can we do a round?", "Sure.", "why?"]
