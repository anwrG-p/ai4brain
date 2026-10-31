"""The promotion gate (R17): refuses on synthetic data where the twin barely beats the naive
forecast, promotes only when every check passes, and writes nothing otherwise."""

import copy

import pytest

pytest.importorskip("torch")

from brain_twin_jepa import validate  # noqa: E402
from brain_twin_jepa.jepa_model import BrainTwin  # noqa: E402
from brain_twin_jepa.train import synthetic_histories  # noqa: E402
from data.synthetic.generate import generate  # noqa: E402


def passing() -> dict:
    return {
        "source": "test",
        "level": 0.8,
        "held_out_users": 150,
        "eligible_users": 120,
        "coverage": {"focus": 0.79, "agility": 0.82, "impulse": 0.8, "memory": 0.76, "visual": 0.84},
        "margin_points": 1.4,
        "margin_ci": [0.6, 2.1],
    }


def test_refuses_when_the_margin_over_the_mean_of_history_is_too_small(trained):
    twin, _, _ = trained
    # 240 fresh synthetic users (another data_seed), 10 sessions each: enough users, but the twin's
    # gain over the mean of history is a fraction of a point on this data.
    evidence, cal = validate.evaluate(twin, synthetic_histories(240, 10, seed=7), "test: synthetic seed 7")
    reasons = validate.failures(evidence)
    assert evidence["eligible_users"] >= validate.MIN_USERS
    assert any("margin" in r for r in reasons), (evidence, reasons)
    assert evidence["margin_points"] < validate.MARGIN_POINTS
    assert cal.source == "test: synthetic seed 7" and evidence["bootstrap_users"] == evidence["held_out_users"]


def test_every_check_must_pass():
    assert validate.failures(passing()) == []
    cases = {
        "eligible_users": (99, "held-out users"),
        "coverage": ({**passing()["coverage"], "memory": 0.74}, "memory coverage"),
        "margin_ci": ([-0.1, 2.0], "does not exclude 0"),
        "margin_points": (0.99, "below 1.0"),
    }
    for key, (value, why) in cases.items():
        reasons = validate.failures({**passing(), key: value})
        assert len(reasons) == 1 and why in reasons[0], (key, reasons)
    assert any("coverage" in r for r in validate.failures({**passing(), "coverage": {"focus": float("nan")}}))


def test_promote_writes_validated_and_the_refitted_calibration(trained, tmp_path):
    twin, _, _ = trained
    twin = BrainTwin(copy.deepcopy(twin.model), copy.deepcopy(twin.calibration), dict(twin.meta))
    cal = copy.deepcopy(twin.calibration)
    cal.source = "real: telemetry export (test)"
    path = validate.promote(twin, cal, passing(), tmp_path / "promoted.pt")
    loaded = BrainTwin.load(path)
    assert loaded.validated and loaded.meta["validation"]["margin_points"] == 1.4
    out = loaded.forecast(synthetic_histories(1, 4, seed=3)[0], 1)
    assert out["validated"] is True and out["calibration"]["source"] == "real: telemetry export (test)"


def test_cli_refuses_and_leaves_the_checkpoint_in_shadow_mode(trained, tmp_path, capsys):
    twin, _, _ = trained
    ckpt = twin.save(tmp_path / "twin.pt")
    before = ckpt.read_bytes()
    generate(12, 9, 5, tmp_path / "data")
    code = validate.main(["--data", str(tmp_path / "data"), "--source", "test", "--checkpoint", str(ckpt)])
    out = capsys.readouterr().out
    assert code == 1 and "NOT PROMOTED" in out and "held-out users" in out
    assert ckpt.read_bytes() == before
    assert BrainTwin.load(ckpt).validated is False
