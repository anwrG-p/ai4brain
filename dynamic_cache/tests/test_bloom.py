"""TimedBloom: a served task id stays 'seen' for at least 14 days, at most 15, then expires."""

from __future__ import annotations

from dynamic_cache.bloom import DAY_S, TTL_DAYS, TimedBloom, day_of

HOUR = 3600
T0 = 1_790_000_000.0  # a fixed instant, so tests never depend on the wall clock


def test_seen_after_add_and_not_before():
    b = TimedBloom()
    assert not b.seen("stroop-1-abc", T0)
    b.add("stroop-1-abc", T0)
    assert b.seen("stroop-1-abc", T0)
    assert not b.seen("stroop-2-abc", T0)


def test_blocked_for_at_least_14_days_from_any_time_of_day():
    for offset in (0, 1, 12 * HOUR, DAY_S - 1):  # start, middle and last second of a UTC day
        served = day_of(T0) * DAY_S + offset
        b = TimedBloom()
        b.add("n_back-7-x", served)
        t = served
        while t < served + TTL_DAYS * DAY_S:
            assert b.seen("n_back-7-x", t), f"forgotten after {(t - served) / DAY_S:.2f} days"
            t += HOUR
        assert b.seen("n_back-7-x", served + TTL_DAYS * DAY_S - 1)
        # ...and never more than one day longer than the TTL.
        assert not b.seen("n_back-7-x", served + (TTL_DAYS + 1) * DAY_S + 1)


def test_expired_slices_are_dropped_on_add():
    b = TimedBloom()
    b.add("a", T0)
    b.add("b", T0 + 30 * DAY_S)
    assert list(b.slices) == [day_of(T0 + 30 * DAY_S)]


def test_json_round_trip_keeps_membership():
    b = TimedBloom()
    for k in range(50):
        b.add(f"mst-{k}-h", T0 + k * HOUR)
    back = TimedBloom.from_json(b.to_json())
    assert all(back.seen(f"mst-{k}-h", T0 + 2 * DAY_S) for k in range(50))
    assert back.to_json() == b.to_json()


def test_a_slice_of_another_size_is_dropped():
    assert TimedBloom.from_json({"1": "AAAA"}).slices == {}


def test_false_positive_rate_is_small():
    b = TimedBloom()
    for k in range(100):  # a heavy day
        b.add(f"ufov-{k}-x", T0)
    fp = sum(b.seen(f"probe-{k}", T0) for k in range(20_000))
    assert fp / 20_000 < 1e-3
