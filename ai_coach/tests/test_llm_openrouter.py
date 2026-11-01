"""OpenRouterRunner over a mocked transport: configuration, the request it sends, failures."""

import json
import pytest
import httpx

from ai_coach.llm_openrouter import (
    DEFAULT_MODEL,
    OpenRouterBlocked,
    OpenRouterError,
    OpenRouterRunner,
    config_from_env,
)

KEY = "sk-or-v1-testkey123456"


def fake_runner(handler, **kw):
    return OpenRouterRunner(KEY, transport=httpx.MockTransport(handler), **kw)


# -- configuration ----------------------------------------------------------------------------------


@pytest.mark.parametrize("env", [{}, {"OPENROUTER_API_KEY": ""}, {"OPENROUTER_API_KEY": "   "}])
def test_without_a_key_config_from_env_is_none(env):
    assert config_from_env(env) is None
    assert OpenRouterRunner.from_env(env) is None


def test_with_a_key_config_reads_the_default_model():
    assert config_from_env({"OPENROUTER_API_KEY": f" {KEY} "}) == (KEY, DEFAULT_MODEL)


def test_custom_model_from_env():
    r = OpenRouterRunner.from_env({"OPENROUTER_API_KEY": KEY, "OPENROUTER_MODEL": "anthropic/claude-3.5-sonnet"})
    assert r is not None
    assert r.model == "anthropic/claude-3.5-sonnet"


def test_empty_key_is_rejected():
    with pytest.raises(ValueError):
        OpenRouterRunner("")
    with pytest.raises(ValueError):
        OpenRouterRunner("   ")


def test_repr_hides_the_key():
    runner = OpenRouterRunner(KEY)
    assert KEY not in repr(runner)
    assert KEY not in str(runner)
    assert "OpenRouterRunner" in repr(runner)


# -- happy path & request formation ----------------------------------------------------------------


def test_happy_path_chat_completion():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        body = json.loads(request.content)
        assert body["model"] == DEFAULT_MODEL
        assert body["messages"] == [
            {"role": "system", "content": "You are Loti."},
            {"role": "user", "content": "Hello!"},
        ]
        return httpx.Response(
            200,
            json={
                "id": "gen-123",
                "choices": [
                    {
                        "message": {"role": "assistant", "content": "Hi there!"},
                        "finish_reason": "stop",
                    }
                ],
            },
        )

    runner = fake_runner(handler)
    reply = runner([{"role": "system", "content": "You are Loti."}, {"role": "user", "content": "Hello!"}])
    assert reply == "Hi there!"
    assert len(seen) == 1
    req = seen[0]
    assert req.headers["authorization"] == f"Bearer {KEY}"
    assert req.headers["content-type"] == "application/json"
    assert "synapsetwin" in req.headers["http-referer"].lower()


def test_json_schema_triggers_json_object_response_format():
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert body["response_format"] == {"type": "json_object"}
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"content": '{"reason": "ok", "risk": "none"}'}, "finish_reason": "stop"}
                ]
            },
        )

    runner = fake_runner(handler)
    out = runner.generate(
        "Classifier prompt",
        [{"role": "user", "parts": [{"text": "Hello"}]}],
        json_schema={"type": "object"},
    )
    assert out == '{"reason": "ok", "risk": "none"}'


# -- error handling --------------------------------------------------------------------------------


def test_content_filter_raises_openrouter_blocked():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": ""}, "finish_reason": "content_filter"}]},
        )

    runner = fake_runner(handler)
    with pytest.raises(OpenRouterBlocked):
        runner([{"role": "user", "content": "risky"}])


def test_http_error_raises_openrouter_error_without_leaking_key():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, text="Rate limit exceeded")

    runner = fake_runner(handler)
    with pytest.raises(OpenRouterError) as exc_info:
        runner([{"role": "user", "content": "hi"}])
    assert "HTTP 429" in str(exc_info.value)
    assert KEY not in str(exc_info.value)


def test_malformed_json_raises_openrouter_error():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="not-json")

    runner = fake_runner(handler)
    with pytest.raises(OpenRouterError, match="response is not JSON"):
        runner([{"role": "user", "content": "hi"}])


def test_empty_reply_raises_openrouter_error():
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": "   "}}]})

    runner = fake_runner(handler)
    with pytest.raises(OpenRouterError, match="empty reply"):
        runner([{"role": "user", "content": "hi"}])

