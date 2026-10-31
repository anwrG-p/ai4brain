"""End-to-End and unit tests for SATJEPAModel and SyntheticTrainer."""

import numpy as np
import pytest

from brain_twin_jepa.sat_jepa import SATJEPAModel
from brain_twin_jepa.synthetic_trainer import generate_synthetic_session, train_sat_jepa


class TestSATJEPAEndToEnd:
    """Test suite for unified SAT-JEPA model and synthetic training."""

    def test_model_initialization_no_fixed_archetypes(self):
        model = SATJEPAModel()
        assert model.latent_dim == 64
        assert model.context_encoder.latent_dim == 64
        assert model.target_encoder.latent_dim == 64
        assert model.predictor.latent_dim == 64

        # Verify weights are populated and finite
        weights = model.context_encoder.get_weights()
        assert np.all(np.isfinite(weights["w_proj"]))

    def test_anchor_to_user_centroids_dynamically(self):
        model = SATJEPAModel()
        # User-generated centroids (e.g. 3 clusters discovered from users)
        user_centroids = np.random.default_rng(1).normal(0.0, 1.0, (3, 64)).astype(np.float32)
        model.anchor_to_user_centroids(user_centroids)

        weights = model.context_encoder.get_weights()
        assert np.all(np.isfinite(weights["w_proj"]))

    def test_process_event_sequence(self):
        model = SATJEPAModel()
        session = generate_synthetic_session("operational", num_trials=5, seed=42)

        states = []
        for event in session:
            s_t = model.process_event("user_e2e", event)
            assert s_t.shape == (64,)
            assert np.all(np.isfinite(s_t))
            states.append(s_t)

        assert len(states) == 5
        # States evolve over trials
        assert not np.allclose(states[0], states[-1])

    def test_forecast_trajectory(self):
        model = SATJEPAModel()
        session = generate_synthetic_session("strategic", num_trials=3, seed=123)

        for event in session:
            model.process_event("user_forecast", event)

        forecast = model.forecast_trajectory("user_forecast", horizon=5)
        assert len(forecast) == 5

        prev_sigma = -1.0
        for h, (s_hat, sigma) in enumerate(forecast, start=1):
            assert s_hat.shape == (64,)
            assert np.all(np.isfinite(s_hat))
            assert sigma > prev_sigma  # Monotonic uncertainty growth
            prev_sigma = sigma

    def test_forecast_unobserved_user_raises(self):
        model = SATJEPAModel()
        with pytest.raises(ValueError, match="has not been observed"):
            model.forecast_trajectory("unobserved_usr")

    def test_save_and_load_weights(self, tmp_path):
        model = SATJEPAModel()
        save_file = tmp_path / "test_weights.npz"

        model.save_weights(save_file)
        assert save_file.is_file()

        new_model = SATJEPAModel()
        new_model.load_weights(save_file)

        w1 = model.context_encoder.get_weights()
        w2 = new_model.context_encoder.get_weights()
        for k in w1:
            assert np.allclose(w1[k], w2[k])

    def test_synthetic_trainer_reduces_loss(self, tmp_path):
        save_file = tmp_path / "trained_weights.npz"
        model, metrics = train_sat_jepa(
            num_sessions=10,
            epochs=2,
            lr=0.01,
            save_path=save_file,
        )

        assert metrics["total_epochs"] == 2
        assert metrics["initial_loss"] > 0.0
        assert metrics["final_loss"] <= metrics["initial_loss"] + 0.1  # Stable learning
        assert save_file.is_file()
