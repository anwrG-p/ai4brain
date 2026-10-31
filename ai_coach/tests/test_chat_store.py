import json
from datetime import datetime, timezone

import pytest

from ai_coach import chat_store


def test_append_writes_the_users_turn_and_lotis_reply(tmp_path):
    stamp = datetime(2026, 10, 31, 12, tzinfo=timezone.utc)
    assert chat_store.append_exchange("U1", "hello", "typed", "Hi.", "offline", tmp_path, stamp) == 2
    rows = [json.loads(line) for line in (tmp_path / "u1.jsonl").read_text(encoding="utf-8").splitlines()]
    assert rows == [
        {"record": "coach_turn", "user_id": "u1", "received_at": stamp.isoformat(),
         "from": "you", "kind": "typed", "text": "hello"},
        {"record": "coach_turn", "user_id": "u1", "received_at": stamp.isoformat(),
         "from": "loti", "reply_source": "offline", "text": "Hi."},
    ]


def test_read_turns_is_case_insensitive_and_skips_bad_lines(tmp_path):
    chat_store.append_exchange("u1", "a", "choice", "b", "llm", tmp_path)
    with open(tmp_path / "u1.jsonl", "a", encoding="utf-8") as f:
        f.write("not json\n{\"record\": \"other\"}\n")
    assert [r["text"] for r in chat_store.read_turns("U1", tmp_path)] == ["a", "b"]
    assert chat_store.read_turns("nobody", tmp_path) == []


def test_default_location_is_coach_dir(monkeypatch, tmp_path):
    monkeypatch.setenv("COACH_DIR", str(tmp_path))
    chat_store.append_exchange("u1", "a", "typed", "b", "offline")
    assert (tmp_path / "u1.jsonl").exists()


@pytest.mark.parametrize("bad", ["../x", "a.b", ""])
def test_bad_ids_write_nothing(tmp_path, bad):
    with pytest.raises(ValueError):
        chat_store.append_exchange(bad, "a", "typed", "b", "offline", tmp_path)
    assert list(tmp_path.iterdir()) == []
