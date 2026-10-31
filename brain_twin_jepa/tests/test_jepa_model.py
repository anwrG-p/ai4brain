"""SAT-JEPA network: shapes, the EMA update, the leaky integrator, features, forecast contract."""

from datetime import datetime, timedelta, timezone

import numpy as np
import pytest
import torch

from brain_twin_jepa import jepa_model
from brain_twin_jepa.jepa_model import (
    EMA_TAU,
    H_MAX,
    MIN_SESSIONS,
    N_FEATURES,
    PILLARS,
    BrainTwin,
    Calibration,
    LeakyIntegrator,
    SATJEPA,
    session_matrix,
)
from brain_twin_jepa.session_adapter import SessionRecord

T0 = datetime(2026, 3, 2, 18, 0, tzinfo=timezone.utc)


def record(i: int, gap_days: float = 2.0, score: float = 60.0, missing: tuple = ()) -> SessionRecord:
    return SessionRecord(
        session_id=f"s{i}",
        started_at=T0 + timedelta(days=gap_days * i),
        pillars={p: (None if p in missing else score) for p in PILLARS},
        coverage={p: (0.0 if p in missing else 1.0) for p in PILLARS},
    )


def history(n: int, **kw) -> list[SessionRecord]:
    return [record(i, **kw) for i in range(n)]


def flat_calibration() -> Calibration:
    return Calibration(level=0.8, a=[100.0] * 5, b=[10.0] * 5, z=[1.28] * 5)


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
    twin = BrainTwin(SATJEPA(latent=8, hidden=16), flat_calibration())
    for n in range(MIN_SESSIONS):
        out = twin.forecast(history(n), 1)
        assert out == {"status": "not_enough_data", "sessions": n, "min_sessions": 3}
    assert twin.forecast(history(3), 1)["status"] == "ok"


def test_module_forecast_needs_no_checkpoint_for_not_enough_data(monkeypatch, tmp_path):
    monkeypatch.setattr(jepa_model, "DEFAULT_CHECKPOINT", tmp_path / "missing.pt")
    monkeypatch.setattr(jepa_model, "_default", None)
    assert jepa_model.forecast(history(2), 3)["status"] == "not_enough_data"
    with pytest.raises(FileNotFoundError):
        jepa_model.forecast(history(3), 3)


@pytest.mark.parametrize("h", [0, H_MAX + 1, 1.5, True])
def test_horizon_outside_the_calibrated_range_is_rejected(h):
    twin = BrainTwin(SATJEPA(latent=8, hidden=16), flat_calibration())
    with pytest.raises(ValueError):
        twin.forecast(history(5), h)


def test_a_pillar_never_scored_gets_no_forecast():
    twin = BrainTwin(SATJEPA(latent=8, hidden=16), flat_calibration())
    out = twin.forecast(history(4, missing=("memory",)), 2)
    assert out["pillars"]["memory"] is None
    assert out["pillars"]["focus"] is not None


def test_checkpoint_round_trip(tmp_path):
    torch.manual_seed(3)
    twin = BrainTwin(SATJEPA(latent=8, hidden=16), flat_calibration(), {"note": "test"})
    path = twin.save(tmp_path / "ckpt" / "twin.pt")
    loaded = BrainTwin.load(path)
    assert loaded.forecast(history(5), 3) == twin.forecast(history(5), 3)
    assert loaded.meta == {"note": "test"}
