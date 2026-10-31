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
    # Nothing chained: no httpx request (key header, user text) travels with the error.
    assert exc.value.__cause__ is None and exc.value.__context__ is None
    assert SECRET not in str(exc.value) and KEY not in str(exc.value)


def test_the_deadline_is_a_hard_wait(monkeypatch):
    import time

    calls = []

    def slow(request):
        calls.append(request)
        time.sleep(0.5)
        return ok("late")

    runner = runner_with(slow)
    start = time.monotonic()
    with pytest.raises(GeminiError, match="deadline exceeded") as exc:
        runner([{"role": "user", "content": SECRET}], deadline=time.monotonic() + 0.1)
    assert time.monotonic() - start < 0.4
    assert exc.value.__context__ is None


def test_a_passed_deadline_sends_nothing():
    import time

    calls = []
    runner = runner_with(lambda r: calls.append(r) or ok("x"))
    with pytest.raises(GeminiError, match="deadline exceeded"):
        runner.generate("s", [], deadline=time.monotonic() - 1)
    assert calls == []


def _drain_pool():
    """Wait until every queued or running call is done, so later tests start with a free pool."""
    from ai_coach import llm_gemini

    taken = [llm_gemini._SLOTS.acquire(timeout=5) for _ in range(llm_gemini.MAX_PENDING)]
    assert all(taken)
    for _ in taken:
        llm_gemini._SLOTS.release()


def test_stale_queued_calls_are_never_sent():
    """The reviewer's pool_load scenario: 24 callers, a 0.2 s deadline, a 0.5 s transport."""
    import threading
    import time

    from ai_coach import llm_gemini

    _drain_pool()  # an earlier test's slow call may still hold a slot
    started, errors, lock = [], [], threading.Lock()

    def slow(request):
        with lock:
            started.append(time.monotonic())
        time.sleep(0.5)
        return ok("x")

    runner = runner_with(slow)

    def caller():
        try:
            runner([{"role": "user", "content": "hi"}], deadline=time.monotonic() + 0.2)
        except GeminiError as e:
            with lock:
                errors.append(str(e))

    t0 = time.monotonic()
    threads = [threading.Thread(target=caller) for _ in range(24)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert time.monotonic() - t0 < 0.5 and len(errors) == 24
    assert errors.count("busy") == 24 - llm_gemini.MAX_PENDING  # the queue is bounded
    _drain_pool()
    # Only the calls a worker picked up at once were ever sent; the queued ones were not.
    assert len(started) == llm_gemini.WORKERS


def test_each_call_waits_at_most_the_time_left():
    import time

    seen = {}

    def handler(request):
        seen["timeout"] = request.extensions["timeout"]
        return ok("x")

    runner_with(handler).generate("s", [], deadline=time.monotonic() + 1.0)
    assert 0 < seen["timeout"]["read"] <= 1.0


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
