"""BE-09: GMM practice profiles (clustering_engine/clustering_gmm.py)."""

import re
from pathlib import Path

import numpy as np
import pytest
import sklearn

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
    m12 = fit_gmm(blobs, k=12)
    assert m12.k == 12
    # At most nine components carry an archetype name; the rest are numbered profiles, last.
    named = [i for i in m12.archetype_ids if i is not None]
    assert len(named) <= 9 and len(set(named)) == len(named)
    assert m12.archetype_ids[-3:] == [None, None, None]
    assert [m12.name(i) for i in range(9, 12)] == ["Profile 10", "Profile 11", "Profile 12"]


def test_features_must_name_every_column(blobs):
    assert fit_gmm(blobs, features=list("abcde")).features == list("abcde")
    with pytest.raises(ValueError):
        fit_gmm(blobs, features=["focus", "agility"])


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
    assert len(m.archetype_ids) == n


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
    assert named.archetype_ids is not None and len(named.archetype_ids) == 9
    assert named.means.shape == (9, 8)


def test_save_and_load_give_the_same_posteriors(model, blobs, tmp_path):
    path = model.save(tmp_path / "gmm.json")
    loaded = ClusterModel.load(path)
    assert np.allclose(loaded.posteriors(blobs), model.posteriors(blobs))
    assert [loaded.name(i) for i in range(9)] == [model.name(i) for i in range(9)]
    assert np.allclose(loaded.means, model.means)
    assert loaded.model_id == model.model_id


# Centroids planted at 60 + 12 x each prototype (in PILLARS order), named in archetype-id order.
PLANTED = {
    "Steady planner": [72, 60, 60, 60, 60],
    "Nimble switcher": [60, 72, 60, 60, 60],
    "Careful checker": [60, 60, 72, 60, 60],
    "Keen recaller": [60, 60, 60, 72, 60],
    "Quick spotter": [60, 60, 60, 60, 72],
    "All-rounder": [69, 69, 69, 69, 69],
    "Fresh starter": [51, 51, 51, 51, 51],
    "Balanced builder": [60, 60, 60, 60, 60],
    "Methodical solver": [68.4, 60, 68.4, 60, 60],
}


def test_each_planted_profile_gets_its_own_name():
    rng = np.random.default_rng(5)
    X = np.vstack([np.array(c) + rng.normal(0, 1.0, size=(40, 5)) for c in PLANTED.values()])
    m = fit_gmm(X)
    assert [m.name(i) for i in range(m.k)] == list(PLANTED)
    for i, center in enumerate(PLANTED.values()):
        assert m.means[i] == pytest.approx(center, abs=0.5)


def test_a_profile_far_from_every_prototype_stays_unnamed():
    # Alternating highs and lows: no prototype has that shape.
    rng = np.random.default_rng(2)
    planted = [[60] * 5, [75, 45, 75, 45, 75]]
    X = np.vstack([np.array(c, dtype=float) + rng.normal(0, 1.0, size=(40, 5)) for c in planted])
    m = fit_gmm(X, k=2)
    odd = int(np.argmax(m.means[:, 0]))
    assert m.archetype_ids[odd] is None
    assert m.name(odd) == f"Profile {odd + 1}"


# --- loading validates every field ----------------------------------------------------------------


@pytest.fixture(scope="module")
def saved(model):
    return model.to_dict()


def _broken(d, **changes):
    out = {**d, **changes}
    out.pop("model_id")  # so each case fails on its own field, not on the hash
    return out


MALFORMED = {
    "not a dict": lambda d: [d],
    "missing field": lambda d: {k: v for k, v in _broken(d).items() if k != "scale"},
    "covariance_type": lambda d: _broken(d, covariance_type="banana"),
    "k not int": lambda d: _broken(d, k="9"),
    "k vs means": lambda d: _broken(d, k=8),
    "means ragged": lambda d: _broken(d, means=[row[:4] for row in d["means"][:-1]] + [d["means"][-1]]),
    "means not numeric": lambda d: _broken(d, means=[["x"] * 5] * 9),
    "center length": lambda d: _broken(d, center=d["center"][:4]),
    "scale length": lambda d: _broken(d, scale=d["scale"] + [1.0]),
    "scale zero": lambda d: _broken(d, scale=[0.0] + d["scale"][1:]),
    "scale negative": lambda d: _broken(d, scale=[-1.0] + d["scale"][1:]),
    "weights length": lambda d: _broken(d, weights=d["weights"][:-1]),
    "weights sum": lambda d: _broken(d, weights=[w * 2 for w in d["weights"]]),
    "weights negative": lambda d: _broken(d, weights=[-0.1, 0.1 + d["weights"][0]] + d["weights"][2:]),
    "weights nan": lambda d: _broken(d, weights=[float("nan")] + d["weights"][1:]),
    "covariances shape": lambda d: _broken(d, covariances=d["covariances"][:-1]),
    "precisions shape": lambda d: _broken(d, precisions_cholesky=[np.diag(np.array(c)).tolist() for c in d["precisions_cholesky"]]),
    "precisions for another type": lambda d: _broken(d, covariance_type="diag"),
    "archetype_ids length": lambda d: _broken(d, archetype_ids=d["archetype_ids"][:-1]),
    "archetype_ids duplicate": lambda d: _broken(d, archetype_ids=[0] * 9),
    "archetype_ids out of range": lambda d: _broken(d, archetype_ids=list(range(1, 10))),
    "archetype_ids not a list": lambda d: _broken(d, archetype_ids="0"),
    "features length": lambda d: _broken(d, features=["focus"]),
    "features not strings": lambda d: _broken(d, features=[1, 2, 3, 4, 5]),
    "k_requested": lambda d: _broken(d, k_requested=0),
    "seed": lambda d: _broken(d, seed=-1),
    "model_id": lambda d: {**d, "model_id": "0" * 16},
}


@pytest.mark.parametrize("case", list(MALFORMED))
def test_malformed_models_are_rejected(saved, case):
    with pytest.raises(ValueError):
        ClusterModel.from_dict(MALFORMED[case](saved))


def test_well_formed_variants_still_load(saved):
    assert ClusterModel.from_dict(_broken(saved, archetype_ids=None)).name(0) == "Profile 1"
    assert ClusterModel.from_dict(_broken(saved, features=[])).features == []
    assert ClusterModel.from_dict(_broken(saved)).k == 9  # model_id is optional


def test_other_library_versions_warn_on_load(saved):
    with pytest.warns(UserWarning, match="saved with"):
        ClusterModel.from_dict({**saved, "versions": {**saved["versions"], "scikit-learn": "0.0"}})


def test_model_id_tracks_the_fitted_parameters(blobs, model):
    assert model.model_id == fit_gmm(blobs).model_id
    assert model.model_id != fit_gmm(blobs, k=8).model_id
    assert re.fullmatch(r"[0-9a-f]{16}", model.model_id)


# --- names: plain consumer words, never clinical or emotional -----------------------------------

EMOTION_WORDS = re.compile(
    r"\b(?:calm|happy|sad|anxious|stressed|angry|mood|emotional|tired|nervous|relaxed|worried|"
    r"depressed|upset|fear\w*|frustrat\w*|lonely|joy\w*)\b",
    re.IGNORECASE,
)


@pytest.mark.parametrize("name", list(ARCHETYPE_NAMES) + ["Profile 1", "Profile 12"])
def test_archetype_names_pass_the_banned_terms_list(name):
    assert lint_text(name) == [], name
    assert not EMOTION_WORDS.search(name), name
    assert re.fullmatch(r"[A-Z][A-Za-z -]+(?: \d+)?", name), name


def test_archetype_names_are_nine_distinct_names():
    assert len(ARCHETYPE_NAMES) == 9 == len(set(ARCHETYPE_NAMES))
    assert [archetype_name(k) for k in range(9)] == list(ARCHETYPE_NAMES)
    assert archetype_name(4) == "Quick spotter"
    for bad in (-1, 9):
        with pytest.raises(ValueError):
            archetype_name(bad)


# --- golden fit on fixed synthetic data -----------------------------------------------------------

GOLDEN_IDS = [0, 3, 5, 6, 7, 8, None, None, None]
GOLDEN_WEIGHTS = [0.2144, 0.1102, 0.1236, 0.0833, 0.1346, 0.1512, 0.1001, 0.0493, 0.0333]
GOLDEN_MEANS = [
    [81.04, 89.27, 80.74, 91.35, 76.04],
    [55.36, 86.86, 68.69, 88.67, 75.91],
    [89.84, 95.68, 94.71, 100.0, 76.17],
    [27.47, 37.1, 11.17, 30.0, 3.75],
    [69.58, 88.83, 75.4, 73.82, 72.57],
    [84.56, 90.16, 98.56, 89.9, 77.83],
    [49.12, 76.15, 60.82, 63.22, 70.82],
    [69.73, 89.82, 68.62, 47.05, 66.64],
    [44.84, 73.02, 41.15, 39.58, 68.75],
]


def _pinned(package: str) -> str:
    text = (Path(__file__).resolve().parents[1] / "requirements.txt").read_text(encoding="utf-8")
    return re.search(rf"^{re.escape(package)}==(\S+)", text, re.MULTILINE).group(1)


def test_golden_fit_on_fixed_synthetic_data():
    # The golden numbers belong to the pinned scikit-learn; a version bump must refresh them.
    assert sklearn.__version__ == _pinned("scikit-learn")
    _, X = synthetic_pillars(users=40, sessions=3, data_seed=7)
    assert X.shape == (120, 5)
    m = fit_synthetic(users=40, sessions=3, data_seed=7, k=9, seed=0)
    assert m.archetype_ids == GOLDEN_IDS
    assert [m.name(i) for i in range(9)] == [
        "Steady planner", "Keen recaller", "All-rounder", "Fresh starter", "Balanced builder",
        "Methodical solver", "Profile 7", "Profile 8", "Profile 9",
    ]
    assert m.weights == pytest.approx(GOLDEN_WEIGHTS, abs=1e-3)
    assert m.means == pytest.approx(np.array(GOLDEN_MEANS), abs=0.05)


def test_fit_script_writes_a_loadable_model(tmp_path, capsys):
    out = tmp_path / "clustering" / "gmm.json"
    assert main(["--users", "10", "--sessions", "2", "--k", "4", "--out", str(out)]) == 0
    m = ClusterModel.load(out)
    assert m.k == 4 and m.features == list(PILLARS)
    assert "k=4" in capsys.readouterr().out
