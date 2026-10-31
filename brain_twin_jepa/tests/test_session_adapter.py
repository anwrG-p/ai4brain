"""The local feature adapter (stand-in for BE-07): sessions from events, and the JSONL path."""

from data.synthetic.generate import generate, simulate_user

from brain_twin_jepa.session_adapter import PILLARS, read_jsonl_dir, sessions


def test_sessions_are_ordered_and_scored():
    events, truth = simulate_user(0, 3, 4)
    recs = sessions(events[::-1])  # order of events does not matter
    assert [r.session_id for r in recs] == [s["session_id"] for s in truth["sessions"]]
    assert all(a.started_at < b.started_at for a, b in zip(recs, recs[1:], strict=False))
    for r in recs:
        assert all(0 <= r.pillars[p] <= 100 for p in PILLARS)
        # Every exercise played: the doc weights this subset can fill (no switch cost, no error
        # recovery, no DDM caution, no paired associates).
        assert r.coverage == {"focus": 1.0, "agility": 0.4, "impulse": 0.8, "memory": 0.55, "visual": 1.0}


def test_no_events_for_a_pillar_means_no_score():
    events, _ = simulate_user(0, 0, 1)
    no_mst = [e for e in events if "kind" not in e["trial_meta"]]
    (r,) = sessions(no_mst)
    assert r.pillars["memory"] is None and r.coverage["memory"] == 0


def test_generator_files_read_back_as_the_same_sessions(tmp_path):
    generate(2, 3, 11, tmp_path)
    by_user = read_jsonl_dir(tmp_path)
    assert len(by_user) == 2  # _truth/ is not read
    for i, (uid, events) in enumerate(sorted(by_user.items())):
        assert sessions(events) == sessions(simulate_user(11, i, 3)[0])
