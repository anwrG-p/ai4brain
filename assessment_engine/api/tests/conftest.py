import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path))
    return TestClient(app)
