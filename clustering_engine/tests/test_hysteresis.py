"""BE-09: Schmitt-trigger hysteresis gate (delta 0.15, N_confirm 3)."""

import dataclasses

import pytest

from clustering_engine.hysteresis import DELTA_HYST, N_CONFIRM, HysteresisGate

A = [0.8, 0.2]
B = [0.2, 0.8]


def test_defaults_match_the_readme():
    gate = HysteresisGate()
    assert (gate.delta, gate.n_confirm) == (DELTA_HYST, N_CONFIRM) == (0.15, 3)


def test_first_frame_sets_the_active_cluster_without_a_switch():
    gate = HysteresisGate()
    assert gate.step(B) == 1
    assert gate.switches == 0


def test_boundary_oscillation_inside_the_margin_never_switches():
    gate = HysteresisGate()
    gate.step([0.55, 0.45])
    for i in range(100):
        gate.step([0.45, 0.55] if i % 2 == 0 else [0.55, 0.45])
        gate.step([0.44, 0.56])  # leads by 0.12 < 0.15, even three frames running
    assert gate.active == 0
    assert gate.switches == 0


def test_oscillation_beyond_the_margin_never_confirms():
    gate = HysteresisGate()
    gate.step(A)
    for i in range(100):
        gate.step(B if i % 3 != 2 else A)  # B leads twice, then A breaks the run
    assert gate.active == 0
    assert gate.switches == 0


def test_three_confirmations_switch_exactly_once():
    gate = HysteresisGate()
    gate.step(A)
    assert gate.step(B) == 0
    assert gate.step(B) == 0
    assert gate.step(B) == 1
    assert gate.switches == 1
    for _ in range(10):
        gate.step(B)
    assert gate.switches == 1


def test_a_different_challenger_restarts_the_count():
    gate = HysteresisGate()
    gate.step([0.9, 0.05, 0.05])
    gate.step([0.1, 0.8, 0.1])
    gate.step([0.1, 0.8, 0.1])
    gate.step([0.1, 0.1, 0.8])  # cluster 2 now leads: count restarts at 1
    assert gate.active == 0
    gate.step([0.1, 0.1, 0.8])
    assert gate.step([0.1, 0.1, 0.8]) == 2
    assert gate.switches == 1


def test_state_round_trips_through_a_dict():
    gate = HysteresisGate()
    gate.step(A)
    gate.step(B)
    gate.step(B)
    restored = HysteresisGate(**dataclasses.asdict(gate))
    assert restored.step(B) == 1


def test_a_shorter_posterior_resets_the_gate():
    gate = HysteresisGate()
    gate.step([0.1, 0.1, 0.8])
    assert gate.step(A) == 0  # cluster 2 no longer exists: adopt the leader
    assert gate.switches == 0


@pytest.mark.parametrize("bad", [[], [[0.5, 0.5]], [float("nan"), 1.0]])
def test_bad_frames_are_rejected(bad):
    with pytest.raises(ValueError):
        HysteresisGate().step(bad)
