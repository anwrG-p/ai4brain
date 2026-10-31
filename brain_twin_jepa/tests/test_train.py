"""Training on BE-08 synthetic users: loss, determinism, the interval and its held-out coverage."""

from dataclasses import replace

import numpy as np
import torch

from brain_twin_jepa.jepa_model import H_MAX, PILLARS, BrainTwin
from brain_twin_jepa.train import TrainConfig, fit, main, synthetic_histories, to_tensors, train_model

# The shared twin (conftest.py `trained`) must train and calibrate within this budget in CI.
TIME_BUDGET_S = 120

TINY = TrainConfig(users=24, sessions=9, steps=15, latent=8, hidden=16, log_every=5)


def test_loss_decreases_on_synthetic_data(trained):
    _, report, _ = trained
    curve = report["curve"]
    first, last = curve[0], curve[-1]
    assert last["total"] < 0.5 * first["total"]
    assert last["jepa"] < first["jepa"]
    assert last["forecast"] < first["forecast"]
    assert last["anchor"] < first["anchor"]


def test_same_seed_same_weights_other_seed_other_weights():
    x, y = to_tensors(synthetic_histories(TINY.users, TINY.sessions, 0))
    a, curve_a = train_model(x, y, TINY)
    b, curve_b = train_model(x, y, TINY)
    c, _ = train_model(x, y, replace(TINY, seed=1))
    sa, sb, sc = a.state_dict(), b.state_dict(), c.state_dict()
    assert all(torch.equal(sa[k], sb[k]) for k in sa)
    assert curve_a == curve_b
    assert not all(torch.equal(sa[k], sc[k]) for k in sa)


def test_interval_widens_with_h(trained):
    twin, _, _ = trained
    cal = twin.calibration
    for k in range(len(PILLARS)):
        widths = [cal.half_width(k, h) for h in range(1, H_MAX + 1)]
        assert all(w2 > w1 for w1, w2 in zip(widths, widths[1:], strict=False))
    hist = synthetic_histories(1, 5, seed=99)[0]
    outs = [twin.forecast(hist, h) for h in range(1, H_MAX + 1)]
    for p in PILLARS:
        bands = [o["pillars"][p] for o in outs]
        hw = [b["half_width"] for b in bands]
        assert all(w2 > w1 for w1, w2 in zip(hw, hw[1:], strict=False)), (p, hw)
        if all(0 < b["low"] and b["high"] < 100 for b in bands):  # not clipped at the scale's ends
            spans = [b["high"] - b["low"] for b in bands]
            assert spans[-1] > spans[0], (p, spans)


def test_held_out_coverage_is_within_ten_points_of_nominal(trained):
    twin, report, seconds = trained
    cal = twin.calibration
    assert seconds < TIME_BUDGET_S
    assert report["users"]["test"] == report["config"]["users"] // 5 == cal.held_out_users
    cov = np.array(cal.coverage)
    assert cov.shape == (len(PILLARS), H_MAX)
    assert np.all(np.abs(cov - cal.level) <= 0.10), cov
    assert np.all(np.abs(np.array(cal.coverage_overall) - cal.level) <= 0.10)


def test_forecast_carries_its_calibration_evidence(trained):
    twin, _, _ = trained
    out = twin.forecast(synthetic_histories(1, 4, seed=7)[0], 2)
    assert out["status"] == "ok" and out["level"] == 0.8 and out["h"] == 2
    for p in PILLARS:
        b = out["pillars"][p]
        assert 0 <= b["low"] <= b["mean"] <= b["high"] <= 100
    ev = out["calibration"]
    assert "synthetic" in ev["data"]
    assert ev["held_out_users"] == twin.calibration.held_out_users
    assert set(ev["coverage_at_h"]) == set(PILLARS)


def test_cli_trains_and_writes_a_loadable_checkpoint(tmp_path, capsys):
    out = tmp_path / "models" / "checkpoints" / "sat_jepa.pt"
    assert main(["--users", "30", "--sessions", "9", "--steps", "5", "--out", str(out)]) == 0
    assert "held-out coverage" in capsys.readouterr().out
    twin = BrainTwin.load(out)
    assert twin.forecast(synthetic_histories(1, 3, seed=5)[0], 1)["status"] == "ok"


def test_fit_rejects_histories_too_short_to_calibrate():
    try:
        fit(TrainConfig(users=10, sessions=8, steps=1))
    except ValueError as e:
        assert "at least 9 sessions" in str(e)
    else:
        raise AssertionError("expected ValueError")
