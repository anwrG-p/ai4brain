"""Gemini 2.5 Flash over its REST API (plain httpx, pinned in ai_coach/requirements.txt).

- `GEMINI_API_KEY` unset or blank: `GeminiRunner.from_env()` returns None, and the coach stays on
  its scripted offline replies. Nothing here is required to run the app.
- `GEMINI_MODEL` overrides the model id (default `gemini-2.5-flash`).
- Time: each call waits at most min(3 s, time left before `deadline`). The wait is a hard one: the
  HTTP call runs on a worker thread, and when the wait ends the caller gets GeminiError
  ("deadline exceeded") at once while the late reply is dropped. The chat route passes one
  deadline for the whole turn (classifier + coach), see ai_coach/api.py TURN_DEADLINE_S.
  Stale work: a call not yet started when its caller gives up is cancelled; a queued call whose
  deadline passed is never sent; with MAX_PENDING calls in flight a new one fails closed ("busy").
  A call already on the wire runs out its httpx timeouts (each phase capped at the budget left
  when it started; httpx has no overall timeout) and its result is dropped.
- No user text and no key ever reach a log line, an exception message or an exception chain:
  errors carry the HTTP status or an exception type name, and are raised outside any `except`
  block, so no httpx exception (whose request holds the key header) is ever attached. The key
  travels in the `x-goog-api-key` header, never in the URL.

`GeminiRunner(messages)` is the agent's `llm_callable`: a list of {"role", "content"} dicts with
roles system / user / assistant, in order. `generate()` is the lower-level call the crisis
classifier uses for strict JSON.
"""

from __future__ import annotations

import os
import threading
import time
from collections.abc import Mapping
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
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
# Calls run here so a wait can end on time. The queue is bounded: with MAX_PENDING calls already
# running or queued, a new one fails closed at once ("busy"). A call whose caller gave up is
# cancelled if it has not started, and a queued call whose deadline passed is never sent.
WORKERS = 8
MAX_PENDING = 16
_POOL = ThreadPoolExecutor(max_workers=WORKERS, thread_name_prefix="gemini")
_SLOTS = threading.BoundedSemaphore(MAX_PENDING)


class GeminiError(Exception):
    """The call failed. The message holds a status or a type name, never user text or the key."""


class GeminiBlocked(GeminiError):
    """Gemini's own safety filter blocked the prompt or the reply."""


def clean_env_val(val: Optional[str]) -> str:
    """Strip whitespace and surrounding single or double quotes."""
    if not val:
        return ""
    s = val.strip()
    if len(s) >= 2 and ((s[0] == '"' and s[-1] == '"') or (s[0] == "'" and s[-1] == "'")):
        s = s[1:-1].strip()
    return s


def config_from_env(environ: Optional[Mapping[str, str]] = None) -> Optional[Tuple[str, str]]:
    """(api key, model id) from GEMINI_API_KEY / GEMINI_MODEL, or None when no key is set."""
    env = os.environ if environ is None else environ
    key = clean_env_val(env.get("GEMINI_API_KEY"))
    if not key:
        return None
    return key, clean_env_val(env.get("GEMINI_MODEL")) or DEFAULT_MODEL


class GeminiRunner:
    """One configured Gemini model. Build it with `from_env()`; None means not configured."""

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_MODEL,
        timeout_s: float = TIMEOUT_S,
        transport: Optional[httpx.BaseTransport] = None,
    ):
        clean_key = clean_env_val(api_key)
        if not clean_key:
            raise ValueError("api_key is empty")
        self._api_key = clean_key
        self.model = clean_env_val(model) or DEFAULT_MODEL
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

    def __call__(self, messages: List[Dict[str, str]], deadline: Optional[float] = None) -> str:
        system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
        turns = [m for m in messages if m["role"] != "system"]
        return self.generate(system, to_contents(turns), deadline=deadline)

    # -- the call ---------------------------------------------------------------------------------

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
        """One generateContent call; returns the reply text. Raises GeminiError / GeminiBlocked.

        `deadline` is a time.monotonic() value; the call never waits past it.
        `max_output_tokens` defaults to Loti's short replies; the task-pool worker (BE-13) asks for
        whole task blocks and passes more.
        `relax_safety` turns Gemini's own content filter off. Only the crisis classifier sets it:
        it must be able to read a message about self-harm to route it, and it only emits JSON.
        """
        now = time.monotonic()
        # One wall-clock end for this call: the turn's deadline, at most timeout_s from now.
        end = now + self.timeout_s if deadline is None else min(deadline, now + self.timeout_s)
        wait = end - now
        if wait <= 0:
            raise GeminiError("deadline exceeded")
        config: Dict[str, Any] = {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
            # No thinking: it costs seconds the turn deadline does not have.
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

        if not _SLOTS.acquire(blocking=False):
            raise GeminiError("busy")  # the queue is full: fail closed now, never wait in line
        future = None
        try:
            future = _POOL.submit(self._post, body, end)
        except Exception:  # noqa: BLE001 - e.g. the pool is shut down
            _SLOTS.release()  # give the slot back, or the queue shrinks for good
        if future is None:  # raised outside the except: nothing chained
            raise GeminiError("pool unavailable")
        future.add_done_callback(lambda _f: _SLOTS.release())
        failure: Optional[str] = None
        response: Optional[httpx.Response] = None
        try:
            response = future.result(timeout=wait)
        except FutureTimeout:
            future.cancel()  # not started yet: it never runs
            failure = "deadline exceeded"
        except GeminiError as exc:  # raised by _post itself: a safe message
            failure = str(exc)
        except Exception as exc:  # noqa: BLE001 - httpx errors, a closed client: the type name only
            failure = type(exc).__name__
        # Raised here, outside the except blocks: nothing is chained, so no httpx request (with
        # its key header) or user text travels with the error.
        if failure is not None or response is None:
            raise GeminiError(failure or "no response")
        if deadline is not None and time.monotonic() > deadline:
            raise GeminiError("deadline exceeded")
        if response.status_code != 200:
            raise GeminiError(f"HTTP {response.status_code}")
        data: Any = None
        try:
            data = response.json()
        except ValueError:
            failure = "response is not JSON"
        if failure is not None:
            raise GeminiError(failure)
        return reply_text(data)

    def _post(self, body: Dict[str, Any], end: float) -> httpx.Response:
        """Runs on a worker. A call that waited in the queue past its end is never sent."""
        left = end - time.monotonic()
        if left <= 0:
            raise GeminiError("deadline exceeded")
        # httpx has no overall timeout, only per-phase ones; each phase gets what is left of the
        # wall-clock budget when the request starts. The caller's wait above is the hard bound.
        return self._client.post(
            API_URL.format(model=self.model),
            headers={"x-goog-api-key": self._api_key},
            json=body,
            timeout=httpx.Timeout(left),
        )


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
