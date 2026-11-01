"""OpenRouter API support over OpenAI-compatible chat completions (plain httpx).

- `OPENROUTER_API_KEY` unset or blank: `OpenRouterRunner.from_env()` returns None.
- `OPENROUTER_MODEL` overrides the model id (default `google/gemini-2.5-flash`).
- `OPENROUTER_BASE_URL` overrides the endpoint (default `https://openrouter.ai/api/v1/chat/completions`).
- Time: each call waits at most min(3 s, time left before `deadline`). The wait is a hard one: the
  HTTP call runs on a worker thread, and when the wait ends the caller gets OpenRouterError
  ("deadline exceeded") at once while the late reply is dropped.
- Key safety: no key ever reaches a log line, an exception message or an exception chain.
  Errors carry the HTTP status or an exception type name, raised outside any `except` block.
  The key travels in the `Authorization: Bearer ...` header, never in the URL.
"""

from __future__ import annotations

try:
    import truststore
    truststore.inject_into_ssl()
except Exception:
    pass

import os
import threading
import time
from collections.abc import Mapping
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Any, Dict, List, Optional, Tuple

import httpx

from ai_coach.llm_gemini import GeminiBlocked, GeminiError

DEFAULT_MODEL = "google/gemini-2.5-flash"
TIMEOUT_S = 3.0
DEFAULT_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_SITE_URL = "https://synapsetwin.app"
DEFAULT_SITE_NAME = "SynapseTwin"
MAX_OUTPUT_TOKENS = 256

WORKERS = 8
MAX_PENDING = 16
_POOL = ThreadPoolExecutor(max_workers=WORKERS, thread_name_prefix="openrouter")
_SLOTS = threading.BoundedSemaphore(MAX_PENDING)


class OpenRouterError(GeminiError):
    """The OpenRouter call failed. Holds a safe message, never user text or the key."""


class OpenRouterBlocked(GeminiBlocked, OpenRouterError):
    """OpenRouter or upstream provider content filter blocked the prompt or reply."""


def clean_env_val(val: Optional[str]) -> str:
    """Strip whitespace and surrounding single or double quotes."""
    if not val:
        return ""
    s = val.strip()
    if len(s) >= 2 and ((s[0] == '"' and s[-1] == '"') or (s[0] == "'" and s[-1] == "'")):
        s = s[1:-1].strip()
    return s


def strip_markdown_fences(text: str) -> str:
    """Strip markdown code block fences (```json ... ``` or ``` ... ```) and surrounding whitespace."""
    s = text.strip()
    if s.startswith("```"):
        lines = s.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    return s


def config_from_env(environ: Optional[Mapping[str, str]] = None) -> Optional[Tuple[str, str]]:
    """(api key, model id) from OPENROUTER_API_KEY / OPENROUTER_MODEL, or None when no key is set."""
    env = os.environ if environ is None else environ
    key = clean_env_val(env.get("OPENROUTER_API_KEY"))
    if not key:
        return None
    model = clean_env_val(env.get("OPENROUTER_MODEL")) or DEFAULT_MODEL
    return key, model


class OpenRouterRunner:
    """Configured OpenRouter model runner matching the GeminiRunner protocol."""

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_MODEL,
        timeout_s: float = TIMEOUT_S,
        transport: Optional[httpx.BaseTransport] = None,
        api_url: str = DEFAULT_API_URL,
        site_url: str = DEFAULT_SITE_URL,
        site_name: str = DEFAULT_SITE_NAME,
    ):
        clean_key = clean_env_val(api_key)
        if not clean_key:
            raise ValueError("api_key is empty")
        self._api_key = clean_key
        self.model = clean_env_val(model) or DEFAULT_MODEL
        self.timeout_s = timeout_s
        self.api_url = clean_env_val(api_url) or DEFAULT_API_URL
        self.site_url = site_url
        self.site_name = site_name
        self._client = httpx.Client(timeout=httpx.Timeout(timeout_s), transport=transport)

    @classmethod
    def from_env(cls, environ: Optional[Mapping[str, str]] = None) -> Optional["OpenRouterRunner"]:
        config = config_from_env(environ)
        if config is None:
            return None
        env = os.environ if environ is None else environ
        api_url = clean_env_val(env.get("OPENROUTER_BASE_URL")) or DEFAULT_API_URL
        return cls(*config, api_url=api_url)

    def __repr__(self) -> str:
        return f"OpenRouterRunner(model={self.model!r}, timeout_s={self.timeout_s})"

    def matches(self, config: Tuple[str, str]) -> bool:
        return (self._api_key, self.model) == config

    def close(self) -> None:
        self._client.close()

    def __call__(self, messages: List[Dict[str, str]], deadline: Optional[float] = None) -> str:
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        turns = [m for m in messages if m["role"] != "system"]
        # Convert simple turns to contents format
        contents = [
            {"role": "assistant" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
            for m in turns
        ]
        return self.generate(system, contents, deadline=deadline)

    def generate(
        self,
        system: str,
        contents: List[Dict[str, Any]],
        *,
        json_schema: Optional[Dict[str, Any]] = None,
        relax_safety: bool = False,
        temperature: float = 0.4,
        deadline: Optional[float] = None,
        max_output_tokens: int = MAX_OUTPUT_TOKENS,
    ) -> str:
        """One chat/completions call; returns reply text. Raises OpenRouterError / OpenRouterBlocked."""
        now = time.monotonic()
        end = now + self.timeout_s if deadline is None else min(deadline, now + self.timeout_s)
        wait = end - now
        if wait <= 0:
            raise OpenRouterError("deadline exceeded")

        messages: List[Dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})

        for item in contents:
            role = "assistant" if item.get("role") in ("model", "assistant") else "user"
            text = ""
            if "parts" in item and isinstance(item["parts"], list):
                text = "".join(p.get("text", "") for p in item["parts"] if isinstance(p, dict))
            elif "content" in item:
                text = str(item["content"])
            messages.append({"role": role, "content": text})

        body: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_output_tokens,
        }
        if json_schema is not None:
            body["response_format"] = {"type": "json_object"}

        if not _SLOTS.acquire(blocking=False):
            raise OpenRouterError("busy")

        future = None
        try:
            future = _POOL.submit(self._post, body, end)
        except Exception:  # noqa: BLE001
            _SLOTS.release()
        if future is None:
            raise OpenRouterError("pool unavailable")
        future.add_done_callback(lambda _f: _SLOTS.release())

        failure: Optional[str] = None
        response: Optional[httpx.Response] = None
        try:
            response = future.result(timeout=wait)
        except FutureTimeout:
            future.cancel()
            failure = "deadline exceeded"
        except OpenRouterError as exc:
            failure = str(exc)
        except Exception as exc:  # noqa: BLE001
            failure = type(exc).__name__

        if failure is not None or response is None:
            raise OpenRouterError(failure or "no response")
        if deadline is not None and time.monotonic() > deadline:
            raise OpenRouterError("deadline exceeded")
        if response.status_code != 200:
            raise OpenRouterError(f"HTTP {response.status_code}")

        data: Any = None
        try:
            data = response.json()
        except ValueError:
            failure = "response is not JSON"
        if failure is not None:
            raise OpenRouterError(failure)

        text = reply_text(data)
        if json_schema is not None:
            text = strip_markdown_fences(text)
        return text

    def _post(self, body: Dict[str, Any], end: float) -> httpx.Response:
        left = end - time.monotonic()
        if left <= 0:
            raise OpenRouterError("deadline exceeded")
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": self.site_url,
            "X-Title": self.site_name,
        }
        return self._client.post(
            self.api_url,
            headers=headers,
            json=body,
            timeout=httpx.Timeout(left),
        )


def reply_text(data: Any) -> str:
    """Extract message content from OpenRouter chat completion response."""
    if not isinstance(data, dict):
        raise OpenRouterError("unexpected response shape")
    if "error" in data and isinstance(data["error"], dict):
        code = data["error"].get("code") or data["error"].get("message") or "error"
        raise OpenRouterError(f"provider error: {code}")

    choices = data.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        raise OpenRouterError("no candidates")

    choice = choices[0]
    finish = choice.get("finish_reason")
    if finish in ("content_filter", "safety"):
        raise OpenRouterBlocked("reply blocked")

    msg = choice.get("message") or {}
    text = (msg.get("content") or "").strip()
    if not text:
        raise OpenRouterError("empty reply")
    return text
