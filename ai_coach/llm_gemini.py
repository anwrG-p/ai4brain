"""Gemini 2.5 Flash over its REST API (plain httpx, pinned in ai_coach/requirements.txt).

- `GEMINI_API_KEY` unset or blank: `GeminiRunner.from_env()` returns None, and the coach stays on
  its scripted offline replies. Nothing here is required to run the app.
- `GEMINI_MODEL` overrides the model id (default `gemini-2.5-flash`).
- Every call has a 3 s timeout (httpx applies it to connect, write and read separately).
- No user text and no key ever reach a log line or an exception message: errors carry the HTTP
  status or the error type only, and are raised `from None` so no chained exception holds the
  request. The key travels in the `x-goog-api-key` header, never in the URL.

`GeminiRunner(messages)` is the agent's `llm_callable`: a list of {"role", "content"} dicts with
roles system / user / assistant, in order. `generate()` is the lower-level call the crisis
classifier uses for strict JSON.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any, Dict, List, Optional, Tuple

import httpx

DEFAULT_MODEL = "gemini-2.5-flash"
TIMEOUT_S = 3.0
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# Short replies only: Loti speaks in bubbles of at most 12 words.
MAX_OUTPUT_TOKENS = 256

_HARM_CATEGORIES = (
    "HARM_CATEGORY_HARASSMENT",
    "HARM_CATEGORY_HATE_SPEECH",
    "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    "HARM_CATEGORY_DANGEROUS_CONTENT",
)
_BLOCKED_FINISH = {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"}


class GeminiError(Exception):
    """The call failed. The message holds a status or a type name, never user text or the key."""


class GeminiBlocked(GeminiError):
    """Gemini's own safety filter blocked the prompt or the reply."""


def config_from_env(environ: Optional[Mapping[str, str]] = None) -> Optional[Tuple[str, str]]:
    """(api key, model id) from GEMINI_API_KEY / GEMINI_MODEL, or None when no key is set."""
    env = os.environ if environ is None else environ
    key = (env.get("GEMINI_API_KEY") or "").strip()
    if not key:
        return None
    return key, (env.get("GEMINI_MODEL") or "").strip() or DEFAULT_MODEL


class GeminiRunner:
    """One configured Gemini model. Build it with `from_env()`; None means not configured."""

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_MODEL,
        timeout_s: float = TIMEOUT_S,
        transport: Optional[httpx.BaseTransport] = None,
    ):
        if not api_key or not api_key.strip():
            raise ValueError("api_key is empty")
        self._api_key = api_key.strip()
        self.model = model
        self.timeout_s = timeout_s
        self._client = httpx.Client(timeout=httpx.Timeout(timeout_s), transport=transport)

    @classmethod
    def from_env(cls, environ: Optional[Mapping[str, str]] = None) -> Optional["GeminiRunner"]:
        config = config_from_env(environ)
        return None if config is None else cls(*config)

    def __repr__(self) -> str:  # never the key
        return f"GeminiRunner(model={self.model!r}, timeout_s={self.timeout_s})"

    def matches(self, config: Tuple[str, str]) -> bool:
        return (self._api_key, self.model) == config

    def close(self) -> None:
        self._client.close()

    # -- the agent's llm_callable ---------------------------------------------------------------

    def __call__(self, messages: List[Dict[str, str]]) -> str:
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        turns = [m for m in messages if m["role"] != "system"]
        return self.generate(system, to_contents(turns))

    # -- the call ---------------------------------------------------------------------------------

    def generate(
        self,
        system: str,
        contents: List[Dict[str, Any]],
        *,
        json_schema: Optional[Dict[str, Any]] = None,
        relax_safety: bool = False,
        temperature: float = 0.4,
    ) -> str:
        """One generateContent call; returns the reply text. Raises GeminiError / GeminiBlocked.

        `relax_safety` turns Gemini's own content filter off. Only the crisis classifier sets it:
        it must be able to read a message about self-harm to route it, and it only emits JSON.
        """
        config: Dict[str, Any] = {
            "temperature": temperature,
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            # No thinking: it costs seconds the 3 s budget does not have.
            "thinkingConfig": {"thinkingBudget": 0},
        }
        if json_schema is not None:
            config["responseMimeType"] = "application/json"
            config["responseSchema"] = json_schema
        body: Dict[str, Any] = {"contents": contents, "generationConfig": config}
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        if relax_safety:
            body["safetySettings"] = [
                {"category": c, "threshold": "BLOCK_NONE"} for c in _HARM_CATEGORIES
            ]
        try:
            r = self._client.post(
                API_URL.format(model=self.model),
                headers={"x-goog-api-key": self._api_key},
                json=body,
            )
        except httpx.HTTPError as exc:
            raise GeminiError(type(exc).__name__) from None
        if r.status_code != 200:
            raise GeminiError(f"HTTP {r.status_code}") from None
        try:
            data = r.json()
        except ValueError:
            raise GeminiError("response is not JSON") from None
        return reply_text(data)


def to_contents(turns: List[Dict[str, str]]) -> List[Dict[str, Any]]:
    """Agent turns to Gemini contents: assistant -> model, consecutive same-role turns merged."""
    contents: List[Dict[str, Any]] = []
    for m in turns:
        role = "model" if m["role"] == "assistant" else "user"
        if contents and contents[-1]["role"] == role:
            contents[-1]["parts"].append({"text": m["content"]})
        else:
            contents.append({"role": role, "parts": [{"text": m["content"]}]})
    return contents


def reply_text(data: Any) -> str:
    """The text of the first candidate. Raises GeminiBlocked on a safety block, else GeminiError."""
    if not isinstance(data, dict):
        raise GeminiError("unexpected response shape")
    if (data.get("promptFeedback") or {}).get("blockReason"):
        raise GeminiBlocked("prompt blocked")
    candidates = data.get("candidates") or []
    if not candidates or not isinstance(candidates[0], dict):
        raise GeminiError("no candidates")
    cand = candidates[0]
    parts = (cand.get("content") or {}).get("parts") or []
    text = "".join(
        p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought")
    ).strip()
    if not text:
        if cand.get("finishReason") in _BLOCKED_FINISH:
            raise GeminiBlocked("reply blocked")
        raise GeminiError("empty reply")
    return text
