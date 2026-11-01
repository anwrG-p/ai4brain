"""Tests for OpenRouter provider integration in coach API and llm_config."""

import json
import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
import ai_coach.api as coach_api
from ai_coach.llm_config import active_llm_config
from ai_coach.llm_openrouter import OpenRouterRunner

OPENROUTER_KEY = "sk-or-v1-secret123456"
GEMINI_KEY = "AIzaSyTest123"


def test_active_llm_config_selection():
    # 1. No keys
    assert active_llm_config({}) is None

    # 2. Only Gemini
    res = active_llm_config({"GEMINI_API_KEY": GEMINI_KEY})
    assert res == ("gemini", GEMINI_KEY, "gemini-2.5-flash")

    # 3. Only OpenRouter
    res = active_llm_config({"OPENROUTER_API_KEY": OPENROUTER_KEY})
    assert res == ("openrouter", OPENROUTER_KEY, "google/gemini-2.5-flash")

    # 4. Custom OpenRouter model
    res = active_llm_config({
        "OPENROUTER_API_KEY": OPENROUTER_KEY,
        "OPENROUTER_MODEL": "meta-llama/llama-3.3-70b-instruct",
    })
    assert res == ("openrouter", OPENROUTER_KEY, "meta-llama/llama-3.3-70b-instruct")

    # 5. Both keys, explicit LLM_PROVIDER=openrouter
    res = active_llm_config({
        "GEMINI_API_KEY": GEMINI_KEY,
        "OPENROUTER_API_KEY": OPENROUTER_KEY,
        "LLM_PROVIDER": "openrouter",
    })
    assert res[0] == "openrouter"

    # 6. Both keys, explicit LLM_PROVIDER=gemini
    res = active_llm_config({
        "GEMINI_API_KEY": GEMINI_KEY,
        "OPENROUTER_API_KEY": OPENROUTER_KEY,
        "LLM_PROVIDER": "gemini",
    })
    assert res[0] == "gemini"


def test_coach_chat_with_openrouter_runner(monkeypatch):
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        body = json.loads(request.content)
        # Check if classifier or coach call
        if body.get("response_format") == {"type": "json_object"}:
            content = json.dumps({"risk": "none", "reason": "about practice"})
        else:
            content = "Keep focusing on accuracy.\n\nTake your time on tricky trials."
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {"role": "assistant", "content": content},
                        "finish_reason": "stop",
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    monkeypatch.setenv("OPENROUTER_API_KEY", OPENROUTER_KEY)
    monkeypatch.setattr(
        coach_api,
        "OpenRouterRunner",
        lambda key, model: OpenRouterRunner(key, model, transport=transport),
    )
    monkeypatch.setattr(coach_api, "_runner", None)

    client = TestClient(app)
    res = client.post(
        "/v1/coach/chat",
        json={
            "user_id": "test_user_or",
            "message": "How can I improve my memory strategy?",
            "kind": "typed",
            "transcript": [],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["reply_source"] == "llm"
    assert "Keep focusing on accuracy." in data["message"]["text"]
    assert len(seen) == 2  # classifier call + coach call

    # Verify authorization header
    for req in seen:
        assert req.headers["authorization"] == f"Bearer {OPENROUTER_KEY}"
        assert OPENROUTER_KEY not in str(req.url)

    # Clean up runner
    monkeypatch.setattr(coach_api, "_runner", None)

