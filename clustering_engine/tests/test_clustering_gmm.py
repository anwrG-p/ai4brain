"""BE-09: GMM practice profiles (clustering_engine/clustering_gmm.py)."""

import json
import re
from pathlib import Path

import numpy as np
import pytest
import sklearn

from ai_coach.safety_guardrails import lint_text
from clustering_engine.clustering_gmm import (
    ARCHETYPE_NAMES,
    FALLBACK_NAME,
    PILLARS,
    ClusterModel,
    _archetype_name,
    fit_gmm,
    posteriors,
)
from clustering_engine.fit import fit_synthetic, main, synthetic_pillars
from clustering_engine.pillar_adapter import session_pillars


def assert_well_named(m: ClusterModel) -> list[int]:
    """Named components first, by distinct archetype id; the rest are FALLBACK_NAME. Returns the
    named ids."""
    ids = m.archetype_ids
    assert ids is not None and len(ids) == m.k
    named = [i for i in ids if i is not None]
    assert ids[: len(named)] == named == sorted(set(named))
    assert all(0 <= i < len(ARCHETYPE_NAMES) for i in named)
    assert [m.name(c) for c in range(m.k)] == [ARCHETYPE_NAMES[i] for i in named] + [FALLBACK_NAME] * (m.k - len(named))
    return named


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
    assert len(assert_well_named(m3)) >= 1  # distinct ids, at least one named
    m12 = fit_gmm(blobs, k=12)
    assert m12.k == 12
    # At most nine components carry an archetype name; the rest are mixed profiles, last.
    assert 1 <= len(assert_well_named(m12)) <= 9
    assert m12.archetype_ids[-3:] == [None, None, None]
    assert [m12.name(i) for i in range(9, 12)] == [FALLBACK_NAME] * 3


def test_features_must_name_every_column(blobs):
    assert fit_gmm(blobs, features=list("abcde")).features == list("abcde")
    with pytest.raises(ValueError):
        fit_gmm(blobs, features=["focus", "agility"])


@pytest.mark.parametrize("empty", [None, []])
def test_no_feature_names_mean_pillars_at_width_five_in_fit_and_load(blobs, empty):
    m = fit_gmm(blobs, features=empty)
    assert m.features == list(PILLARS)
    saved = m.to_dict()
    saved.pop("model_id")
    assert ClusterModel.from_dict({**saved, "features": []}).features == list(PILLARS)
    latent = np.hstack([blobs, blobs[:, :1]])  # d = 6: no default names
    m6 = fit_gmm(latent, features=empty)
    assert m6.features == []
    assert ClusterModel.from_dict(m6.to_dict()).features == []


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
    assert_well_named(m)


def test_a_single_row_is_a_balanced_builder():
    # One row is exactly everyone's mean: a zero profile, the balanced prototype.
    m = fit_gmm(np.array([[40.0, 55.0, 60.0, 70.0, 35.0]]))
    assert m.k == 1
    assert m.name(0) == "Balanced builder"


def test_duplicate_rows_count_once():
    X = np.array([[50.0] * 5] * 6 + [[70.0] * 5] * 6)
    m = fit_gmm(X, k=9)
    assert m.k == 2
    assert np.allclose(m.posteriors(X).sum(axis=1), 1.0)
    # Two rows, all-low and all-high: named by shape even with n < K.
    assert_well_named(m)
    low = int(np.argmin(m.means[:, 0]))
    assert (m.name(low), m.name(1 - low)) == ("Fresh starter", "All-rounder")


def test_session_pillars_are_be07_scores_and_skip_incomplete_sessions():
    """The rows are BE-07's pillar scores (held to the TS by the golden vectors), duplicates once."""
    golden = json.loads((Path(__file__).resolve().parents[2] / "data" / "fixtures" / "golden_sessions.json").read_text(encoding="utf-8"))
    cases = {c["name"]: c for c in golden["cases"]}
    full = cases["full_session_new_exercises"]
    dup = cases["duplicates"]  # 191 rows, 159 unique: scored once each
    partial = cases["stroop"]  # agility and impulse only: skipped, not imputed

    def as_user(case, user, session):
        return [{**e, "user_id": user, "session_id": session} for e in case["events"]]

    events = as_user(partial, "u1", "s0") + as_user(full, "u1", "s1") + as_user(dup, "u2", "s1")
    keys, X = session_pillars(events)
    assert keys == [("u1", "s1"), ("u2", "s1")]
    for row, case in zip(X, (full, dup)):
        assert row.tolist() == pytest.approx([case["expected"]["pillars"][p]["score"] for p in PILLARS], abs=1e-6)
    assert session_pillars([])[1].shape == (0, 5)


@pytest.mark.parametrize("bad", [np.zeros((0, 5)), np.zeros(5), np.array([[np.nan] * 5])])
def test_bad_input_is_rejected(bad):
    with pytest.raises(ValueError):
        fit_gmm(bad)


def test_any_latent_width_works_unnamed_or_named_by_pillars(blobs):
    rng = np.random.default_rng(1)
    latent = blobs @ rng.normal(size=(5, 8))  # [n, 8], e.g. BE-10's latent
    unnamed = fit_gmm(latent)
    assert unnamed.archetype_ids is None
    assert [unnamed.name(i) for i in range(9)] == [FALLBACK_NAME] * 9
    assert np.allclose(unnamed.posteriors(latent).sum(axis=1), 1.0)
    named = fit_gmm(latent, pillars=blobs)
    assert len(assert_well_named(named)) >= 1
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
    assert m.name(odd) == FALLBACK_NAME


# --- loading validates every field ----------------------------------------------------------------


@pytest.fixture(scope="module")
def saved(model):
    return model.to_dict()


def _broken(d, **changes):
    out = {**d, **changes}
    out.pop("model_id")  # so each case fails on its own field, not on the hash
    return out


def _set_diag(chol, value):
    """A copy of full-covariance Cholesky factors with one diagonal entry set to `value`."""
    out = np.array(chol)
    out[0, 2, 2] = value
    return out.tolist()


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
    "precisions diagonal zero": lambda d: _broken(d, precisions_cholesky=_set_diag(d["precisions_cholesky"], 0.0)),
    "precisions diagonal negative": lambda d: _broken(d, precisions_cholesky=_set_diag(d["precisions_cholesky"], -1.0)),
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


@pytest.mark.parametrize("covariance_type", ["tied", "diag", "spherical"])
def test_non_positive_precision_diagonals_are_rejected_for_every_covariance_type(blobs, covariance_type):
    d = fit_gmm(blobs, covariance_type=covariance_type).to_dict()
    assert ClusterModel.from_dict(d).k == 9  # the untouched model loads
    chol = np.array(d["precisions_cholesky"])
    chol[(1,) * chol.ndim] = 0.0  # a diagonal entry: [1, 1] tied, [1, 1] diag, [1] spherical
    with pytest.raises(ValueError, match="positive diagonal"):
        ClusterModel.from_dict(_broken(d, precisions_cholesky=chol.tolist()))


def test_well_formed_variants_still_load(saved):
    assert ClusterModel.from_dict(_broken(saved, archetype_ids=None)).name(0) == FALLBACK_NAME
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


@pytest.mark.parametrize("name", list(ARCHETYPE_NAMES) + [FALLBACK_NAME])
def test_archetype_names_pass_the_banned_terms_list(name):
    assert lint_text(name) == [], name
    assert not EMOTION_WORDS.search(name), name
    assert re.fullmatch(r"[A-Z][a-z]+(?:[ -][A-Za-z]+)*", name), name  # words only, no index


def test_archetype_names_are_nine_distinct_names():
    assert len(ARCHETYPE_NAMES) == 9 == len(set(ARCHETYPE_NAMES))
    assert FALLBACK_NAME not in ARCHETYPE_NAMES
    assert [_archetype_name(k) for k in range(9)] == list(ARCHETYPE_NAMES)
    assert _archetype_name(4) == "Quick spotter"
    for bad in (-1, 9):
        with pytest.raises(ValueError):
            _archetype_name(bad)


# --- golden fit on fixed synthetic data -----------------------------------------------------------

# Refit by SRV-1 on BE-07's pillar scores of BE-08's data with all 11 exercises and R16 n-back.
GOLDEN_IDS = [1, 2, 5, 6, None, None, None, None, None]
GOLDEN_WEIGHTS = [0.1242, 0.1304, 0.1829, 0.0833, 0.1538, 0.1334, 0.1004, 0.05, 0.0417]
GOLDEN_MEANS = [
    [36.8, 81.64, 56.81, 66.96, 76.39],
    [47.88, 66.28, 74.87, 53.85, 74.93],
    [66.72, 81.3, 76.33, 76.45, 78.96],
    [7.34, 5.13, 5.26, 9.63, 5.62],
    [71.6, 42.53, 77.2, 79.14, 82.24],
    [29.73, 49.91, 46.25, 24.36, 75.13],
    [55.63, 40.62, 69.71, 23.66, 70.93],
    [12.38, 28.09, 40.71, 23.58, 61.12],
    [25.99, 27.36, 56.36, 75.6, 76.25],
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
        "Nimble switcher", "Careful checker", "All-rounder", "Fresh starter",
        FALLBACK_NAME, FALLBACK_NAME, FALLBACK_NAME, FALLBACK_NAME, FALLBACK_NAME,
    ]
    assert m.weights == pytest.approx(GOLDEN_WEIGHTS, abs=1e-3)
    assert m.means == pytest.approx(np.array(GOLDEN_MEANS), abs=0.05)


def test_fit_script_writes_a_loadable_model(tmp_path, capsys):
    out = tmp_path / "clustering" / "gmm.json"
    assert main(["--users", "10", "--sessions", "2", "--k", "4", "--out", str(out)]) == 0
    m = ClusterModel.load(out)
    assert m.k == 4 and m.features == list(PILLARS)
    assert "k=4" in capsys.readouterr().out
