import pytest


@pytest.fixture(autouse=True)
def isolated_coach_store_and_no_key(monkeypatch, tmp_path_factory):
    """The chat store never touches the repo's data/, and no real LLM key is ever used."""
    monkeypatch.setenv("COACH_DIR", str(tmp_path_factory.mktemp("coach")))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
