"""LLM pool worker (BE-13): Gemini writes task variants; only validated ones join the pools.

A background thread asks Gemini for blueprint variants of one schema at one theta level: strictly
structured JSON `params`, the same shape the BE-03 generator builds at that level. Each variant
passes four gates before it can be served, and a variant that fails any of them is dropped and
counted, never served:

1. parse: strict JSON, one {"variants": [...]} object, no duplicate keys, no NaN.
2. BE-03 `validate_payload` with the served schema only (never allow_unserved) and the solvers:
   a wrong answer (relational truth, Stroop ink, matrix option) is caught by the solver.
3. shape: the variant has the shape of the procedural payload at that level (trial counts, levels,
   time limit, colour order, number of options and of varying rules), so an LLM variant measures
   the same thing as a procedural one; only its content differs.
4. content: term safety is structural. After validation, every relational item's terms are
   renamed to fresh procedural tokens (relational._token: CONSONANTS x VOWELS x CONSONANTS minus
   BLOCKED), one consistent renaming per item, so the solver's result cannot change and no word
   the LLM wrote is ever shown. Stroop words are an allowlist (the served colour set). As defence
   in depth the visible text still passes the banned-terms lint (ai_coach/banned_terms.json) and a
   profanity and harm list, and a replay from the archive runs that check again.

Accepted variants get `source: "llm"` (the pool Entry and the session recipe; the payload envelope
itself is unchanged, the frontend contract has no such field) and a content-hash task_id,
`{schema}-llm-{sha256(params)[:16]}`: at most 36 characters, the BE-03 pattern, equal content gives
an equal id and different content never shares one. The `llm` segment can never collide with a
procedural id (`{schema}-{seed}-...`, the seed is digits), and the `{schema}-` prefix keeps
cache_dispatcher.schema_of() working, so trials on LLM variants step the staircase like any other.
Each accepted variant is also written to a content-addressed archive (LLM_VARIANT_DIR), so a
session replay after a restart serves the same bytes: an LLM variant cannot be rebuilt from a seed.

A call that puts no variant in the pool (none accepted, or the dispatcher had no room) puts its
pool on a cool-down (POOL_COOL_FIRST_S, doubling to MAX_BACKOFF_S), so one pool whose replies are
always rejected, or that has no room, cannot take the whole budget.

Fail safe. With no GEMINI_API_KEY, with LLM_POOL_RPM=0 or LLM_POOL_DAILY_CAP=0, or with a bad
setting, no worker exists and no call is made. A Gemini error, a safety block, a 429 or no network
makes nothing happen: the worker backs off, and the procedural generators keep the pools full as
before. The worker never blocks a request: it runs on its own thread and only offers to pools.

Budget. LLM_POOL_RPM (default 2 calls a minute once the key is set) paces the calls, and
LLM_POOL_DAILY_CAP (default 200 calls per UTC day) caps them. The day's count is kept in
{LLM_VARIANT_DIR}/budget.json, so a restart does not reset it; if it cannot be written, no call is
made. An unreadable file is logged once and rewritten as spent for that day, so the next day
starts afresh instead of the worker staying off for good.

Privacy. No user data goes into the prompt (only the schema, the level and the shape), and none
comes out: a variant is task content, shared by every user, with no user id. So the privacy delete
and export have nothing to cover here and no store hook is registered. Which variant a user was
served lives in that user's task registry, which the delete and export already cover (BE-04).
Archived variants are pruned after ARCHIVE_DAYS, past the 14-day life of a session recipe.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import random
import threading
import time
from collections import Counter
from collections.abc import Callable, Mapping
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

from ai_coach.llm_config import active_llm_config
from ai_coach.llm_gemini import GeminiError, GeminiRunner, config_from_env as gemini_config
from ai_coach.llm_openrouter import OpenRouterRunner
from ai_coach.safety_guardrails import BANNED_RULES, lint_text

from .bloom import DAY_S, TTL_DAYS
from .cache_dispatcher import ARCHETYPE_OPTIONS, NEUTRAL, Dispatcher, Entry, theta_level
from .generators import DIMENSION_OF, TASK_ID_RE, generate, schema_problems, validate_payload
from .generators._common import canonical_json
from .generators.relational import BLOCKED as RELATIONAL_BLOCKED
from .generators.relational import _token as procedural_token
from .generators.stroop import INK_PRESETS
from .generators.validate import load_schema

log = logging.getLogger(__name__)

LLM_SOURCE = "llm"
# The schemas the LLM writes for. Relational and Stroop carry visible text; matrix items are small
# puzzles the rule solver checks. The others (n_back, mental_rotation, tower, ufov, mst) are
# geometry or timing grids where an LLM adds nothing the procedural generator lacks.
SCHEMAS: tuple[str, ...] = ("relational", "stroop", "matrix")
VARIANTS_PER_CALL = {"relational": 1, "stroop": 2, "matrix": 6}
# A relational block (90-120 items) is about 8k tokens of JSON.
MAX_OUTPUT_TOKENS = {"relational": 16384, "stroop": 8192, "matrix": 4096}
LLM_PER_POOL = 8  # LLM variants kept per pool at most; the procedural ones fill the rest
CALL_TIMEOUT_S = 90.0  # one generateContent call, whole task blocks: far above Loti's 3 s
TEMPERATURE = 0.9  # variety: these are content variants

DEFAULT_RPM = 2.0
DEFAULT_DAILY_CAP = 200
MAX_RPM = 60.0
IDLE_S = 30.0  # no pool wants a variant: look again after this
ERROR_BACKOFF_S = 60.0  # after an error, doubled per error in a row, up to MAX_BACKOFF_S
RATE_LIMIT_BACKOFF_S = 300.0  # after a 429
MAX_BACKOFF_S = 3600.0
ARCHIVE_DAYS = TTL_DAYS + 1  # a session recipe lives TTL_DAYS; its variant must outlive it
POOL_COOL_FIRST_S = 300.0  # a pool whose call yielded nothing waits this long, doubling per miss
STALE_TMP_S = 3600.0  # a temporary file older than this was left by a crashed write

REJECT_REASONS = ("parse", "schema", "solver", "shape", "content", "duplicate")

# --- configuration ---------------------------------------------------------------------------------


def default_variant_dir() -> Path:
    env = os.environ.get("LLM_VARIANT_DIR")
    return Path(env) if env else Path(__file__).resolve().parents[1] / "data" / "processed" / "llm_variants"


def pool_config(environ: Mapping[str, str] | None = None) -> tuple[float, int] | None:
    """(calls per minute, calls per UTC day), or None when the worker must stay off: no key, a
    zero, or a setting that is not a number (fail safe, logged without the value)."""
    env = os.environ if environ is None else environ
    if active_llm_config(env) is None:
        return None
    try:
        rpm = float(env.get("LLM_POOL_RPM") or DEFAULT_RPM)
        cap = int(env.get("LLM_POOL_DAILY_CAP") or DEFAULT_DAILY_CAP)
    except ValueError:
        log.warning("LLM_POOL_RPM / LLM_POOL_DAILY_CAP is not a number; the LLM pool worker is off")
        return None
    if not math.isfinite(rpm) or rpm <= 0 or cap <= 0:
        return None
    return min(rpm, MAX_RPM), cap


# --- ids, archive, budget --------------------------------------------------------------------------


def variant_id(schema_type: str, params: dict) -> tuple[str, int]:
    """(task_id, surface_seed) from the content: `{schema}-llm-{16 hex}`, at most 36 characters."""
    digest = hashlib.sha256(f"{schema_type}|{canonical_json(params)}".encode()).hexdigest()
    task_id = f"{schema_type}-{LLM_SOURCE}-{digest[:16]}"
    assert TASK_ID_RE.match(task_id)
    return task_id, int(digest[16:24], 16)  # surface_seed in [0, 2**32), like a procedural seed


def serialise(payload: dict) -> bytes:
    return json.dumps(payload, separators=(",", ":"), allow_nan=False).encode("utf-8")


class VariantArchive:
    """Accepted variants, one `{task_id}.json` each: no user data, only task content. A session
    replay reads the body back from here (the dispatcher's `variants` lookup)."""

    def __init__(self, directory: Callable[[], Path] = default_variant_dir) -> None:
        self.directory = directory

    def _path(self, task_id: str) -> Path:
        if not TASK_ID_RE.match(task_id) or f"-{LLM_SOURCE}-" not in task_id:
            raise ValueError("not an LLM variant id")
        return self.directory() / f"{task_id}.json"

    def has(self, task_id: str) -> bool:
        return self._path(task_id).is_file()

    def put(self, payload: dict, record: Mapping[str, Any]) -> None:
        path = self._path(payload["task_id"])
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(f"{path.name}.{os.getpid()}.tmp")
        tmp.write_text(json.dumps({**record, "payload": payload}, allow_nan=False), encoding="utf-8")
        os.replace(tmp, path)

    def get(self, task_id: str) -> bytes | None:
        """The served bytes of a variant, or None: unknown, unreadable, not what its id says, or
        failing the content gate (run again here, in case the lists grew since it was archived)."""
        try:
            doc = json.loads(self._path(task_id).read_text(encoding="utf-8"))
            payload = doc["payload"]
            if variant_id(payload["schema_type"], payload["params"])[0] != task_id or payload["task_id"] != task_id:
                return None
            if content_problems(payload["schema_type"], payload["params"]):
                return None
            return serialise(payload)
        except (OSError, ValueError, KeyError, TypeError, AttributeError):
            return None

    def purge(self, days: int = ARCHIVE_DAYS, now: float | None = None) -> int:
        cutoff = (time.time() if now is None else now) - days * DAY_S
        removed = 0
        directory = self.directory()
        if not directory.is_dir():
            return 0
        for path in directory.glob(f"*-{LLM_SOURCE}-*.json"):
            try:
                if path.stat().st_mtime < cutoff:
                    path.unlink()
                    removed += 1
            except FileNotFoundError:
                pass
        stale = (time.time() if now is None else now) - STALE_TMP_S
        for path in directory.glob("*.tmp"):  # left by a write cut short
            try:
                if path.stat().st_mtime < stale:
                    path.unlink()
            except FileNotFoundError:
                pass
        return removed


class Budget:
    """Calls per UTC day, kept in `{dir}/budget.json` so a restart does not reset the count."""

    def __init__(self, directory: Callable[[], Path], cap: int) -> None:
        self.directory = directory
        self.cap = cap
        self._lock = threading.Lock()

    @staticmethod
    def day(now: float) -> str:
        return datetime.fromtimestamp(now, timezone.utc).strftime("%Y-%m-%d")

    def _write(self, day: str, calls: int) -> None:
        path = self.directory() / "budget.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(f"budget.json.{os.getpid()}.tmp")
        tmp.write_text(json.dumps({"day": day, "calls": calls}), encoding="utf-8")
        os.replace(tmp, path)

    def used(self, now: float) -> int:
        """Calls counted today. An unreadable file counts as spent (fail safe); it is logged and
        rewritten as spent for today, so tomorrow starts at 0 instead of the worker staying off."""
        try:
            doc = json.loads((self.directory() / "budget.json").read_text(encoding="utf-8"))
            return int(doc["calls"]) if doc.get("day") == self.day(now) else 0
        except FileNotFoundError:
            return 0
        except (OSError, ValueError, KeyError, TypeError, AttributeError) as e:
            log.warning("LLM pool budget unreadable (%s); today counts as spent", type(e).__name__)
            try:
                self._write(self.day(now), self.cap)
            except OSError:
                pass  # still unreadable tomorrow: still no call (fail safe)
            return self.cap

    def try_spend(self, now: float) -> bool:
        """Count one call if the day has room. False when spent, or when the count cannot be
        written (a call that cannot be counted is not made)."""
        with self._lock:
            used = self.used(now)
            if used >= self.cap:
                return False
            try:
                self._write(self.day(now), used + 1)
            except OSError as e:
                log.warning("LLM pool budget not writable (%s); no call made", type(e).__name__)
                return False
            return True


# --- the prompt ------------------------------------------------------------------------------------


@lru_cache(maxsize=64)
def _reference(archetype: str, schema_type: str, level: float) -> str:
    """The procedural payload at this level (seed 0), as JSON: the shape every variant must have."""
    options = ARCHETYPE_OPTIONS.get(archetype, ARCHETYPE_OPTIONS[NEUTRAL]).get(schema_type, {})
    return json.dumps(generate(schema_type, level, 0, **options))


def reference(archetype: str, schema_type: str, level: float) -> dict:
    return json.loads(_reference(archetype, schema_type, level))


_GEMINI_KEYS = ("type", "properties", "required", "items", "minItems", "maxItems", "minimum", "maximum")


def to_gemini_schema(node: Any, defs: Mapping[str, Any]) -> dict:
    """A draft-07 node as Gemini's responseSchema (an OpenAPI subset): $refs inlined, a null
    alternative as `nullable`, tuple items as one item type with a fixed length, non-string enums
    as ranges, and what Gemini does not take (patterns, uniqueItems, additionalProperties) left
    out. Constrained decoding only; validate_payload is the gate."""
    if "$ref" in node:
        return to_gemini_schema(defs[node["$ref"].rsplit("/", 1)[-1]], defs)
    if "anyOf" in node:
        alts = [a for a in node["anyOf"] if a.get("type") != "null"]
        out = to_gemini_schema(alts[0], defs)
        if len(alts) < len(node["anyOf"]):
            out["nullable"] = True
        return out
    if "enum" in node:
        values = node["enum"]
        if all(isinstance(v, str) for v in values):
            return {"type": "string", "enum": list(values)}
        return {"type": "integer", "minimum": min(values), "maximum": max(values)}
    out: dict[str, Any] = {k: node[k] for k in _GEMINI_KEYS if k in node and k not in ("properties", "items")}
    if "properties" in node:
        out["properties"] = {k: to_gemini_schema(v, defs) for k, v in node["properties"].items()}
        out["propertyOrdering"] = list(node["properties"])
        out.setdefault("type", "object")
    if "items" in node:
        items = node["items"]
        if isinstance(items, list):
            out["items"] = to_gemini_schema(items[0], defs)
            out["minItems"] = out["maxItems"] = len(items)
        else:
            out["items"] = to_gemini_schema(items, defs)
    return out


PARAMS_DEF = {"relational": "RelationalParams", "stroop": "StroopParams", "matrix": "MatrixParams"}


def response_schema(schema_type: str, count: int) -> dict:
    schema = load_schema()
    params = to_gemini_schema(schema["definitions"][PARAMS_DEF[schema_type]], schema["definitions"])
    return {
        "type": "object",
        "properties": {"variants": {"type": "array", "minItems": count, "maxItems": count, "items": params}},
        "required": ["variants"],
    }


SYSTEM = (
    "You write content for one exercise of a non-clinical cognitive training app for adults. "
    "Reply with JSON only, matching the response schema exactly: no prose, no comments, no extra keys. "
    "Every answer field must be correct: an independent solver checks each one and drops the whole "
    "variant on any error. Use no real words for made-up terms, nothing offensive, nothing about "
    "health, people, groups, places or brands."
)


def _rules(schema_type: str, ref: dict, theta: float) -> str:
    p = ref["params"]
    if schema_type == "relational":
        counts = ", ".join(f"level {i + 1}: {len(lv)} items with hops = {lv[0]['hops']}" for i, lv in enumerate(p["levels"]))
        return (
            f"Relational reasoning. n_trials = {p['n_trials']}, time_limit_ms = {p['time_limit_ms']}. "
            f"levels, easiest first: {counts}. "
            "Each item chains hops + 1 distinct terms with exactly `hops` premises, all of one relation family: "
            "same/opposite, more/less, before/after, or contains (contains has no inverse word). "
            "The question relates the two end terms of the chain. answer = (the question is true) XOR inverted. "
            "Terms are made-up, pronounceable nonsense words of 3 to 6 lowercase letters a-z that are not words in "
            "English or French and spell nothing rude; never reuse a term within an item. "
            f"Difficulty theta = {theta:.1f}: state about {round(50 * theta)}% of premises the other way round "
            f"(b less a instead of a more b), list the premises out of chain order in about {round(100 * theta)}% "
            f"of items, and set inverted = true in about {round(15 + 20 * theta)}% of items."
        )
    if schema_type == "stroop":
        congruent = sum(t["word"].lower() == t["ink"] for t in p["trials"])
        return (
            f"Colour-word Stroop. colors = {json.dumps(p['colors'])} exactly, in this order. "
            f"time_limit_ms = {p['time_limit_ms']}. trials: exactly {len(p['trials'])}, of which exactly "
            f"{congruent} are congruent (the word names its ink) and the rest incongruent. "
            "word is one of the colors in upper case and nothing else; ink is one of the colors; answer = ink. "
            "Never the same (word, ink) pair twice in a row."
        )
    known = [c for c in p["cells"] if c is not None]
    vary = sum(len({c[a] for c in known}) > 1 for a in ("shape", "count", "color"))
    return (
        "3x3 matrix reasoning. cells: 9 glyphs row by row, the last one null (the missing cell). "
        f"Exactly {vary} of shape, count and color change within the grid, each by a row rule: the same along "
        "each row, a progression of count along each row, or every row a permutation of the same three values. "
        "Colour never changes alone. Glyphs keep rotation_deg 0 (a triangle may turn by 90, 180 or 270 when the "
        f"shape never changes). options: exactly {len(p['options'])} distinct glyphs, exactly one of which "
        "completes every rule; no two options differ by colour alone. answer = the index of that option. "
        f"time_limit_ms = {p['time_limit_ms']}."
    )


def _example(schema_type: str, ref: dict) -> dict:
    """The reference params, shortened for the prompt: they show the format, not the content."""
    p = json.loads(json.dumps(ref["params"]))
    if schema_type == "relational":
        p["levels"] = [lv[:2] for lv in p["levels"]]
    elif schema_type == "stroop":
        p["trials"] = p["trials"][:4]
    return p


def build_prompt(schema_type: str, ref: dict, theta: float, count: int) -> tuple[str, list[dict]]:
    text = (
        f"Write {count} new variant(s) of the `params` of one {schema_type} task. "
        f"{_rules(schema_type, ref, theta)} "
        f"Format example (shortened; write new content, do not copy it): {json.dumps(_example(schema_type, ref))}. "
        'Reply as {"variants": [params, ...]}.'
    )
    return SYSTEM, [{"role": "user", "parts": [{"text": text}]}]


# --- the gates -------------------------------------------------------------------------------------


class VariantParseError(ValueError):
    pass


def _no_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict:
    keys = [k for k, _ in pairs]
    if len(keys) != len(set(keys)):
        raise VariantParseError("duplicate key")
    return dict(pairs)


def _no_constant(token: str) -> Any:
    raise VariantParseError("NaN or Infinity")


def parse_variants(text: str, count: int) -> list:
    """The variants of a strict-JSON reply. Raises VariantParseError on anything else."""
    try:
        doc = json.loads(text, object_pairs_hook=_no_duplicate_keys, parse_constant=_no_constant)
    except VariantParseError:
        raise
    except ValueError:
        raise VariantParseError("not JSON") from None
    if not isinstance(doc, dict) or set(doc) != {"variants"} or not isinstance(doc["variants"], list):
        raise VariantParseError('not {"variants": [...]}')
    return doc["variants"][:count]


def shape_problems(schema_type: str, params: dict, ref: dict) -> list[str]:
    """[] when a (schema-valid) variant has the procedural shape at its level."""
    r = ref["params"]
    out = []
    if schema_type == "relational":
        if params["n_trials"] != r["n_trials"] or params["time_limit_ms"] != r["time_limit_ms"]:
            out.append("n_trials or time_limit_ms differ from the level's")
        if [[t["hops"] for t in lv] for lv in params["levels"]] != [[t["hops"] for t in lv] for lv in r["levels"]]:
            out.append("levels or items per level differ from the level's")
    elif schema_type == "stroop":
        def cong(p: dict) -> int:
            return sum(t["word"].lower() == t["ink"] for t in p["trials"])

        if params["colors"] != r["colors"] or params["time_limit_ms"] != r["time_limit_ms"]:
            out.append("colors (in order) or time_limit_ms differ from the level's")
        if len(params["trials"]) != len(r["trials"]) or cong(params) != cong(r):
            out.append("trial count or congruent share differ from the level's")
    elif schema_type == "matrix":
        def varying(p: dict) -> list[str]:
            known = [c for c in p["cells"] if c is not None]
            return [a for a in ("shape", "count", "color") if len({c[a] for c in known}) > 1]

        if len(params["options"]) != len(r["options"]) or params["time_limit_ms"] != r["time_limit_ms"]:
            out.append("option count or time_limit_ms differ from the level's")
        if params["cells"].index(None) != r["cells"].index(None):
            out.append("the missing cell is not where the UI expects it")
        if len(varying(params)) != len(varying(r)):
            out.append("number of varying attributes differs from the level's")
        if varying(params) == ["color"]:
            out.append("colour is the only varying attribute (FE-12)")
    return out


SERVED_INKS = frozenset(INK_PRESETS["classic"])
# Profanity and harm, English and French. Terms are matched whole; stems inside any term. A term
# should be nonsense anyway, so a false hit only costs one variant. Identity words are listed too:
# in "X is less than Y" they would read as a slur.
HARM_STEMS = (
    "fuck", "shit", "cunt", "nigg", "fagg", "rape", "slut", "whore", "bitch", "porn", "nazi", "hitl",
    "suicid", "kill", "murder", "dick", "cock", "puss", "twat", "wank", "penis", "vagin", "anal",
    "merde", "putain", "salop", "encul", "nique", "connard", "chier", "pedo", "terror", "bomb",
)
HARM_WORDS = frozenset(
    "ass arse sex die dead death gun cum tit tits fap fag kkk con cul pd pute bite hate drug weed "
    "jew jews arab black white gay trans muslim islam negro asian gypsy nazi isis "
    # three-letter spellings a nonsense term can hit (the relational generator blocks them too)
    "fuk fap jap nig nip wog wop kum jiz dik pis nob lez kok zob nik kul kon pak "
    "vag vaj zeb fak fok git fek nit dum nul jip neg kut lul kuk pik kus "
    # slurs and insults of four letters or more (terms are renamed before serving; this is defence
    # in depth, and the replay check)
    "kike kikes spic spick coon coons chink gook wetback beaner tranny dyke paki raghead towelhead "
    "retard retarded mong spaz cripple".split()
)


def visible_text(schema_type: str, params: dict) -> list[str]:
    if schema_type == "relational":
        return [s[k] for lv in params["levels"] for t in lv for s in t["premises"] + [t["question"]] for k in ("a", "b")]
    if schema_type == "stroop":
        return [t["word"] for t in params["trials"]]
    return []  # matrix: enums only


def content_problems(schema_type: str, params: dict) -> list[str]:
    """Problems with the text the user will read. Reports categories, never the matched words."""
    texts = visible_text(schema_type, params)
    out = []
    if schema_type == "stroop" and any(w.lower() not in SERVED_INKS for w in texts):
        out.append("a Stroop word outside the colour set")
    lowered = {t.lower() for t in texts}
    if schema_type == "relational" and lowered & RELATIONAL_BLOCKED:
        out.append("a real or rude short word as a term")
    if lowered & HARM_WORDS or any(stem in t for t in lowered for stem in HARM_STEMS):
        out.append("profanity or harm list")
    hits = lint_text(" ".join(sorted(lowered)), BANNED_RULES)
    if hits:
        out.append("banned terms: " + ", ".join(sorted({rule.category for rule, _ in hits})))
    return out


def rename_terms(params: dict) -> dict:
    """The relational params with every item's terms replaced by fresh procedural tokens: one
    consistent renaming per item (a term keeps one new name across its premises and question), so
    the solver's answer and hop count are unchanged. Seeded by the content, so equal LLM output
    still gives an equal variant (and id)."""
    rng = random.Random("llm-terms|" + hashlib.sha256(canonical_json(params).encode()).hexdigest())
    out = json.loads(json.dumps(params))
    for level in out["levels"]:
        for item in level:
            names: dict[str, str] = {}
            taken: set = set()
            for statement in item["premises"] + [item["question"]]:
                for k in ("a", "b"):
                    if statement[k] not in names:
                        names[statement[k]] = procedural_token(rng, taken)
                    statement[k] = names[statement[k]]
    return out


def _envelope(schema_type: str, params: dict) -> dict:
    task_id, surface_seed = variant_id(schema_type, params)
    return {
        "task_id": task_id,
        "dimension": DIMENSION_OF[schema_type],
        "schema_type": schema_type,
        "params": params,
        "surface_seed": surface_seed,
    }


def check_variant(schema_type: str, params: Any, ref: dict) -> tuple[dict | None, str | None, list[str]]:
    """(payload, None, []) for a servable variant, else (None, reason, problems)."""
    if not isinstance(params, dict):
        return None, "schema", ["a variant is not an object"]
    payload = _envelope(schema_type, params)
    problems = validate_payload(payload)  # served schema only, then the solvers
    if problems:
        return None, "schema" if schema_problems(payload) else "solver", problems
    if schema_type == "relational":
        # No word the LLM wrote is shown: the terms are procedural tokens from here on, and the id
        # is the hash of what is served.
        params = rename_terms(params)
        payload = _envelope(schema_type, params)
        problems = validate_payload(payload)
        if problems:  # a renaming bug, never the LLM's: still never served
            return None, "solver", problems
    for reason, check in (("shape", lambda: shape_problems(schema_type, params, ref)), ("content", lambda: content_problems(schema_type, params))):
        problems = check()
        if problems:
            return None, reason, problems
    return payload, None, []


# --- the worker ------------------------------------------------------------------------------------


class LlmPoolWorker:
    """One background thread. `run_once()` is one cycle (tests call it directly)."""

    def __init__(
        self,
        runner: GeminiRunner,
        dispatcher: Callable[[], Dispatcher | None],
        *,
        rpm: float = DEFAULT_RPM,
        daily_cap: int = DEFAULT_DAILY_CAP,
        archive: VariantArchive | None = None,
        clock: Callable[[], float] = time.time,
        schemas: tuple[str, ...] = SCHEMAS,
        per_pool: int = LLM_PER_POOL,
    ) -> None:
        self.runner = runner
        self.dispatcher = dispatcher
        self.interval = 60.0 / rpm
        self.archive = archive or VariantArchive()
        self.budget = Budget(self.archive.directory, daily_cap)
        self.clock = clock
        self.schemas = tuple(s for s in schemas if s in SCHEMAS)
        self.per_pool = per_pool
        self.stats: Counter = Counter()
        self._next_call = 0.0
        self._paused_until = 0.0
        self._failures = 0
        self._purged_day = ""
        self._cool: dict[tuple[str, str, float], tuple[float, int]] = {}  # pool -> (until, misses)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    @classmethod
    def from_env(
        cls, dispatcher: Callable[[], Dispatcher | None], environ: Mapping[str, str] | None = None, **kw: Any
    ) -> "LlmPoolWorker | None":
        """None (no worker, no call ever) without a key, with a zero rate or cap, or a bad setting."""
        config = pool_config(environ)
        if config is None:
            return None
        cfg = active_llm_config(environ)
        if cfg is None:
            return None
        provider, key, model = cfg
        rpm, cap = config
        if provider == "openrouter":
            runner = OpenRouterRunner(key, model, timeout_s=CALL_TIMEOUT_S)
        else:
            runner = GeminiRunner(key, model, timeout_s=CALL_TIMEOUT_S)
        return cls(runner, dispatcher, rpm=rpm, daily_cap=cap, **kw)

    def _target(self, d: Dispatcher) -> tuple[str, str, float] | None:
        """The pool, among those in use, holding the fewest LLM variants (and fewer than per_pool)."""
        stock = d.pool_stock()
        now = self.clock()
        wanted = [
            (llm, key)
            for key, (_, llm) in stock.items()
            if key[1] in self.schemas and llm < self.per_pool and now >= self._cool.get(key, (0.0, 0))[0]
        ]
        return min(wanted)[1] if wanted else None

    def _miss(self, target: tuple[str, str, float], now: float) -> None:
        """A call that put no variant in the pool: that pool cools down, doubling per miss."""
        _, misses = self._cool.get(target, (0.0, 0))
        self._cool[target] = (now + min(MAX_BACKOFF_S, POOL_COOL_FIRST_S * 2**misses), misses + 1)

    def _backoff(self, now: float, base: float) -> None:
        self._failures += 1
        self._paused_until = now + min(MAX_BACKOFF_S, base * 2 ** (self._failures - 1))

    def run_once(self) -> str:
        """One cycle. Returns what happened: paused, rate, no_target, budget, error, or ok."""
        now = self.clock()
        if now < self._paused_until:
            return "paused"
        if now < self._next_call:
            return "rate"
        d = self.dispatcher()
        target = self._target(d) if d is not None else None
        if target is None:
            return "no_target"
        if not self.budget.try_spend(now):
            self.stats["budget_skips"] += 1
            return "budget"
        self._next_call = now + self.interval
        archetype, schema_type, level = target
        count = VARIANTS_PER_CALL[schema_type]
        ref = reference(archetype, schema_type, level)
        system, contents = build_prompt(schema_type, ref, level, count)
        self.stats["calls"] += 1
        failure = None
        try:
            text = self.runner.generate(
                system,
                contents,
                json_schema=response_schema(schema_type, count),
                temperature=TEMPERATURE,
                deadline=time.monotonic() + CALL_TIMEOUT_S,
                max_output_tokens=MAX_OUTPUT_TOKENS[schema_type],
            )
        except GeminiError as e:  # a status or a type name; never content or the key
            failure = str(e)
        except Exception as e:  # noqa: BLE001 - anything else fails safe too
            failure = type(e).__name__
        if failure is not None:
            limited = failure == "HTTP 429"
            self.stats["rate_limited" if limited else "errors"] += 1
            self._backoff(now, RATE_LIMIT_BACKOFF_S if limited else ERROR_BACKOFF_S)
            log.warning("LLM pool call failed (%s); procedural pools keep serving", failure)
            return "error"
        self._failures = 0

        try:
            variants = parse_variants(text, count)
        except VariantParseError:
            self._reject("parse")
            self._miss(target, now)
            return "ok"
        entries = []
        for params in variants:
            payload, reason, _ = check_variant(schema_type, params, ref)
            if payload is None:
                self._reject(reason)
                continue
            if self.archive.has(payload["task_id"]) or any(e.task_id == payload["task_id"] for e in entries):
                self._reject("duplicate")
                continue
            record = {"source": LLM_SOURCE, "model": self.runner.model, "schema_type": schema_type, "theta": level, "created_at": now}
            try:
                self.archive.put(payload, record)
            except OSError as e:  # unreplayable after a restart: do not serve it
                log.warning("LLM variant archive not writable (%s)", type(e).__name__)
                continue
            entries.append(Entry(payload["task_id"], serialise(payload), 0, LLM_SOURCE))
        self.stats["accepted"] += len(entries)
        offered = d.offer(archetype, schema_type, level, entries) if entries and not self._stop.is_set() else 0
        self.stats["offered"] += offered
        if offered:
            self._cool.pop(target, None)
        else:  # nothing accepted, or the dispatcher had no room: either way, this pool waits
            self._miss(target, now)
        day = Budget.day(now)
        if day != self._purged_day:
            self._purged_day = day
            self.archive.purge(ARCHIVE_DAYS, now)
        log.info("LLM pool: %s", dict(self.stats))
        return "ok"

    def _reject(self, reason: str | None) -> None:
        self.stats["rejected"] += 1
        self.stats[f"rejected_{reason}"] += 1

    def _delay(self, outcome: str) -> float:
        now = self.clock()
        if outcome == "paused" or outcome == "error":
            return max(0.1, self._paused_until - now)
        if outcome == "budget":
            return 600.0  # look again later; the count resets at the next UTC day
        if outcome == "no_target":
            return IDLE_S
        return max(0.1, self._next_call - now)

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                outcome = self.run_once()
            except Exception as e:  # noqa: BLE001 - a worker bug must not stop the server, nor spin
                log.warning("LLM pool worker cycle failed (%s)", type(e).__name__)
                outcome = "error"
                self._backoff(self.clock(), ERROR_BACKOFF_S)
            self._stop.wait(self._delay(outcome))

    def start(self) -> None:
        if self._thread is None:
            self._thread = threading.Thread(target=self._loop, name="llm-pool", daemon=True)
            self._thread.start()

    def stop(self, timeout: float = 5.0) -> None:
        """Stop the loop. A call still in flight is abandoned (daemon thread): nothing is offered."""
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout)
        self.runner.close()
