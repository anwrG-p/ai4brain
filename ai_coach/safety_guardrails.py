"""Safety guardrails for Loti, the coach (Member 2).

Two separate parts. Neither one ever rewrites or euphemises what the user wrote.

1. OUTPUT guardrail (`SafetyGuardrailEngine.check_safety` / `sanitize`): lints Loti's own replies
   against `banned_terms.json` (clinical labels, guilt, brain regions, chemicals, neuroplasticity,
   transfer and comparison claims). A reply that trips a rule is withheld whole and a fixed,
   pre-checked fallback goes out instead. No word-for-word substitution: the old rewrite map turned
   "dementia" into "cognitive endurance challenge" and "disability" into "distinct cognitive
   modality", which hid real needs instead of pointing to help (research area 7).

2. INPUT gates on the user's text, run before any LLM call:
   - `crisis_check(text)`: deterministic self-harm, suicide and acute-distress phrases (English and
     French). A hit returns a fixed, calm reply pointing to local emergency services and a crisis
     line; the LLM is never consulted.
   - `health_signpost(text)`: the user raises a diagnosis, a condition or a symptom. A hit returns
     "I can't assess health. A doctor can." instead of an LLM reply.
   Both return `GateResult(hit, reply)`, the shape of the frontend seam `crisisGate(text) => { hit, reply? }`.

THE KEYWORD CRISIS GATE IS A FLOOR, NOT A CLASSIFIER. It catches the listed phrasings and an
intent x harm composition of them, but recall on wording it has never seen is low: on three held-out
sets of 20 phrasings, each written before the patterns it was measured against, it caught 14, 8 and
5 (70%, 40%, 25%). An LLM-based backup classifier, run on every user message alongside this gate, is
REQUIRED before any LLM path is enabled for users (research area 7, improvement 1). Until then the
LLM path stays off, as it is by default in the frontend (VITE_LOTI_COACH).
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Pattern, Tuple

from ai_coach.schemas import GateResult, SafetyMetadata, SafetyViolation

BANNED_TERMS_PATH = Path(__file__).resolve().parent / "banned_terms.json"


# ---------------------------------------------------------------------------------------------
# Part 1: output guardrail (Loti's replies)
# ---------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class BannedRule:
    """One rule from banned_terms.json, compiled for Python."""

    term_label: str
    category: str
    source: str
    flags: str
    regex: Pattern[str]
    # JS negative lookbehinds may be variable-width, which Python's `re` rejects. A leading
    # `(?<!X)` is split off and checked as "the text before the match must not end with X".
    not_after: Optional[Pattern[str]] = None

    def find(self, text: str) -> Iterator[str]:
        for match in self.regex.finditer(text):
            if self.not_after is not None and self.not_after.search(text[: match.start()]):
                continue
            yield match.group(0)


def _split_leading_lookbehind(source: str) -> Tuple[Optional[str], str]:
    """Return (lookbehind body, rest) for a source starting with `(?<!...)`, else (None, source)."""
    if not source.startswith("(?<!"):
        return None, source
    depth = 0
    i = 0
    while i < len(source):
        ch = source[i]
        if ch == "\\":
            i += 2
            continue
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return source[len("(?<!") : i], source[i + 1 :]
        i += 1
    raise ValueError(f"Unbalanced lookbehind in banned-term pattern: {source!r}")


def _compile_rule(entry: Dict[str, str]) -> BannedRule:
    flags = entry.get("flags", "")
    re_flags = re.IGNORECASE if "i" in flags else 0
    source = entry["pattern"]
    lookbehind, body = _split_leading_lookbehind(source)
    return BannedRule(
        term_label=entry["termLabel"],
        category=entry["category"],
        source=source,
        flags=flags,
        regex=re.compile(body, re_flags),
        not_after=re.compile(f"(?:{lookbehind})$", re_flags) if lookbehind is not None else None,
    )


def load_banned_terms(path: Path = BANNED_TERMS_PATH) -> Dict[str, List[Dict[str, str]]]:
    """Raw JSON sections: `shared` (parity with copyLinter.ts) and `coach_only`."""
    data = json.loads(path.read_text(encoding="utf-8"))
    return {"shared": data["shared"], "coach_only": data["coach_only"]}


_SECTIONS = load_banned_terms()
SHARED_RULES: Tuple[BannedRule, ...] = tuple(_compile_rule(e) for e in _SECTIONS["shared"])
COACH_ONLY_RULES: Tuple[BannedRule, ...] = tuple(_compile_rule(e) for e in _SECTIONS["coach_only"])
BANNED_RULES: Tuple[BannedRule, ...] = SHARED_RULES + COACH_ONLY_RULES

# Kept (empty) only because src/coach/safety_guardrails.py re-exports the name. The rewrite map is
# gone on purpose (BE-05): the coach never substitutes words, it withholds a bad reply whole.
CLINICAL_TERM_REPLACEMENTS: Dict[str, str] = {}

# Sent when Loti's reply is withheld and the caller has no better fallback. Lint-clean, <= 12 words.
SAFE_FALLBACK_REPLY = "Let's keep going with your exercises."

# Fixed signpost when the user raises health. Lint-clean: no labels, no assessment.
HEALTH_SIGNPOST_REPLY = "I can't assess health. A doctor can."

DISCLAIMER_TEXT = (
    f"{HEALTH_SIGNPOST_REPLY} This app is non-clinical cognitive fitness practice; "
    "we do not provide medical or psychiatric diagnoses."
)


def lint_text(text: str, rules: Tuple[BannedRule, ...] = BANNED_RULES) -> List[Tuple[BannedRule, str]]:
    """Every (rule, matched text) in `text`. Detection only: the text is never changed."""
    if not text:
        return []
    return [(rule, hit) for rule in rules for hit in rule.find(text)]


# ---------------------------------------------------------------------------------------------
# Part 2: input gates (the user's text). Detection only; the user's words are never changed.
# ---------------------------------------------------------------------------------------------


def normalise_user_text(text: str) -> str:
    """Lowercase, strip accents and apostrophes, turn other punctuation into spaces.

    "I CAN'T go on!!!" -> "i cant go on"; "J’ai des idées noires…" -> "jai des idees noires";
    "self-harm" -> "self harm". Used for matching only.
    """
    decomposed = unicodedata.normalize("NFKD", text or "")
    no_accents = "".join(c for c in decomposed if not unicodedata.combining(c))
    lowered = no_accents.lower()
    no_apostrophes = re.sub(r"['’‘`]", "", lowered)
    spaced = re.sub(r"[^\w\s]|_", " ", no_apostrophes)
    return re.sub(r"\s+", " ", spaced).strip()


# Fixed crisis replies. The English one starts with the frontend's CRISIS_MESSAGE text
# (features/loti/coachAdapter.ts) and adds numbers: 112 is the EU emergency number, 3114 the French
# national suicide prevention line, 988 the US Suicide & Crisis Lifeline.
CRISIS_REPLY_EN = (
    "I'm really glad you told me. Please call your local emergency number now, "
    "or a suicide and crisis line. Emergency in Europe: 112. France: 3114. US: 988."
)
CRISIS_REPLY_FR = (
    "Merci de me l'avoir dit. Appelez maintenant le numéro d'urgence local, "
    "ou une ligne de prévention du suicide. Urgences en Europe : 112. France : 3114. États-Unis : 988."
)

# Phrases on normalised text (see normalise_user_text). Language: "en", "fr" or None (both).
# Choices, erring towards answering (a calm false hit costs less than a miss):
# - Caught: "suicide/suicidal" (and the misspellings "sucide", "suicde"), self-harm, "kill(ing) /
#   kil / hurt(ing) / harm / cut(ting) / hang / unalive myself", "unalive", "kms", "end(ing) my
#   life", "end it all", "tak(e|ing) my own life", "want to die", "can't go on" (frontend parity),
#   "better off dead", "don't want to live / be here anymore", "no point in living", "done with
#   life", "disappear forever", "want it all to stop", overdose, "not safe"; French "me tuer", "me
#   suicider", "me fais / me suis fait du mal", "scarifi…", "mutil…", "envie de mourir", "crever",
#   "me foutre en l'air", "idées noires", "mettre fin à mes jours", "ne veux plus vivre", "plus de
#   raison de vivre", "(veux / envie d') en finir" unless it is "en finir avec cet exercice" & co,
#   "veux disparaître".
# - Digit-for-letter spellings ("d1e", "k1ll") are matched on a second, de-leeted copy.
# - Let through, as everyday idioms with no self-reference: "this task is killing me", "I'm dying
#   to…", "I could kill for a coffee", "dead tired", "ça me tue", "mort de fatigue", "me tuer à la
#   tâche", "j'en peux plus de ce chrono", "going to die of boredom", "je vais crever de chaud".
#   Also "je vais mourir d'ennui", "mort de rire", "dying to beat my score", "en finir avec ces
#   matrices" (exercise nouns are excluded after "en finir").
# - Known false hits we accept: "I hurt myself playing football", "cutting myself a slice of cake",
#   "caffeine overdose", "I can't go on to the next level", "ugh I want to die, this level is so
#   hard", "kms" meaning kilometres (in a coach chat it is far more often self-harm slang).
_EXERCISE_NOUNS = (
    r"(?:exercices?|exos?|niveaux?|parties?|jeux?|tests?|taches?|series?|rounds?|sessions?|"
    r"chronos?|questions?|epreuves?|quiz|matrices?|grilles?)"
)

# Intent x harm composition. Any intent, up to three filler words, then any harm, so new wording
# ("I'm going to end things tonight", "j'ai envie de me jeter sous un train") is caught without
# listing every phrase. Idioms of exaggeration are cut off by negative lookaheads.
_FILLER = r"(?: \w+){0,3}?"
_EN_INTENT = (
    r"(?:want(?:s|ed)? to|wanna|going to|gonna|plan(?:s|ned|ning)? (?:to|on)|a plan to|"
    r"thinking (?:about|of)|think(?:s)? about|thought (?:about|of)|ready to|about to|decided to|"
    r"trying to|try to|wish i could|will|ill|might|keep thinking about)"
)
_EN_HARM = (
    r"(?:die(?! (?:of|from) (?:boredom|laughter|laughing|embarrassment|shame|cringe))|dying|"
    r"be(?:ing)? (?:dead|gone)|end(?:ing)? (?:myself|things|it|it all|everything|my life)|"
    r"jump(?:ing)? (?:off|from|in front of)|(?:never|not) wak(?:e|ing) up|"
    r"(?:go|going) to sleep forever|sleep forever|disappear(?:ing)?(?! from (?:the|this) (?:screen|list))|"
    r"(?:kill|hurt|harm|cut|hang)(?:ing)? myself|take my (?:own )?life|taking my (?:own )?life)"
)
_FR_INTENT = (
    r"(?:veux|voudrais|vais|envie de|envie d|pense a|pense|pensais a|penser a|compte|"
    r"prefere|prefererais|aimerais|ai pense a|vais aller)"
)
_FR_HARM = (
    r"(?:mourir(?! (?:dennui|de rire|de faim|de soif|de honte|de froid|de chaud|de fatigue|de peur))|"
    r"crever(?! (?:de chaud|de faim|de soif|de froid|dennui))|me tuer(?! a la tache)|me jeter|"
    r"me pendre|partir pour (?:toujours|de bon)|(?:ne )?plus (?:jamais )?me reveiller|"
    r"ne (?:jamais|pas) me reveiller|disparaitre|me faire du mal|sauter (?:du|dun|par|sous|de))"
)
_CRISIS_PHRASES: Tuple[Tuple[str, Optional[str]], ...] = (
    (r"\bsu?i?cid\w*|\bsuicd\w*", None),
    (r"\bself ?harm\w*", "en"),
    (r"\b(?:kill?|hurt|harm|cut|hang|starv|unaliv)\w* my ?self\b", "en"),
    (r"\bunaliv\w*", "en"),
    (r"\bkms\b", "en"),
    (r"\bend(?:s|ed|ing)? (?:my (?:own )?life|it all)\b", "en"),
    (r"\b(?:take|takes|taking|took) my (?:own )?life\b", "en"),
    (r"\b(?:want|wanna|wish|ready) (?:to )?die\b", "en"),
    (r"\bi wish i (?:was|were) dead\b", "en"),
    (r"\bbetter off dead\b", "en"),
    (r"\b(?:dont|do not) want to (?:live|be alive|wake up|be here any ?more)\b", "en"),
    (r"\bno (?:reason|point) (?:in |to )?(?:live|living)\b", "en"),
    (r"\bnot worth living\b", "en"),
    (r"\bdone with (?:life|living)\b", "en"),
    (r"\b(?:disappear|vanish) forever\b", "en"),
    (r"\bwant (?:it all|everything) to (?:stop|end)\b", "en"),
    (r"\b(?:cant|can ?not|can t) go on\b", "en"),
    (r"\boverdos(?:e|ed|ing)\b", "en"),
    (r"\btake all (?:of )?(?:my|the) (?:pills|meds|tablets)\b", "en"),
    (r"\b(?:im|i am) not safe\b", "en"),
    (r"\b(?:dont|do not) feel safe\b", "en"),
    (r"\bme tuer\b(?! a la tache)", "fr"),
    (r"\bme (?:pendre|faire du mal|fais du mal|fait du mal|suis faite? du mal)\b", "fr"),
    # "mutilate" is English too, so the reply language comes from the French hints.
    (r"\bscarifi\w*|\b(?:auto)?mutil\w*", None),
    (r"\bme foutre en lair\b", "fr"),
    (r"\bmettre fin a (?:mes jours|ma vie)\b", "fr"),
    (
        r"\bd?en finir\b(?! avec (?:(?:cet|cette|ce|ces|le|la|les|mon|ma|mes|ton|ta|tes) )?l?"
        + _EXERCISE_NOUNS
        + r"\b)",
        "fr",
    ),
    (r"\b(?:veux|voudrais|envie de|prefere|prefererais) (?:mourir|crever)\b", "fr"),
    (r"\b(?:veux|voudrais|envie de) disparaitre\b", "fr"),
    (r"\b(?:plus|pas) envie de vivre\b", "fr"),
    (r"\bveux plus vivre\b", "fr"),
    (r"\bplus (?:de|aucune) raisons? de vivre\b", "fr"),
    (r"\bidees noires\b", "fr"),
    (r"\bpas en securite\b", "fr"),
    # Composition (see _EN_INTENT / _FR_INTENT above).
    (rf"\b{_EN_INTENT}{_FILLER} {_EN_HARM}\b", "en"),
    (rf"\b{_FR_INTENT}{_FILLER} {_FR_HARM}\b", "fr"),
    # Standalone forms that need no intent word.
    (r"\bend myself\b", "en"),
    (r"\b(?:cant|can ?not|can t) (?:keep|go on|continue) (?:living|like this)\b", "en"),
    (r"\b(?:cant|can ?not|can t) live like this\b", "en"),
    (r"\bif i (?:was|were) (?:gone|dead)\b|\bif i (?:wasnt|werent|was not|were not) (?:here|around|alive)\b", "en"),
    (r"\b(?:better|happier|easier) (?:off )?without me\b", "en"),
    (r"\b(?:slit|cut|slash)\w* (?:my )?wrists?\b", "en"),
    (r"\b(?:ouvert|ouvrir|ouvre|coupe|couper|taillade)\w* (?:les|mes) veines\b", "fr"),
    (r"\bla vie (?:na|n a) plus (?:de|aucun) sens\b|\bplus (?:de|aucun) sens a (?:ma |la )?vie\b", "fr"),
    # Categories, written generally rather than as single phrases.
    # Pointlessness of living.
    (r"\bpoint (?:of|in|to) (?:living|life|being alive|going on|carrying on|existing)\b", "en"),
    (r"\ba quoi bon (?:vivre|continuer a vivre|exister|rester en vie)\b", "fr"),
    # Burden; others better off or indifferent.
    (r"\b(?:im|i am) (?:a|such a|just a|only a) burden\b", "en"),
    (r"\b(?:nobody|no one|noone|no body) would (?:miss|notice|care)\b", "en"),
    (r"\bif i (?:died|disappeared|killed myself|wasnt alive)\b", "en"),
    (
        r"\bun fardeau\b|\b(?:fardeau|poids) pour (?:tout le monde|les autres|ma famille|mes proches|toi|vous|eux)\b",
        "fr",
    ),
    (r"\bpersonne ne (?:me regretterait|remarquerait|sen rendrait compte|me pleurerait)\b", "fr"),
    (r"\bsi je (?:mourais|disparaissais|netais plus la|me tuais)\b", "fr"),
    # Farewells.
    (r"\b(?:goodbye|suicide|farewell) (?:note|letter|message|video)\b", "en"),
    (r"\b(?:saying|say|said) (?:goodbye|my goodbyes) to (?:everyone|everybody|my family|you all|all of you)\b", "en"),
    (
        r"\b(?:lettre|mot|message) dadieu\b|\bfaire mes adieux\b|"
        r"\b(?:dire|dites|dis) adieu a (?:ma famille|tout le monde|mes proches|vous|toi|mes parents|mes amis)\b",
        "fr",
    ),
    # No strength or will left to live.
    (r"\b(?:no|lost the|lost my|no more) (?:will|strength|reason|energy) to (?:live|go on)\b", "en"),
    (r"\bplus (?:la force|le courage|lenvie|la volonte) de vivre\b", "fr"),
    # Putting an end to everything.
    (r"\bput an end to (?:it all|everything|my life|myself)\b", "en"),
    (r"\bmettre fin a (?:tout|mon existence|mes souffrances)\b", "fr"),
    # Not wanting to exist.
    (
        r"\b(?:stop|cease|quit) (?:existing|being alive|living)\b|"
        r"\b(?:dont|do not|no longer) want to (?:exist|be around)\b|\b(?:want|wish|prefer|rather) (?:to )?not exist\b",
        "en",
    ),
    (r"\b(?:ne )?plus exister\b|\bsupporte plus (?:de vivre|la vie|ma vie|detre en vie)\b", "fr"),
    # Means: a quantity of pills or medication.
    (
        r"\b(?:took|take|taking|swallow\w*) (?:a bunch of|all (?:of )?(?:my|the)|a lot of|too many|"
        r"loads of|the whole (?:bottle|box|pack) of|a handful of) (?:pills|meds|tablets|medication|sleeping pills)\b",
        "en",
    ),
    (
        r"\b(?:aval\w*|prendre|pris|prends) (?:toutes? (?:mes|les)|la boite de|une boite de|plein de|trop de|"
        r"toute la boite de) (?:pilules|medicaments|cachets|comprimes|somniferes)\b",
        "fr",
    ),
    # Looking up methods.
    (r"\b(?:ways|how|methods?) to (?:die|kill myself|end it|end my life)\b", "en"),
    (r"\b(?:comment|facons? de|moyens? de|methodes? pour) (?:me tuer|mourir|en finir|me suicider)\b", "fr"),
    # Wishing never to have been born.
    (r"\bnever (?:been|be|was|were) born\b", "en"),
    (r"\bjamais (?:etre )?naitre\b|\b(?:jamais|pas) ete (?:ne|nee)\b", "fr"),
    # Wanting the pain or everything to stop for good; a bare "end it" with a time.
    (r"\b(?:pain|everything|it all|it|this|the hurt) to (?:stop|end) (?:forever|for good)\b", "en"),
    (r"\bend it (?:tonight|today|tomorrow|soon|now|this week|for good)\b|\bthe night i end it\b", "en"),
    (r"\b(?:tout )?arreter pour (?:toujours|de bon)\b|\bm?endormir pour (?:toujours|de bon)\b", "fr"),
)
_CRISIS_PATTERNS: Tuple[Tuple[Pattern[str], Optional[str]], ...] = tuple(
    (re.compile(rx), lang) for rx, lang in _CRISIS_PHRASES
)
_FRENCH_HINTS = re.compile(r"\b(?:je|jai|suis|veux|moi|pas|mes|mon|vie|envie|pense|penser|au|des)\b")
_DELEET = str.maketrans({"1": "i", "3": "e", "0": "o", "4": "a", "@": "a", "$": "s"})


def crisis_check(user_text: str) -> GateResult:
    """Deterministic crisis gate on the user's text. Case-, accent- and punctuation-insensitive.

    A hit returns a fixed reply in French when the text reads as French, else in English.
    """
    text = normalise_user_text(user_text)
    if not text:
        return GateResult(hit=False)
    deleeted = normalise_user_text((user_text or "").translate(_DELEET))
    langs = [lang for rx, lang in _CRISIS_PATTERNS if rx.search(text) or rx.search(deleeted)]
    if not langs:
        return GateResult(hit=False)
    french = "fr" in langs or ("en" not in langs and bool(_FRENCH_HINTS.search(text)))
    return GateResult(hit=True, reply=CRISIS_REPLY_FR if french else CRISIS_REPLY_EN)


# The user raises a diagnosis, a condition, a symptom or medication (English, plus French words as
# they read after accent stripping). Detection only. Narrower than the output list on purpose:
# "patient", "decline" or "anxious" are everyday words in user text, and "do I have…" alone is
# usually about time or tries, so a question only counts when it names a topic or asks to be
# assessed outright.
_HEALTH_TOPICS = re.compile(
    r"\b(?:adhd|tdah|autis\w*|dementia|demence|alzheimer\w*|dyslexi\w*|depress(?:ion|ed)|"
    r"bipolar\w*|schizophren\w*|ocd|parkinson\w*|(?:had|having|have) a stroke|avc|concussion|"
    r"commotion cerebrale|brain (?:damage|injury|tumou?r)|memory loss|perte de memoire|"
    r"disabilit(?:y|ies)|disabled|handicap\w*|disorders?|trouble (?:de|du|des)|diagnos\w*|"
    r"symptom\w*|medication|medicament\w*|supplements?|complements? alimentaires?|"
    r"anxiety disorder|panic attacks?|crise dangoisse|seizures?|epilep\w*)\b"
)
_ASSESS_ME = re.compile(r"\b(?:am i (?:sick|ill|normal|mentally ill)|diagnose me|suis je malade)\b")


def health_signpost(user_text: str) -> GateResult:
    """The user raises health: point to a doctor, never assess, never relabel their words."""
    text = normalise_user_text(user_text)
    if text and (_HEALTH_TOPICS.search(text) or _ASSESS_ME.search(text)):
        return GateResult(hit=True, reply=HEALTH_SIGNPOST_REPLY)
    return GateResult(hit=False)


class SafetyGuardrailEngine:
    """Output lint for Loti's replies, plus the two input gates as methods."""

    def __init__(self, strict_mode: bool = True):
        self.strict_mode = strict_mode

    # Part 1: output ---------------------------------------------------------------------------

    def check_safety(self, text: str) -> SafetyMetadata:
        """Lint a reply against banned_terms.json. Reports matches; changes nothing."""
        hits = lint_text(text)
        if not hits:
            return SafetyMetadata(is_safe=True)
        return SafetyMetadata(
            is_safe=False,
            clinical_terms_detected=sorted({term.strip() for _, term in hits}),
            sanitized=False,
            violations=[
                SafetyViolation(
                    detected_phrase=term.strip(),
                    rule_category=rule.category,
                    remediation_applied="Reply withheld; fixed fallback sent.",
                )
                for rule, term in hits
            ],
        )

    def sanitize(self, text: str, fallback: str = SAFE_FALLBACK_REPLY) -> Tuple[str, SafetyMetadata]:
        """Return `text` if it is clean, else `fallback` whole. Never rewrites words.

        `fallback` must itself be lint-clean (callers pass pre-checked deterministic copy).
        """
        meta = self.check_safety(text)
        if meta.is_safe:
            return text, meta
        meta.sanitized = True
        return fallback, meta

    # Part 2: input gates ------------------------------------------------------------------------

    @staticmethod
    def crisis_check(user_text: str) -> GateResult:
        return crisis_check(user_text)

    @staticmethod
    def health_signpost(user_text: str) -> GateResult:
        return health_signpost(user_text)

    def is_diagnostic_inquiry(self, text: str) -> bool:
        """True when the user asks about or names a health condition."""
        return health_signpost(text).hit

    def wrap_with_disclaimer_if_needed(self, text: str, user_prompt: str = "") -> str:
        """Append the doctor signpost and non-clinical note when the user raised health."""
        if self.is_diagnostic_inquiry(user_prompt):
            return f"{text}\n\n{DISCLAIMER_TEXT}"
        return text

    @staticmethod
    def get_system_prompt_guardrails() -> str:
        """Safety rules injected into the LLM system prompt. Contains no banned term itself."""
        return (
            "SAFETY RULES:\n"
            "1. You are an AI guide, not a doctor or therapist. You never assess health.\n"
            "2. Never use medical or health labels, and never guess at one.\n"
            "3. Never name parts of the brain or body chemicals.\n"
            "4. Never claim practice changes the brain itself, or helps outside these exercises.\n"
            "5. If the person raises health, say: \"I can't assess health. A doctor can.\"\n"
            "6. Only use numbers that appear in the context below. Never invent one.\n"
        )
