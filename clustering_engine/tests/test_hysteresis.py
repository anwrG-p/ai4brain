"""Unit tests for Schmitt-Trigger Hysteresis Gate with Dwell-Time Filter."""

import pytest
from clustering_engine.hysteresis_gate import SchmittTriggerHysteresisGate


class TestSchmittTriggerHysteresisGate:
    """Test suite verifying anti-chattering and dwell-time hysteresis switching."""

    @pytest.fixture
    def gate(self) -> SchmittTriggerHysteresisGate:
        return SchmittTriggerHysteresisGate(delta_hyst=0.15, n_confirm=3)

    def test_initial_assignment_no_transition(self, gate: SchmittTriggerHysteresisGate):
        """First observation sets active cluster and does not trigger a transition."""
        resp = {1: 0.60, 2: 0.20, 4: 0.20}
        decision = gate.process("usr_test", resp)

        assert decision.active_cluster_id == 1
        assert not decision.has_transitioned
        assert decision.from_cluster is None
        assert decision.to_cluster is None

    def test_anti_chattering_small_margin_does_not_switch(self, gate: SchmittTriggerHysteresisGate):
        """Oscillating between clusters with margin < delta_hyst (0.15) must not trigger a switch."""
        gate.process("usr_test", {1: 0.50, 4: 0.20})  # active is 1

        # Simulate 10 frames of fluctuating noise where cluster 4 is slightly higher but margin < 0.15
        for _ in range(10):
            decision = gate.process("usr_test", {1: 0.42, 4: 0.48})  # margin = 0.06 < 0.15
            assert not decision.has_transitioned
            assert decision.active_cluster_id == 1
            assert decision.candidate_streak == 0

    def test_dwell_time_requires_three_consecutive_frames(self, gate: SchmittTriggerHysteresisGate):
        """Candidate with margin > 0.15 must be sustained for 3 consecutive frames."""
        gate.process("usr_test", {1: 0.70, 4: 0.10})  # active = 1

        strong_resp = {1: 0.20, 4: 0.75}  # margin = 0.55 > 0.15

        # Frame 1: Candidate detected, streak = 1
        f1 = gate.process("usr_test", strong_resp)
        assert not f1.has_transitioned
        assert f1.active_cluster_id == 1
        assert f1.candidate_cluster_id == 4
        assert f1.candidate_streak == 1

        # Frame 2: Candidate sustained, streak = 2
        f2 = gate.process("usr_test", strong_resp)
        assert not f2.has_transitioned
        assert f2.active_cluster_id == 1
        assert f2.candidate_cluster_id == 4
        assert f2.candidate_streak == 2

        # Frame 3: 3rd consecutive frame -> cluster jump triggers!
        f3 = gate.process("usr_test", strong_resp)
        assert f3.has_transitioned
        assert f3.active_cluster_id == 4
        assert f3.from_cluster == 1
        assert f3.to_cluster == 4
        assert f3.confidence_margin == pytest.approx(0.55, abs=0.01)
        assert f3.candidate_streak == 0

        # Frame 4: Steady state in new cluster 4
        f4 = gate.process("usr_test", strong_resp)
        assert not f4.has_transitioned
        assert f4.active_cluster_id == 4

    def test_interrupted_dwell_resets_counter(self, gate: SchmittTriggerHysteresisGate):
        """If a candidate's streak is interrupted before N_confirm, counter resets to 0."""
        gate.process("usr_test", {1: 0.80, 4: 0.10})  # active = 1

        # Frame 1 & 2 toward cluster 4
        gate.process("usr_test", {1: 0.20, 4: 0.70})  # streak = 1
        gate.process("usr_test", {1: 0.20, 4: 0.70})  # streak = 2

        # Frame 3 drops below margin or returns to active cluster
        interruption = gate.process("usr_test", {1: 0.50, 4: 0.40})
        assert not interruption.has_transitioned
        assert interruption.active_cluster_id == 1
        assert interruption.candidate_streak == 0

        # Next frame with cluster 4 must start counting from 1 again
        next_frame = gate.process("usr_test", {1: 0.20, 4: 0.70})
        assert not next_frame.has_transitioned
        assert next_frame.candidate_streak == 1

    def test_string_keys_c1_to_c9(self, gate: SchmittTriggerHysteresisGate):
        """Accepts 'C1'..'C9' string keys cleanly."""
        resp = {"C1": 0.10, "C4": 0.85}
        d1 = gate.process("usr_test", resp)
        assert d1.active_cluster_id == 4
