import json

EVENT = {
    "user_id": "u1",
    "session_id": "s1",
    "task_id": "t1",
    "trial_index": 0,
    "dimension": "working_memory",
    "score_norm": 1.0,
    "response_time_ms": 512.5,
    "error_flag": False,
    "error_burst": 0,
    "hesitation_jitter": 12.3,
    "keystroke_latency_ms": 200.0,
    "trial_meta": {"item_id": "t1:0"},
    "client_ts": "2026-10-23T12:00:00Z",
}

URL = "/v1/telemetry/event"


def post(client, **overrides):
    return client.post(URL, json={**EVENT, **overrides})


def test_single_event_appended(client, tmp_path):
    r = client.post(URL, json=EVENT)
    assert r.status_code == 202 and r.json() == {"accepted": 1}
    line = json.loads((tmp_path / "u1.jsonl").read_text().splitlines()[0])
    assert line["score_norm"] == 1.0 and "received_at" in line


def test_batch_accepted(client, tmp_path):
    batch = [{**EVENT, "trial_index": i} for i in range(3)]
    r = client.post(URL, json=batch)
    assert r.status_code == 202 and r.json() == {"accepted": 3}
    assert len((tmp_path / "u1.jsonl").read_text().splitlines()) == 3


def test_batch_over_100_rejected(client, tmp_path):
    r = client.post(URL, json=[EVENT] * 101)
    assert r.status_code == 422
    assert list(tmp_path.iterdir()) == []


def test_path_traversal_user_id_rejected(client, tmp_path):
    r = post(client, user_id="../x")
    assert r.status_code == 422
    assert list(tmp_path.iterdir()) == []
    assert not (tmp_path.parent / "x.jsonl").exists()


def test_extra_field_rejected(client):
    assert post(client, audio_b64="AAAA").status_code == 422


def test_voice_without_opt_in_rejected(client):
    assert post(client, voice_latency_ms=300).status_code == 422


def test_voice_with_opt_in_accepted(client):
    r = post(client, voice_opt_in=True, voice_latency_ms=300, vocal_pace_hz=3.2)
    assert r.status_code == 202


def test_new_dimensions_accepted(client):
    for dim in ("processing_speed", "episodic_memory"):
        assert post(client, dimension=dim).status_code == 202


def test_bad_dimension_rejected(client):
    assert post(client, dimension="memory").status_code == 422


def test_score_out_of_range_rejected(client):
    assert post(client, score_norm=1.5).status_code == 422


def test_trial_meta_scalars_accepted(client):
    r = post(client, trial_meta={"hops": 3, "inverted": True, "kind": "lure"})
    assert r.status_code == 202


def test_trial_meta_nested_rejected(client):
    assert post(client, trial_meta={"x": {"y": 1}}).status_code == 422


def test_trial_meta_too_many_keys_rejected(client):
    meta = {f"k{i}": i for i in range(17)}
    assert post(client, trial_meta=meta).status_code == 422


def test_trial_meta_bad_key_rejected(client):
    assert post(client, trial_meta={"Bad-Key": 1}).status_code == 422


def post_raw(client, raw: str):
    return client.post(URL, content=raw, headers={"Content-Type": "application/json"})


def event_raw(field: str, literal: str) -> str:
    return json.dumps({**EVENT, field: "__X__"}).replace('"__X__"', literal)


def test_infinity_in_numeric_field_rejected(client, tmp_path):
    for field in ("hesitation_jitter", "keystroke_latency_ms"):
        assert post_raw(client, event_raw(field, "Infinity")).status_code == 422
    raw = event_raw("voice_latency_ms", "Infinity").replace(
        '"trial_meta"', '"voice_opt_in": true, "trial_meta"'
    )
    assert post_raw(client, raw).status_code == 422
    assert list(tmp_path.iterdir()) == []


def test_nan_in_trial_meta_rejected(client, tmp_path):
    r = post_raw(client, event_raw("trial_meta", '{"x": NaN}'))
    assert r.status_code == 422
    assert list(tmp_path.iterdir()) == []


def test_nan_in_hesitation_jitter_returns_422_not_500(client, tmp_path):
    r = post_raw(client, event_raw("hesitation_jitter", "NaN"))
    assert r.status_code == 422
    assert list(tmp_path.iterdir()) == []


def test_trial_meta_long_string_rejected(client, tmp_path):
    assert post(client, trial_meta={"x": "a" * 65}).status_code == 422
    assert list(tmp_path.iterdir()) == []
