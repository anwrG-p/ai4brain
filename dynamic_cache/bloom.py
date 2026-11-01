"""Per-user "seen" filter: which task ids a user was served in the last 14 days (BE-04).

A Bloom filter answers "maybe seen" or "surely not seen" in a fixed few hundred bytes, so the
registry never holds the list of served tasks. TTL comes from time slices: one filter per UTC day,
and a lookup asks only the slices younger than the TTL. A slice is dropped once its whole day is
older than the TTL plus one day, so a served task is blocked for at least TTL_DAYS and at most one
day more (the slice's day boundary), never less.

A false positive only makes the dispatcher skip a fresh task and take the next one; it never lets a
repeat through. One slice holding n items answers a fresh probe 'seen' with probability
(1 - e^(-kn/m))^k, k = HASHES = 7, m = SLICE_BITS = 4096; a lookup asks up to 15 slices:

  | tasks per day | one slice | 15 such days |
  |---------------|-----------|--------------|
  | 8 (a session) | 9e-14     | 1e-12        |
  | 100           | 2.4e-6    | 3.5e-5       |
  | 400 (the API's daily cap per id) | 7.3e-3 | 0.10 |
  | 2880 (no cap, 120/hour all day)  | 0.95   | 1.0  |

So the per-id rate limit in api.py (120/hour, 400/day) is what keeps a leaked id from saturating
its filter; at the cap a fresh task is still found within the pool and FRESH_TRIES builds.
"""

from __future__ import annotations

import base64
import hashlib

TTL_DAYS = 14
DAY_S = 86_400
SLICE_BITS = 4096
HASHES = 7


def day_of(ts: float) -> int:
    """The UTC day number of a unix timestamp."""
    return int(ts // DAY_S)


def _positions(item: str) -> list[int]:
    # Double hashing (Kirsch-Mitzenmacher): k positions from two 64-bit halves of one SHA-256.
    d = hashlib.sha256(item.encode("utf-8")).digest()
    h1 = int.from_bytes(d[:8], "big")
    h2 = int.from_bytes(d[8:16], "big") | 1
    return [(h1 + i * h2) % SLICE_BITS for i in range(HASHES)]


class TimedBloom:
    """Day-sliced Bloom filter with a TTL. Not thread safe: the registry's lock guards it."""

    def __init__(self, slices: dict[int, bytearray] | None = None, ttl_days: int = TTL_DAYS) -> None:
        self.ttl_days = ttl_days
        self.slices: dict[int, bytearray] = slices or {}

    def _live(self, now: float) -> list[int]:
        today = day_of(now)
        # A slice of day d holds items served during d; keeping d >= today - ttl_days blocks each
        # item for between ttl_days and ttl_days + 1 days.
        return [d for d in self.slices if today - self.ttl_days <= d <= today]

    def expire(self, now: float) -> None:
        oldest = day_of(now) - self.ttl_days
        for d in [d for d in self.slices if d < oldest]:
            del self.slices[d]

    def add(self, item: str, now: float) -> None:
        self.expire(now)
        bits = self.slices.setdefault(day_of(now), bytearray(SLICE_BITS // 8))
        for p in _positions(item):
            bits[p >> 3] |= 1 << (p & 7)

    def seen(self, item: str, now: float) -> bool:
        """True if `item` was (maybe) added within the TTL; False means surely not."""
        pos = _positions(item)
        for d in self._live(now):
            bits = self.slices[d]
            if all(bits[p >> 3] & (1 << (p & 7)) for p in pos):
                return True
        return False

    def to_json(self) -> dict[str, str]:
        return {str(d): base64.b64encode(bytes(b)).decode("ascii") for d, b in sorted(self.slices.items())}

    @classmethod
    def from_json(cls, data: dict[str, str] | None, ttl_days: int = TTL_DAYS) -> "TimedBloom":
        slices = {}
        for d, b64 in (data or {}).items():
            raw = base64.b64decode(b64)
            if len(raw) == SLICE_BITS // 8:  # a slice of another size is from an old layout: drop it
                slices[int(d)] = bytearray(raw)
        return cls(slices, ttl_days)
