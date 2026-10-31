"""Training on BE-08 synthetic users: loss, determinism, ragged histories, the interval, coverage."""

from dataclasses import replace

import numpy as np
import pytest

torch = pytest.importorskip("torch")

from brain_twin_jepa.jepa_model import COVERAGE_SCOPE, H_MAX, PILLARS, BrainTwin  # noqa: E402
from brain_twin_jepa.train import (  # noqa: E402
    TrainConfig,
    directory_histories,
    fit,
    history_from_events,
    main,
    synthetic_histories,
    to_tensors,
    train_model,
)
from data.synthetic.generate import generate, simulate_user  # noqa: E402

# The shared twin (conftest.py `trained`) must train and calibrate within this budget in CI.
TIME_BUDGET_S = 120
TINY = TrainConfig(users=24, sessions=9, steps=15, latent=8, hidden=16, log_every=5)


def test_loss_decreases_on_synthetic_data(trained):
    _, report, _ = trained
    first, last = report["curve"][0], report["curve"][-1]
    assert last["total"] < 0.5 * first["total"]
    for k in ("jepa", "anchor", "forecast"):
        assert last[k] < first[k], k


def test_same_seed_same_weights_other_seed_other_weights():
    x, y, lengths = to_tensors(synthetic_histories(TINY.users, TINY.sessions, 0))
    rng_before = torch.random.get_rng_state()
    threads = torch.get_num_threads()
    a, curve_a = train_model(x, y, TINY, lengths)
    b, curve_b = train_model(x, y, TINY, lengths)
    c, _ = train_model(x, y, replace(TINY, seed=1), lengths)
    sa, sb, sc = a.state_dict(), b.state_dict(), c.state_dict()
    assert all(torch.equal(sa[k], sb[k]) for k in sa)
    assert curve_a == curve_b
    assert not all(torch.equal(sa[k], sc[k]) for k in sa)
    # Training leaves the global RNG, the thread count and the determinism switch as it found them.
    assert torch.equal(torch.random.get_rng_state(), rng_before)
    assert torch.get_num_threads() == threads
    assert not torch.are_deterministic_algorithms_enabled()


def test_ragged_histories_are_padded_not_cut():
    hs = [history_from_events(simulate_user(0, i, n)[0]) for i, n in enumerate([12, 4, 2, 9])]
    x, y, lengths = to_tensors(hs)
    assert x.shape[:2] == (4, 12) and lengths.tolist() == [12, 4, 2, 9]
    assert torch.isnan(y[1, 4:]).all() and not torch.isnan(y[1, :4]).any()
    assert (x[2, 2:] == 0).all()


def test_fit_keeps_every_session_of_ragged_users_and_short_users_do_not_abort():
    lengths = [10 + i % 5 for i in range(40)] + [1, 2, 3]  # three users too short to forecast
    hs = [history_from_events(simulate_user(1, i, n)[0]) for i, n in enumerate(lengths)]
    twin, report = fit(replace(TINY, steps=20), hs, source="test: ragged synthetic")
    assert report["sessions_per_user"] == {"min": 1, "max": 14}
    cal = twin.calibration
    assert cal.source == "test: ragged synthetic"
    assert cal.n_min == 3 and cal.n_max >= 9 and 1 <= cal.h_max <= H_MAX


def test_fit_needs_a_source_for_supplied_histories_and_users_long_enough():
    hs = synthetic_histories(4, 6, 0)
    with pytest.raises(ValueError, match="need a source label"):
        fit(TINY, hs)
    with pytest.raises(ValueError, match="more than 3 sessions"):
        fit(TINY, [h[:3] for h in hs], source="test")


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


def test_held_out_coverage_is_near_nominal(trained):
    """Per pillar pooled over h within ±0.10; every pillar x h cell within ±0.12 (a cell holds a few
    hundred forecasts, and BLAS differences across platforms move a handful of them)."""
    twin, report, seconds = trained
    cal = twin.calibration
    assert seconds < TIME_BUDGET_S
    assert report["users"]["test"] == report["config"]["users"] // 5 == cal.held_out_users
    cov = np.array(cal.coverage)
    assert cov.shape == (len(PILLARS), H_MAX)
    assert np.all(np.abs(np.array(cal.coverage_overall) - cal.level) <= 0.10), cal.coverage_overall
    assert np.all(np.abs(cov - cal.level) <= 0.12), cov


def test_forecast_carries_its_calibration_evidence(trained):
    twin, report, _ = trained
    out = twin.forecast(synthetic_histories(1, 4, seed=7)[0], 2)
    assert out["status"] == "ok" and out["level"] == 0.8 and out["h"] == 2
    assert out["validated"] is False and out["calibrated"] is True
    for p in PILLARS:
        b = out["pillars"][p]
        assert 0 <= b["low"] <= b["mean"] <= b["high"] <= 100
    ev = out["calibration"]
    assert ev["source"] == report["source"] == "synthetic: BE-08 generator in-process (400 users x 12 sessions, data_seed 0)"
    assert ev["scope"] == COVERAGE_SCOPE
    assert ev["held_out_users"] == twin.calibration.held_out_users
    assert set(ev["coverage_at_h"]) == set(PILLARS)


def test_generator_files_read_back_as_the_same_sessions(tmp_path):
    generate(2, 3, 11, tmp_path)
    from_files = directory_histories(tmp_path)  # BE-07 read_sessions; _truth/ is not read
    assert from_files == [history_from_events(simulate_user(11, i, 3)[0]) for i in range(2)]


def test_cli_trains_and_writes_a_loadable_checkpoint(tmp_path, capsys):
    out = tmp_path / "models" / "checkpoints" / "sat_jepa.pt"
    assert main(["--users", "30", "--sessions", "9", "--steps", "5", "--out", str(out)]) == 0
    assert "held-out coverage" in capsys.readouterr().out
    twin = BrainTwin.load(out)
    assert twin.forecast(synthetic_histories(1, 3, seed=5)[0], 1)["validated"] is False


def test_cli_with_data_requires_a_source(tmp_path, capsys):
    with pytest.raises(SystemExit):
        main(["--data", str(tmp_path)])
    assert "--source is required with --data" in capsys.readouterr().err
