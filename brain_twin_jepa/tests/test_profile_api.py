"""BE-11 over HTTP: GET /v1/dashboard/profile, POST /v1/clustering/evaluate, and the state bus wired
into GET /v1/tasks/next (Member 5) and POST /v1/coach/chat (Member 2).

Users are BE-08 synthetic users appended to the telemetry store as the ingest route writes them;
every session but the newest is closed, so it is a clustering frame.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.privacy import telemetry_store
from brain_twin_jepa import bootstrap, profile, state_bus, telemetry_io
from brain_twin_jepa.features import session_features
from data.synthetic.generate import simulate_user

PROFILE = "/v1/dashboard/profile"
EVALUATE = "/v1/clustering/evaluate"
REGION_NAMES = ["dlPFC", "ACC", "vlPFC", "Striatum", "Hippocampus", "Parieto", "cortical", "cortex", "cortex"]


@pytest.fixture(scope="module")
def gmm_file(tmp_path_factory):
    """A clustering model fitted the way the bootstrap fits the served one (BE-07 features of
    BE-08 users), small enough for the suite."""
    path = tmp_path_factory.mktemp("models") / "gmm.json"
    bootstrap.save_cluster_model(bootstrap.fit_cluster_model(users=60, sessions=3, data_seed=0), path)
    return path


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("TELEMETRY_DIR", str(tmp_path / "telemetry"))
    return TestClient(app)


@pytest.fixture
def with_model(monkeypatch, gmm_file):
    monkeypatch.setenv("CLUSTER_MODEL_PATH", str(gmm_file))
    return gmm_file


@pytest.fixture
def with_twin(monkeypatch, tmp_path):
    torch = pytest.importorskip("torch")
    from brain_twin_jepa.jepa_model import SATJEPA, BrainTwin, Calibration

    torch.manual_seed(0)
    cal = Calibration(level=0.8, a=[100.0] * 5, b=[10.0] * 5, z=[1.28] * 5, source="test fixture", n_min=3, n_max_by_h=[8, 7, 6, 5, 4, 3])
    twin = BrainTwin(SATJEPA(latent=8, hidden=16), cal, {"validation": {"validated": False}})
    path = twin.save(tmp_path / "twin.pt")
    monkeypatch.setenv("TWIN_CHECKPOINT", str(path))
    return twin


def add_user(uid: str, sessions: int, index: int = 3, seed: int = 11) -> list[dict]:
    events = [{**e, "user_id": uid} for e in simulate_user(seed, index, sessions)[0]]
    telemetry_store.append_events(events)
    return events


def assert_no_region_names(payload) -> None:
    text = json.dumps(payload)
    for name in REGION_NAMES:
        assert name not in text, f"{name!r} leaked"
    assert "bottleneck" not in text and "ponytail" not in text and "not an estimate" not in text


def shape(v):
    """The payload's contract: keys kept, values replaced by their JSON type."""
    if isinstance(v, dict):
        return {k: shape(x) for k, x in v.items()}
    if isinstance(v, list):
        return [shape(v[0])] if v else []
    return {bool: "bool", int: "number", float: "number", str: "str", type(None): "null"}[type(v)]


PILLAR_SHAPE = {"latest": "number", "uncertainty": "number", "average": "number", "sessions": "number"}
SNAPSHOT = {
    "user_id": "str",
    "status": "str",
    "sessions": "number",
    "min_sessions": "number",
    "pillars": {p: PILLAR_SHAPE for p in profile.PILLARS},
    "archetype": {"name": "str", "confidence": "number", "model_id": "str"},
    "archetype_reason": "null",
    "forecast": {
        "status": "str",
        "validated": "bool",
        "calibrated": "bool",
        "h": "number",
        "sessions": "number",
        "level": "number",
        "pillars": {p: {"mean": "number", "low": "number", "high": "number", "half_width": "number"} for p in profile.PILLARS},
        "calibration": {
            "source": "str",
            "calibrated": "bool",
            "range": {"min_sessions": "number", "max_sessions_by_h": ["number"], "h": ["number"]},
            "scope": "str",
            "held_out_users": "number",
            "coverage_at_h": "null",
            "coverage": "null",
        },
        "mode": "str",
        "source": "str",
    },
    "forecast_reason": "null",
    "collaboration": {"status": "str"},
    "why_this": [{"kind": "str", "reason": "str", "at": "str"}],
    "snapshots": [{
        "snapshot_id": "str",
        "timestamp_iso": "str",
        "trigger_event": "str",
        "profile_pct": {p: "number" for p in profile.PILLARS},
        "uncertainty_sigma": {p: "number" for p in profile.PILLARS},
        "cluster_id": "str",
    }],
    "fatigue_grid": [{
        "day_of_week": "number",
        "time_of_day_bucket": "str",
        "mean_rt_ms": "number",
        "error_rate": "number",
        "session_count": "number",
    }],
}


# --- the profile --------------------------------------------------------------------------------


def test_unknown_user_is_not_enough_data(client):
    r = client.get(PROFILE, params={"user_id": "nobody"})
    assert r.status_code == 200
    assert r.json() == {"user_id": "nobody", "status": "not_enough_data", "sessions": 0, "min_sessions": 1}


def test_profile_contract_snapshot(client, with_model, with_twin):
    add_user("u1", 4)
    body = client.get(PROFILE, params={"user_id": "u1"}).json()
    assert shape(body) == SNAPSHOT
    assert body["status"] == "ok" and body["sessions"] == 4
    assert body["why_this"][0]["kind"] == "style"


def test_pillars_are_the_latest_and_the_average_of_the_be07_features(client):
    events = add_user("u1", 3)
    sessions = telemetry_io.group_sessions(telemetry_io.dedupe(events))
    scores = [session_features(s.events)["pillars"] for s in sessions]
    body = client.get(PROFILE, params={"user_id": "u1"}).json()
    for p in profile.PILLARS:
        got = body["pillars"][p]
        values = [s[p]["score"] for s in scores if s[p]["score"] is not None]
        assert got["latest"] == round(values[-1], 1)
        assert got["average"] == round(sum(values) / len(values), 1)
        assert got["sessions"] == len(values)
        latest = [s[p] for s in scores if s[p]["score"] is not None][-1]
        assert got["uncertainty"] == round(latest["uncertainty"], 1)  # the app's own method (pillars.ts)


def test_ids_are_lowercased(client):
    add_user("u1", 2)
    a = client.get(PROFILE, params={"user_id": "U1"}).json()
    b = client.get(PROFILE, params={"user_id": "u1"}).json()
    assert a["status"] == "ok" and a["user_id"] == "u1" and a == b


def test_a_missing_or_invalid_clustering_model_is_archetype_null_not_an_error(client, monkeypatch, tmp_path):
    add_user("u1", 3)
    monkeypatch.setenv("CLUSTER_MODEL_PATH", str(tmp_path / "none.json"))
    body = client.get(PROFILE, params={"user_id": "u1"}).json()
    assert body["status"] == "ok" and body["archetype"] is None and body["archetype_reason"] == "no_model"
    bad = tmp_path / "bad.json"
    bad.write_text("{}", encoding="utf-8")
    monkeypatch.setenv("CLUSTER_MODEL_PATH", str(bad))
    body = client.get(PROFILE, params={"user_id": "u1"}).json()
    assert body["archetype"] is None and body["archetype_reason"] == "invalid_model"


def test_archetype_waits_for_a_finished_session(client, with_model):
    add_user("u1", 1)  # the only session is still open: no frame yet
    body = client.get(PROFILE, params={"user_id": "u1"}).json()
    assert body["status"] == "ok"
    assert body["archetype"] is None and body["archetype_reason"] == "not_enough_data"


# --- the forecast (R17 shadow mode) -----------------------------------------------------------


def test_mode_follows_validated(client, monkeypatch, tmp_path, with_twin):
    add_user("u1", 4)
    with_twin.meta = {"validation": {"validated": True}}  # as validate.promote writes it
    monkeypatch.setenv("TWIN_CHECKPOINT", str(with_twin.save(tmp_path / "promoted.pt")))
    fc = client.get(PROFILE, params={"user_id": "u1"}).json()["forecast"]
    assert fc["validated"] is True and fc["mode"] == "live"


def test_the_forecast_is_in_shadow_mode(client, with_model, with_twin):
    add_user("u1", 4)
    fc = client.get(PROFILE, params={"user_id": "u1", "h": 2}).json()["forecast"]
    assert fc["validated"] is False and fc["mode"] == "shadow"
    assert fc["source"] == fc["calibration"]["source"] == "test fixture"
    assert fc["h"] == 2 and fc["sessions"] == 4


def test_below_three_sessions_the_forecast_says_not_enough_data(client, with_twin):
    add_user("u1", 2)
    fc = client.get(PROFILE, params={"user_id": "u1"}).json()["forecast"]
    assert fc["status"] == "not_enough_data" and fc["validated"] is False and fc["mode"] == "shadow"


def test_no_checkpoint_is_forecast_null_with_a_reason(client, monkeypatch, tmp_path):
    add_user("u1", 4)
    monkeypatch.setenv("TWIN_CHECKPOINT", str(tmp_path / "missing.pt"))
    body = client.get(PROFILE, params={"user_id": "u1"}).json()
    assert body["forecast"] is None and body["forecast_reason"] == "no_model"


def test_an_old_checkpoint_is_forecast_null_with_a_reason(client, monkeypatch, tmp_path, with_twin):
    torch = pytest.importorskip("torch")
    add_user("u1", 4)
    old = {k: v for k, v in vars(with_twin.calibration).items() if k != "n_max_by_h"} | {"n_max": 13}
    path = tmp_path / "old.pt"
    torch.save({"config": with_twin.model.config, "state_dict": with_twin.model.state_dict(), "calibration": old, "meta": {}}, path)
    monkeypatch.setenv("TWIN_CHECKPOINT", str(path))
    body = client.get(PROFILE, params={"user_id": "u1"}).json()
    assert body["forecast"] is None and body["forecast_reason"] == "outdated_model"


@pytest.mark.parametrize("h", [0, 7, -1, "x", 1.5])
def test_a_bad_horizon_is_422(client, h):
    assert client.get(PROFILE, params={"user_id": "u1", "h": h}).status_code == 422


def test_the_horizon_bound_matches_the_twin():
    pytest.importorskip("torch")
    from brain_twin_jepa.jepa_model import H_MAX

    assert profile.FORECAST_H_MAX == H_MAX


# --- privacy, errors, U5 --------------------------------------------------------------------------


def test_no_brain_region_names_anywhere(client, with_model, with_twin):
    add_user("u1", 4)
    state_bus.record_step("u1", "n_back", 0.5, 0.6)
    assert_no_region_names(client.get(PROFILE, params={"user_id": "u1"}).json())
    assert_no_region_names(client.post(EVALUATE, json={"user_id": "u1"}).json())
    assert_no_region_names(client.get(PROFILE, params={"user_id": "nobody"}).json())


def test_too_large_is_413_and_a_busy_store_is_503(client, monkeypatch):
    add_user("u1", 2)
    with monkeypatch.context() as m:
        m.setattr(telemetry_io, "READ_MAX_BYTES", 10)
        assert client.get(PROFILE, params={"user_id": "u1"}).status_code == 413
    monkeypatch.setattr(telemetry_store, "LOCK_TIMEOUT_S", 0.05)
    with telemetry_store.telemetry_lock(telemetry_store.telemetry_dir()):
        r = client.get(PROFILE, params={"user_id": "u1"})
    assert r.status_code == 503 and r.headers["retry-after"] == "1"


def test_export_and_delete_cover_the_new_state(client, with_model):
    add_user("u1", 3)
    client.get(PROFILE, params={"user_id": "u1"})
    rows = [json.loads(x) for x in client.get("/v1/user/export", params={"user_id": "u1"}).text.splitlines()]
    assert any(r.get("record") == "state_bus" and r["data"]["gate"] for r in rows)
    client.delete("/v1/user/telemetry", params={"user_id": "u1"})
    assert not (state_bus.state_dir() / "u1.json").exists()
    assert client.get("/v1/user/export", params={"user_id": "u1"}).status_code == 404
    assert client.get(PROFILE, params={"user_id": "u1"}).json()["status"] == "not_enough_data"


def test_collaboration_is_not_enough_data_and_claims_no_archetype_weights(client, with_model):
    add_user("u1", 3)
    assert client.get(PROFILE, params={"user_id": "u1"}).json()["collaboration"] == {"status": "not_enough_data"}


# --- POST /v1/clustering/evaluate ------------------------------------------------------------------


def test_evaluate_without_a_model_is_501(client, monkeypatch, tmp_path):
    monkeypatch.setenv("CLUSTER_MODEL_PATH", str(tmp_path / "none.json"))
    r = client.post(EVALUATE, json={"user_id": "u1"})
    assert r.status_code == 501 and r.json() == {"detail": "no clustering model is installed"}


def test_evaluate_runs_the_users_profile_through_the_gate(client, with_model):
    assert client.post(EVALUATE, json={"user_id": "u1"}).json() == {"user_id": "u1", "status": "not_enough_data"}
    add_user("u1", 4)
    body = client.post(EVALUATE, json={"user_id": "U1"}).json()
    st = state_bus.load("u1")
    assert body["status"] == "ok" and body["user_id"] == "u1"
    assert body["archetype"]["name"] == st.tasks["archetype"]
    assert body["archetype"]["model_id"] == st.model_id
    assert body["frames"] == 3 and body["transition_occurred"] is False
    assert set(body) == {"user_id", "status", "archetype", "frames", "transition_occurred"}


@pytest.mark.parametrize("payload", [{"user_id": "u1", "latent_vector": [0.1]}, {"user_id": "../x"}, {}])
def test_evaluate_takes_only_a_user_id(client, with_model, payload):
    # The server clusters what it measured, never a vector a client sends.
    assert client.post(EVALUATE, json=payload).status_code == 422


# --- Member 5: GET /v1/tasks/next asks the bus for the user's pool ------------------------------


def served_pool(client, uid, seq):
    r = client.get("/v1/tasks/next", params={"user_id": uid, "session_id": "play1", "seq": seq})
    assert r.status_code == 200
    from dynamic_cache import api

    data = api.get_dispatcher().export(uid)
    return next(rec["archetype"] for rec in data["sessions"].values() if rec["task_id"] == r.json()["task_id"])


def test_tasks_next_asks_the_bus_for_the_users_pool_once_a_cluster_exists(client, monkeypatch, tmp_path, gmm_file):
    add_user("u1", 3)
    monkeypatch.setenv("CLUSTER_MODEL_PATH", str(tmp_path / "none.json"))
    assert served_pool(client, "u1", 0) == state_bus.NEUTRAL
    assert state_bus.load("u1").tasks is None
    monkeypatch.setenv("CLUSTER_MODEL_PATH", str(gmm_file))
    pool = served_pool(client, "u1", 1)
    # The task request clustered the user through the bus; the pool is the retained one, NEUTRAL
    # for every cluster until per-style generator options exist (state_bus.pool_name).
    st = state_bus.load("u1")
    assert st.tasks is not None and pool == st.tasks["pool"] == state_bus.NEUTRAL


def test_new_staircases_are_seeded_from_the_users_pillars(client, with_model):
    from dynamic_cache import api
    from dynamic_cache.parameter_projector import project

    add_user("u1", 3)
    served_pool(client, "u1", 0)
    rec = api.get_dispatcher().export("u1")["schemas"]
    (schema, staircase), = rec.items()
    assert staircase["theta"] == pytest.approx(project(state_bus.load("u1").pillars, schema), abs=0.11)


def test_tasks_next_still_serves_when_the_bus_fails(client, with_model, monkeypatch):
    add_user("u1", 3)

    def broken(*a, **k):
        raise RuntimeError("bus down")

    monkeypatch.setattr(state_bus, "refresh_light", broken)
    assert served_pool(client, "u1", 0) == state_bus.NEUTRAL


# --- Member 2: the coach gets Δc, never as numbers --------------------------------------------


def chat(client, message):
    return client.post("/v1/coach/chat", json={"user_id": "u1", "transcript": [], "message": message, "kind": "typed"})


def test_delta_c_reaches_the_scripted_coach_without_numbers(client, with_model):
    from ai_coach.agent import OFFLINE_WHY_REPLY
    from ai_coach.safety_guardrails import lint_text

    assert chat(client, "why did it get harder?").json()["message"]["text"] == OFFLINE_WHY_REPLY  # no profile yet
    add_user("u1", 4)
    state_bus.record_step("u1", "n_back", 0.5, 0.6)
    ctx = state_bus.coach_context("u1")
    assert ctx and ctx["delta_vector"] and set(ctx["delta_vector"]) == set(profile.PILLARS)
    text = chat(client, "why did it get harder?").json()["message"]["text"]
    assert text != OFFLINE_WHY_REPLY
    assert text.startswith("Memory Gauntlet got a little harder because your recent rounds went well.")
    assert "than the nearest one" in text or "taking shape" in text  # the Δc line
    assert not any(ch.isdigit() for ch in text) and "%" not in text
    assert lint_text(text) == []


def test_delta_c_reaches_the_llm_context_as_words_only(client, with_model):
    from ai_coach import api as coach_api
    from ai_coach.agent import numbers_in

    class Runner:
        def __init__(self):
            self.llm_calls = []

        def generate(self, system, contents, **kw):
            return json.dumps({"reason": "a question about the rounds", "risk": "none"})

        def __call__(self, messages, deadline=None):
            self.llm_calls.append(messages)
            return "Your rounds got 20% harder."  # a number the user never saw: withheld

    add_user("u1", 4)
    runner = Runner()
    app.dependency_overrides[coach_api.get_runner] = lambda: runner
    try:
        r = chat(client, "why did it change?")
    finally:
        app.dependency_overrides.pop(coach_api.get_runner, None)
    system = runner.llm_calls[0][0]["content"]
    block = system.split("### PRACTICE PROFILE CONTEXT", 1)[1]
    assert "than the nearest one" in block or "taking shape" in block
    assert numbers_in(block) == set()
    body = r.json()
    assert body["reply_source"] == "offline_after_check"
    assert numbers_in(body["message"]["text"]) == set()


@pytest.mark.parametrize("pillar", profile.PILLARS)
@pytest.mark.parametrize("sign", [1, -1])
def test_every_coach_line_fits_lotis_shape(pillar, sign):
    from ai_coach.agent import fit_bubbles, numbers_in
    from ai_coach.safety_guardrails import lint_text
    from ai_coach.xai_explainer import XAIExplainer

    delta = {p: (sign * 20.0 if p == pillar else 0.0) for p in profile.PILLARS}
    lines = [XAIExplainer().profile_delta_line(delta, 0.1), XAIExplainer().profile_delta_line(delta, 0.9)]
    lines += [profile.trail_reason({"kind": k, "schema": s}) for k in ("harder", "easier") for s in profile.EXERCISE_NAME]
    lines += [profile.trail_reason({"kind": "style", "archetype": "Methodical solver", "first": f}) for f in (True, False)]
    for line in lines:
        assert fit_bubbles(line) == line, line  # one bubble of at most 12 words
        assert numbers_in(line) == set() and lint_text(line) == []

def test_req_be_03_historical_snapshots_and_req_be_04_fatigue_grid(client, with_model, with_twin):
    add_user("u_time_travel", 3)
    body = client.get(PROFILE, params={"user_id": "u_time_travel"}).json()
    assert body["status"] == "ok"
    assert "snapshots" in body and len(body["snapshots"]) == 3
    s0 = body["snapshots"][0]
    assert "snapshot_id" in s0 and "profile_pct" in s0 and "uncertainty_sigma" in s0
    assert "fatigue_grid" in body and len(body["fatigue_grid"]) > 0
    fg0 = body["fatigue_grid"][0]
    assert "day_of_week" in fg0 and "mean_rt_ms" in fg0 and "error_rate" in fg0
