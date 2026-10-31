import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def isolated_stores_and_no_llm(monkeypatch, tmp_path_factory):
    """Every test: the coach store in a temp dir (never the repo's data/), and no Gemini key.

    app.main loads backend/.env at import, so a developer's real key could be in os.environ;
    tests that want a runner inject a fake one instead.
    """
    monkeypatch.setenv("COACH_DIR", str(tmp_path_factory.mktemp("coach")))
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_MODEL", raising=False)


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path))
    return TestClient(app)
