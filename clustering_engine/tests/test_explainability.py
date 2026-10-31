"""BE-09: delta_c = W_eval (mu_target - mu_active), keyed by pillar."""

import numpy as np
import pytest

from clustering_engine.clustering_gmm import PILLARS, fit_gmm
from clustering_engine.explainability import delta_c


@pytest.fixture(scope="module")
def two_clusters():
    """Two tight clusters at known centroids; each is symmetric around its centroid, so the
    fitted means are the centroids."""
    active = np.array([50.0, 60.0, 40.0, 70.0, 55.0])
    target = np.array([62.0, 60.0, 31.0, 80.0, 75.0])
    offsets = np.vstack([np.eye(5), -np.eye(5)]) * 0.5
    X = np.vstack([active + offsets, target + offsets])
    return fit_gmm(X, k=2, seed=0), active, target


def test_two_cluster_toy_identity_by_hand(two_clusters):
    model, active, target = two_clusters
    gamma = model.posteriors(np.vstack([active, target]))
    ia, it = int(np.argmax(gamma[0])), int(np.argmax(gamma[1]))
    assert ia != it
    assert np.allclose(model.means[ia], active) and np.allclose(model.means[it], target)
    d = delta_c(model.means[it], model.means[ia])
    # target - active, by hand: 62-50, 60-60, 31-40, 80-70, 75-55
    expected = {"focus": 12.0, "agility": 0.0, "impulse": -9.0, "memory": 10.0, "visual": 20.0}
    assert list(d) == list(PILLARS)
    assert d == pytest.approx(expected, abs=1e-6)


def test_two_cluster_toy_diagonal_weights_by_hand(two_clusters):
    model, active, target = two_clusters
    W = [0.5, 1.0, 2.0, 1.0, 0.25]
    d = delta_c(target, active, W)
    # 0.5*12, 1*0, 2*-9, 1*10, 0.25*20
    assert d == pytest.approx({"focus": 6.0, "agility": 0.0, "impulse": -18.0, "memory": 10.0, "visual": 5.0})


def test_latent_centroids_project_onto_pillars_by_hand():
    mu_active = np.array([1.0, 2.0])
    mu_target = np.array([3.0, 1.0])  # diff (2, -1)
    W = np.array([[1, 0], [0, 1], [1, 1], [2, 0], [0, -3]], dtype=float)
    d = delta_c(mu_target, mu_active, W)
    assert d == {"focus": 2.0, "agility": -1.0, "impulse": 1.0, "memory": 4.0, "visual": 3.0}


def test_same_centroid_gives_zero():
    mu = np.arange(5.0)
    assert delta_c(mu, mu) == {p: 0.0 for p in PILLARS}


@pytest.mark.parametrize(
    "target,active,W",
    [
        (np.zeros(5), np.zeros(4), None),  # shapes differ
        (np.zeros(3), np.zeros(3), None),  # identity needs one entry per pillar
        (np.zeros(5), np.zeros(5), np.ones(4)),  # diagonal of the wrong length
        (np.zeros(2), np.zeros(2), np.ones((5, 3))),  # projection of the wrong width
    ],
)
def test_bad_shapes_are_rejected(target, active, W):
    with pytest.raises(ValueError):
        delta_c(target, active, W)
