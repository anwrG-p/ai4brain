"""SAT-JEPA network: shapes, the EMA update, the leaky integrator, features, forecast contract."""

from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

torch = pytest.importorskip("torch")

from brain_twin_jepa import jepa_model  # noqa: E402
from brain_twin_jepa.jepa_model import (  # noqa: E402
    COVERAGE_SCOPE,
    EMA_TAU,
    H_MAX,
    MIN_SESSIONS,
    N_FEATURES,
    PILLARS,
    SATJEPA,
    BrainTwin,
    Calibration,
    LeakyIntegrator,
    session_matrix,
    session_record,
)
from brain_twin_jepa.telemetry_io import group_sessions  # noqa: E402
from data.synthetic.generate import simulate_user  # noqa: E402

T0 = datetime(2026, 3, 2, 18, 0, tzinfo=timezone.utc)


def record(i: int, gap_days: float = 2.0, score: float = 60.0, missing: tuple = ()) -> dict:
    return {
        "session_id": f"s{i}",
        "started_at": T0 + timedelta(days=gap_days * i),
        "pillars": {p: (None if p in missing else score) for p in PILLARS},
        "coverage": {p: (0.0 if p in missing else 1.0) for p in PILLARS},
    }


def history(n: int, **kw) -> list[dict]:
    return [record(i, **kw) for i in range(n)]


def calibration(**kw) -> Calibration:
    base = {"level": 0.8, "a": [100.0] * 5, "b": [10.0] * 5, "z": [1.28] * 5, "source": "test fixture", "n_min": 3, "n_max_by_h": [8, 7, 6, 5, 4, 3]}
    return Calibration(**{**base, **kw})


def twin(**kw) -> BrainTwin:
    torch.manual_seed(0)
    return BrainTwin(SATJEPA(latent=8, hidden=16), calibration(**kw))


def test_session_record_uses_be07_features():
    events, truth = simulate_user(0, 3, 2)
    recs = [session_record(s) for s in group_sessions(events)]
    assert [r["session_id"] for r in recs] == [s["session_id"] for s in truth["sessions"]]
    for r in recs:
        assert all(0 <= r["pillars"][p] <= 100 for p in PILLARS)
        assert set(r["coverage"]) == set(PILLARS)


def test_session_matrix_shapes_and_values():
    x, y = session_matrix(history(4, gap_days=3.0, missing=("memory",)))
    assert x.shape == (4, N_FEATURES) and y.shape == (4, 5)
    k = PILLARS.index("memory")
    assert np.isnan(y[:, k]).all() and (x[:, k] == 0).all() and (x[:, 5 + k] == 0).all()
    assert y[0, 0] == pytest.approx(0.6)
    assert x[0, 10] == 0  # no gap before the first session
    assert x[1, 10] == pytest.approx(np.log1p(3.0) / np.log1p(28.0))
    assert x[0, 11] ** 2 + x[0, 12] ** 2 == pytest.approx(1.0)  # time of day on the unit circle


def test_network_shapes():
    torch.manual_seed(0)
    m = SATJEPA(latent=8, hidden=16)
    x = torch.rand(3, 7, N_FEATURES)
    sbar = m.context(x)
    assert sbar.shape == (3, 7, 8)
    assert m.predict(sbar[:, -1], torch.full((3,), 7), 2).shape == (3, 8)
    assert m.forecast_scores(x, 4).shape == (3, 5)
    losses = m.losses(x, torch.rand(3, 7, 5))
    assert set(losses) == {"jepa", "anchor", "forecast", "total"}
    assert all(v.shape == () for v in losses.values())


def test_losses_ignore_padding_after_a_short_history():
    torch.manual_seed(0)
    m = SATJEPA(latent=8, hidden=16)
    x, y = torch.rand(2, 8, N_FEATURES), torch.rand(2, 8, 5)
    lengths = torch.tensor([8, 5])
    base = m.losses(x, y, lengths)
    x2, y2 = x.clone(), y.clone()
    x2[1, 5:] = 123.0  # garbage (not NaN) in the padding of x and y changes nothing
    y2[1, 5:] = -77.0
    padded = m.losses(x2, y2, lengths)
    for k in base:
        assert torch.allclose(base[k], padded[k]), k


def test_ema_update_is_exact():
    torch.manual_seed(1)
    m = SATJEPA(latent=8, hidden=16)
    with torch.no_grad():  # make online and target differ
        for p in m.context_encoder.parameters():
            p.add_(torch.randn_like(p))
    before = [p.clone() for p in m.target_encoder.parameters()]
    online = [p.clone() for p in m.context_encoder.parameters()]
    m.ema_update()
    assert m.tau == EMA_TAU == 0.996
    for old, src, new in zip(before, online, m.target_encoder.parameters(), strict=True):
        assert torch.equal(new, EMA_TAU * old + (1 - EMA_TAU) * src)
        assert not torch.equal(new, old)
    assert all(not p.requires_grad for p in m.target_encoder.parameters())
    assert all(p.requires_grad for p in m.context_encoder.parameters())


def test_target_encoder_gets_no_gradient():
    torch.manual_seed(2)
    m = SATJEPA(latent=8, hidden=16)
    m.losses(torch.rand(2, 6, N_FEATURES), torch.rand(2, 6, 5))["total"].backward()
    assert all(p.grad is None for p in m.target_encoder.parameters())
    assert any(p.grad is not None and p.grad.abs().sum() > 0 for p in m.context_encoder.parameters())


def test_leaky_integrator_formula_and_causality():
    li = LeakyIntegrator(4, leak=0.7)
    e = torch.randn(2, 5, 4)
    s = li(e)
    a = li.leak
    assert torch.allclose(a, torch.full((4,), 0.7))
    expected = e[:, 0]
    assert torch.equal(s[:, 0], e[:, 0])
    for t in range(1, 5):
        expected = a * expected + (1 - a) * e[:, t]
        assert torch.allclose(s[:, t], expected)
    e2 = e.clone()
    e2[:, 4] += 10  # a later session never changes an earlier state
    assert torch.equal(li(e2)[:, :4], s[:, :4])


def test_fewer_than_three_sessions_is_not_enough_data():
    t = twin()
    for n in range(MIN_SESSIONS):
        assert t.forecast(history(n), 1) == {"status": "not_enough_data", "validated": False, "sessions": n, "min_sessions": 3}
    assert t.forecast(history(3), 1)["status"] == "ok"


def test_module_forecast_needs_no_checkpoint_for_not_enough_data(monkeypatch, tmp_path):
    monkeypatch.setattr(jepa_model, "DEFAULT_CHECKPOINT", tmp_path / "missing.pt")
    monkeypatch.setattr(jepa_model, "_default", None)
    assert jepa_model.forecast(history(2), 3) == {"status": "not_enough_data", "validated": False, "sessions": 2, "min_sessions": 3}
    with pytest.raises(FileNotFoundError, match="missing.pt"):
        jepa_model.forecast(history(3), 3)


@pytest.mark.parametrize("h", [0, H_MAX + 1, 1.5, True])
def test_horizon_outside_1_to_h_max_is_rejected(h):
    with pytest.raises(ValueError, match="h must be an integer from 1 to 6"):
        twin().forecast(history(5), h)


def test_payload_is_shadow_mode_with_source_and_marginal_scope():
    out = twin(coverage=[[0.8] * H_MAX] * 5, coverage_overall=[0.8] * 5, held_out_users=40).forecast(history(4), 2)
    assert out["validated"] is False and out["calibrated"] is True
    ev = out["calibration"]
    assert ev["source"] == "test fixture"
    assert ev["scope"] == COVERAGE_SCOPE and ev["scope"].startswith("marginal")
    assert "not a guarantee for any one user" in ev["scope"]
    assert ev["coverage_at_h"] == {p: 0.8 for p in PILLARS}


# Calibration users had (n, h) only where n + h <= their history: a triangle. With n_max_by_h
# [8, 7, 6, 5], (8, 1) and (5, 4) were calibrated; (8, 4), the rectangle's corner (n_max, h_max), was not.
TRIANGLE = {"n_max_by_h": [8, 7, 6, 5], "h_max": 4, "coverage": [[0.8] * 4] * 5, "coverage_overall": [0.8] * 5}


@pytest.mark.parametrize("n, h", [(3, 1), (8, 1), (7, 2), (5, 4)])
def test_inside_the_calibrated_triangle_claims_coverage(n, h):
    out = twin(**TRIANGLE).forecast(history(n), h)
    assert out["calibrated"] is True and out["calibration"]["coverage_at_h"] is not None


@pytest.mark.parametrize("n, h", [(8, 4), (7, 3), (8, 2), (9, 1), (12, 3), (4, 5)])
def test_outside_the_calibrated_range_makes_no_coverage_claim(n, h):
    t = twin(**TRIANGLE)
    assert (t.calibration.n_max, t.calibration.h_max) == (8, 4)
    out = t.forecast(history(n), h)
    assert out["status"] == "ok" and out["calibrated"] is False and out["validated"] is False
    ev = out["calibration"]
    assert ev["calibrated"] is False
    assert ev["range"] == {"min_sessions": 3, "max_sessions_by_h": [8, 7, 6, 5], "h": [1, 4]}
    assert not {"coverage", "coverage_at_h", "held_out_users", "scope"} & set(ev)


def test_validated_only_from_the_promotion_metadata():
    t = twin()
    assert t.forecast(history(4), 1)["validated"] is False
    t.meta = {"validation": {"validated": "yes"}}  # anything but True stays false
    assert t.forecast(history(4), 1)["validated"] is False
    t.meta = {"validation": {"validated": True}}
    assert t.forecast(history(4), 1)["validated"] is True


def test_a_pillar_never_scored_gets_no_forecast():
    out = twin().forecast(history(4, missing=("memory",)), 2)
    assert out["pillars"]["memory"] is None
    assert out["pillars"]["focus"] is not None


def test_checkpoint_round_trip(tmp_path):
    t = twin(coverage=[[0.8] * H_MAX] * 5, coverage_overall=[0.8] * 5)
    t.meta = {"note": "test", "validation": {"validated": False}}
    loaded = BrainTwin.load(t.save(tmp_path / "ckpt" / "twin.pt"))
    assert loaded.forecast(history(5), 3) == t.forecast(history(5), 3)
    assert loaded.meta == t.meta and loaded.calibration == t.calibration
