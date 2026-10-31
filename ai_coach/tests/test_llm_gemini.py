"""GeminiRunner over a mocked transport: configuration, the request it sends, failures."""

import json

import httpx
import pytest

from ai_coach.llm_gemini import (
    DEFAULT_MODEL,
    TIMEOUT_S,
    GeminiBlocked,
    GeminiError,
    GeminiRunner,
    config_from_env,
    to_contents,
)

KEY = "test-key-NOT-REAL-7f3a"
SECRET = "my private sentence 91c2"


def ok(text):
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})


def runner_with(handler, **kw):
    return GeminiRunner(KEY, transport=httpx.MockTransport(handler), **kw)


@pytest.mark.parametrize("env", [{}, {"GEMINI_API_KEY": ""}, {"GEMINI_API_KEY": "   "}])
def test_no_key_means_not_configured(env):
    assert config_from_env(env) is None
    assert GeminiRunner.from_env(env) is None


def test_key_and_model_from_env():
    assert config_from_env({"GEMINI_API_KEY": f" {KEY} "}) == (KEY, DEFAULT_MODEL)
    assert DEFAULT_MODEL == "gemini-2.5-flash"
    r = GeminiRunner.from_env({"GEMINI_API_KEY": KEY, "GEMINI_MODEL": "gemini-x"})
    assert r.model == "gemini-x"


def test_timeout_is_three_seconds():
    assert TIMEOUT_S == 3.0
    assert GeminiRunner(KEY).timeout_s == 3.0


def test_repr_never_shows_the_key():
    assert KEY not in repr(GeminiRunner(KEY))
    assert KEY not in str(GeminiRunner(KEY))


def test_request_shape_key_in_header_not_url():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["key"] = request.headers.get("x-goog-api-key")
        seen["body"] = json.loads(request.content)
        return ok("Nice rhythm today.")

    runner = runner_with(handler)
    reply = runner(
        [
            {"role": "system", "content": "be Loti"},
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "Hello."},
            {"role": "user", "content": "one"},
            {"role": "user", "content": "two"},
        ]
    )
    assert reply == "Nice rhythm today."
    assert seen["key"] == KEY and KEY not in seen["url"]
    assert seen["url"].endswith(f"/models/{DEFAULT_MODEL}:generateContent")
    body = seen["body"]
    assert body["systemInstruction"] == {"parts": [{"text": "be Loti"}]}
    assert [c["role"] for c in body["contents"]] == ["user", "model", "user"]
    assert body["contents"][-1]["parts"] == [{"text": "one"}, {"text": "two"}]
    assert body["generationConfig"]["thinkingConfig"] == {"thinkingBudget": 0}
    assert "safetySettings" not in body  # the coach keeps Gemini's default filter


def test_json_mode_and_relaxed_safety_for_the_classifier():
    seen = {}

    def handler(request):
        seen["body"] = json.loads(request.content)
        return ok('{"risk": "none", "reason": "x"}')

    runner_with(handler).generate("sys", [], json_schema={"type": "OBJECT"}, relax_safety=True)
    cfg = seen["body"]["generationConfig"]
    assert cfg["responseMimeType"] == "application/json"
    assert cfg["responseSchema"] == {"type": "OBJECT"}
    assert {s["threshold"] for s in seen["body"]["safetySettings"]} == {"BLOCK_NONE"}


def _raise_timeout(request):
    raise httpx.ReadTimeout(f"timed out reading {SECRET}", request=request)


@pytest.mark.parametrize(
    "handler,message",
    [
        (_raise_timeout, "ReadTimeout"),
        (lambda r: httpx.Response(500, text=f"echo {SECRET}"), "HTTP 500"),
        (lambda r: httpx.Response(200, text="not json"), "response is not JSON"),
        (lambda r: httpx.Response(200, json={"candidates": []}), "no candidates"),
        (lambda r: ok("   "), "empty reply"),
    ],
)
def test_failures_raise_gemini_error_without_user_text_or_key(handler, message):
    with pytest.raises(GeminiError) as exc:
        runner_with(handler)([{"role": "user", "content": SECRET}])
    assert str(exc.value) == message
    # No chained exception carries the request (and so the user's text) along.
    assert exc.value.__cause__ is None
    assert exc.value.__context__ is None or exc.value.__suppress_context__
    assert SECRET not in str(exc.value) and KEY not in str(exc.value)


@pytest.mark.parametrize(
    "payload",
    [
        {"promptFeedback": {"blockReason": "SAFETY"}},
        {"candidates": [{"finishReason": "SAFETY", "content": {"parts": []}}]},
    ],
)
def test_safety_block_is_its_own_error(payload):
    with pytest.raises(GeminiBlocked):
        runner_with(lambda r: httpx.Response(200, json=payload))([{"role": "user", "content": "x"}])


def test_thought_parts_are_skipped():
    data = {"candidates": [{"content": {"parts": [{"text": "plan", "thought": True}, {"text": "Hi."}]}}]}
    assert runner_with(lambda r: httpx.Response(200, json=data))([{"role": "user", "content": "x"}]) == "Hi."


def test_to_contents_maps_roles():
    assert to_contents([{"role": "assistant", "content": "a"}]) == [{"role": "model", "parts": [{"text": "a"}]}]
