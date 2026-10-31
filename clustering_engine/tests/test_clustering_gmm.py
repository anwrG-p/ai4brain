"""BE-09: GMM practice profiles (clustering_engine/clustering_gmm.py)."""

import re

import numpy as np
import pytest

from ai_coach.safety_guardrails import lint_text
from clustering_engine.clustering_gmm import (
    ARCHETYPE_NAMES,
    PILLARS,
    ClusterModel,
    archetype_name,
    fit_gmm,
    posteriors,
)
from clustering_engine.fit import fit_synthetic, main, synthetic_pillars
from clustering_engine.pillar_adapter import session_pillars


@pytest.fixture(scope="module")
def blobs():
    rng = np.random.default_rng(0)
    centers = rng.uniform(20, 90, size=(9, 5))
    return np.vstack([c + rng.normal(0, 2, size=(30, 5)) for c in centers])


@pytest.fixture(scope="module")
def model(blobs):
    return fit_gmm(blobs)


def test_posteriors_sum_to_one_single_and_batch(model, blobs):
    batch = posteriors(blobs, model)
    assert batch.shape == (len(blobs), 9)
    assert np.allclose(batch.sum(axis=1), 1.0)
    assert (batch >= 0).all()
    one = model.posteriors(blobs[0])
    assert one.shape == (9,)
    assert one.sum() == pytest.approx(1.0)
    # Far outside the data, still a distribution.
    assert model.posteriors(np.full(5, 1e4)).sum() == pytest.approx(1.0)


def test_posteriors_reject_the_wrong_width(model):
    with pytest.raises(ValueError):
        model.posteriors(np.zeros(4))


def test_k_defaults_to_nine_and_is_selectable(blobs):
    assert fit_gmm(blobs).k == 9
    m3 = fit_gmm(blobs, k=3)
    assert m3.k == 3 and m3.k_requested == 3
    assert len(set(m3.archetype_ids)) == 3
    m12 = fit_gmm(blobs, k=12)
    assert m12.k == 12
    assert sorted(m12.archetype_ids) == list(range(12))
    assert [m12.name(i) for i in range(9, 12)] == ["Profile 10", "Profile 11", "Profile 12"]


def test_deterministic_given_a_seed(blobs):
    a, b = fit_gmm(blobs, seed=3), fit_gmm(blobs, seed=3)
    assert a.to_dict() == b.to_dict()


@pytest.mark.parametrize("n", [1, 2, 4, 8])
def test_fewer_rows_than_k_degrade_to_one_component_per_row(n):
    X = np.random.default_rng(n).uniform(0, 100, size=(n, 5))
    m = fit_gmm(X, k=9)
    assert m.k == n and m.k_requested == 9
    gamma = m.posteriors(X)
    assert gamma.shape == (n, n)
    assert np.allclose(gamma.sum(axis=1), 1.0)
    assert len(set(m.archetype_ids)) == n


def test_duplicate_rows_count_once():
    X = np.array([[50.0] * 5] * 6 + [[70.0] * 5] * 6)
    m = fit_gmm(X, k=9)
    assert m.k == 2
    assert np.allclose(m.posteriors(X).sum(axis=1), 1.0)


def test_session_pillars_adapter_scores_and_skips_incomplete_sessions():
    def ev(sid, schema, score):
        return {"user_id": "u", "session_id": sid, "task_id": f"syn-{schema}-000-0", "score_norm": score}

    full = [ev("s1", s, 1.0) for s in ("nback", "stroop", "mst", "ufov")] + [ev("s1", "rotation", 0.0)]
    full += [ev("s1", "ufov", 0.0)]  # visual: mean of 1 and 0
    partial = [ev("s2", "nback", 1.0)]  # no memory, impulse or visual: skipped, not imputed
    keys, X = session_pillars(full + partial)
    assert keys == [("u", "s1")]
    assert X.tolist() == [[100.0, 100.0, 100.0, 100.0, 50.0]]
    assert session_pillars([])[1].shape == (0, 5)


@pytest.mark.parametrize("bad",[np.zeros((0, 5)), np.zeros(5), np.array([[np.nan] * 5])])
def test_bad_input_is_rejected(bad):
    with pytest.raises(ValueError):
        fit_gmm(bad)


def test_any_latent_width_works_unnamed_or_named_by_pillars(blobs):
    rng = np.random.default_rng(1)
    latent = blobs @ rng.normal(size=(5, 8))  # [n, 8], e.g. BE-10's latent
    unnamed = fit_gmm(latent)
    assert unnamed.archetype_ids is None
    assert [unnamed.name(i) for i in range(3)] == ["Profile 1", "Profile 2", "Profile 3"]
    assert np.allclose(unnamed.posteriors(latent).sum(axis=1), 1.0)
    named = fit_gmm(latent, pillars=blobs)
    assert sorted(named.archetype_ids) == list(range(9))
    assert named.means.shape == (9, 8)


def test_save_and_load_give_the_same_posteriors(model, blobs, tmp_path):
    path = model.save(tmp_path / "gmm.json")
    loaded = ClusterModel.load(path)
    assert np.allclose(loaded.posteriors(blobs), model.posteriors(blobs))
    assert [loaded.name(i) for i in range(9)] == [model.name(i) for i in range(9)]
    assert np.allclose(loaded.means, model.means)


def test_components_are_named_after_their_leading_pillar():
    # One cluster per single-pillar prototype, plus a high, a low and a middle one.
    rng = np.random.default_rng(5)
    base = np.full(5, 60.0)
    centers = [base + 25 * np.eye(5)[i] for i in range(5)] + [base + 20, base - 30, base]
    centers.append(base + 25 * (np.eye(5)[0] + np.eye(5)[2]))
    X = np.vstack([c + rng.normal(0, 1.5, size=(40, 5)) for c in centers])
    m = fit_gmm(X)
    for i in range(m.k):
        mu = m.means[i]
        name = m.name(i)
        if name == "Quick spotter":
            assert np.argmax(mu - base) == PILLARS.index("visual")
        if name == "Keen recaller":
            assert np.argmax(mu - base) == PILLARS.index("memory")
        if name == "Fresh starter":
            assert (mu < base).all()
        if name == "All-rounder":
            assert (mu > base).all()


# --- names: plain consumer words, never clinical or emotional -----------------------------------

EMOTION_WORDS = re.compile(
    r"\b(?:calm|happy|sad|anxious|stressed|angry|mood|emotional|tired|nervous|relaxed|worried|"
    r"depressed|upset|fear\w*|frustrat\w*|lonely|joy\w*)\b",
    re.IGNORECASE,
)


@pytest.mark.parametrize("k", range(12))
def test_archetype_names_pass_the_banned_terms_list(k):
    name = archetype_name(k)
    assert lint_text(name) == [], name
    assert not EMOTION_WORDS.search(name), name
    assert re.fullmatch(r"[A-Z][A-Za-z -]+(?: \d+)?", name), name


def test_archetype_names_are_nine_distinct_names():
    assert len(ARCHETYPE_NAMES) == 9 == len(set(ARCHETYPE_NAMES))
    assert archetype_name(0) == "Steady planner"
    assert archetype_name(4) == "Quick spotter"
    with pytest.raises(ValueError):
        archetype_name(-1)


# --- golden fit on fixed synthetic data -----------------------------------------------------------

GOLDEN_WEIGHTS = [0.2144, 0.0493, 0.1346, 0.1102, 0.1001, 0.1236, 0.0833, 0.0333, 0.1512]
GOLDEN_MEANS = [
    [81.04, 89.27, 80.74, 91.35, 76.04],
    [69.73, 89.82, 68.62, 47.05, 66.64],
    [69.58, 88.83, 75.4, 73.82, 72.57],
    [55.36, 86.86, 68.69, 88.67, 75.91],
    [49.12, 76.15, 60.82, 63.22, 70.82],
    [89.84, 95.68, 94.71, 100.0, 76.17],
    [27.47, 37.1, 11.17, 30.0, 3.75],
    [44.84, 73.02, 41.15, 39.58, 68.75],
    [84.56, 90.16, 98.56, 89.9, 77.83],
]


def test_golden_fit_on_fixed_synthetic_data():
    _, X = synthetic_pillars(users=40, sessions=3, data_seed=7)
    assert X.shape == (120, 5)
    m = fit_synthetic(users=40, sessions=3, data_seed=7, k=9, seed=0)
    assert m.archetype_ids == list(range(9))
    assert [m.name(i) for i in range(9)] == list(ARCHETYPE_NAMES)
    assert m.weights == pytest.approx(GOLDEN_WEIGHTS, abs=1e-3)
    assert m.means == pytest.approx(np.array(GOLDEN_MEANS), abs=0.05)


def test_fit_script_writes_a_loadable_model(tmp_path, capsys):
    out = tmp_path / "clustering" / "gmm.json"
    assert main(["--users", "10", "--sessions", "2", "--k", "4", "--out", str(out)]) == 0
    m = ClusterModel.load(out)
    assert m.k == 4 and m.features == list(PILLARS)
    assert "k=4" in capsys.readouterr().out
