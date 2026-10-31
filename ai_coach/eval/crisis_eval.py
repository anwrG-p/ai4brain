"""Crisis routing eval: the keyword gate, then the backup classifier, on the BE-05 sets.

Run from the repo root:
    python -m ai_coach.eval.crisis_eval              # keyword only + mocked modes, + live if a key is set
    python -m ai_coach.eval.crisis_eval --sleep 6    # live, at most 10 requests a minute (free tier)

Sets (read from tests/test_coach_module.py with `ast`, never imported or executed):
- HELD_OUT_CRISIS (19): crisis phrasings never used to tune the keyword gate.
- BENIGN_HELD_OUT (20): benign messages never used to tune it.
- BENIGN_TRAINING_MESSAGES (54): benign messages that shaped the gate (a regression list).

Routing per message: "keyword" (gate hit), "high" / "low" (classifier verdicts; both get a fixed
crisis reply), "none" (on to the coach), "error" (the classifier failed: fail closed, so the
offline reply goes out and the coach LLM is not called, but no crisis reply either).

Modes:
- keyword: the gate alone (no classifier), today's floor.
- mock_oracle: a mocked classifier that knows the labels. A pipeline check only: it shows the
  composition routes what the classifier flags. It measures nothing about any model.
- mock_error: a classifier that always fails. Shows fail-closed routing: no LLM, no crisis reply.
- live: Gemini through GeminiRunner, only when GEMINI_API_KEY is set.

CAVEAT for live numbers: the classifier prompt was written by someone who had read these sets, so
they are optimistic. A fresh set written blind to the prompt is the honest measure.
"""

from __future__ import annotations

import argparse
import ast
import json
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Callable, Dict, List, Optional

from ai_coach.crisis_classifier import ClassifierError, CrisisClassifier
from ai_coach.safety_guardrails import crisis_check

REPO_ROOT = Path(__file__).resolve().parents[2]
TEST_FILE = REPO_ROOT / "tests" / "test_coach_module.py"
CRISIS_SET = "HELD_OUT_CRISIS"
BENIGN_SETS = ("BENIGN_HELD_OUT", "BENIGN_TRAINING_MESSAGES")
ROUTES = ("keyword", "high", "low", "none", "error")


def load_sets(path: Path = TEST_FILE) -> Dict[str, List[str]]:
    """The three lists, parsed as literals from the test file."""
    wanted = {CRISIS_SET, *BENIGN_SETS}
    found: Dict[str, List[str]] = {}
    for node in ast.parse(path.read_text(encoding="utf-8")).body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in wanted:
                    found[target.id] = list(ast.literal_eval(node.value))
    missing = wanted - set(found)
    if missing:
        raise ValueError(f"not found in {path.name}: {sorted(missing)}")
    return found


def route(message: str, classifier: Optional[CrisisClassifier]) -> str:
    if crisis_check(message).hit:
        return "keyword"
    if classifier is None:
        return "none"
    try:
        return classifier.classify(message).risk.value
    except ClassifierError:
        return "error"


def evaluate(
    classifier: Optional[CrisisClassifier],
    sets: Optional[Dict[str, List[str]]] = None,
    pause_s: float = 0.0,
) -> Dict[str, Dict]:
    """Route counts per set, plus crisis_routed = keyword + high + low."""
    sets = sets or load_sets()
    report: Dict[str, Dict] = {}
    for name, messages in sets.items():
        counts = Counter({r: 0 for r in ROUTES})
        for m in messages:
            r = route(m, classifier)
            counts[r] += 1
            if pause_s and r not in ("keyword",):
                time.sleep(pause_s)
        routed = counts["keyword"] + counts["high"] + counts["low"]
        report[name] = {"n": len(messages), **dict(counts), "crisis_routed": routed}
    return report


def summary(report: Dict[str, Dict]) -> Dict[str, str]:
    """Crisis recall on the held-out crisis set; false crisis routes on each benign set."""
    out = {}
    c = report[CRISIS_SET]
    out["held-out crisis routed to a crisis reply"] = f"{c['crisis_routed']}/{c['n']}"
    out["held-out crisis failed closed (classifier error)"] = f"{c['error']}/{c['n']}"
    for name in BENIGN_SETS:
        b = report[name]
        out[f"{name} routed to a crisis reply (false)"] = f"{b['crisis_routed']}/{b['n']}"
    return out


# -- mocked classifiers (tests and the default run) ----------------------------------------------


def oracle_classifier(sets: Dict[str, List[str]]) -> CrisisClassifier:
    crisis = set(sets[CRISIS_SET])

    def complete(system: str, payload: str) -> str:
        message = json.loads(payload)["current_user_message"]
        risk = "high" if message in crisis else "none"
        return json.dumps({"risk": risk, "reason": "mocked label"})

    return CrisisClassifier(complete)


def error_classifier() -> CrisisClassifier:
    def complete(system: str, payload: str) -> str:
        raise TimeoutError("mocked timeout")

    return CrisisClassifier(complete)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m ai_coach.eval.crisis_eval")
    parser.add_argument("--sleep", type=float, default=0.0, help="seconds between live calls")
    args = parser.parse_args(argv)

    try:  # backend/.env, the same file the server reads; optional
        from backend.app.settings import load_env_file

        load_env_file()
    except ImportError:
        pass
    from ai_coach.llm_gemini import GeminiRunner

    sets = load_sets()
    modes: Dict[str, Callable[[], Optional[CrisisClassifier]]] = {
        "keyword": lambda: None,
        "mock_oracle": lambda: oracle_classifier(sets),
        "mock_error": error_classifier,
    }
    runner = GeminiRunner.from_env()
    if runner is not None:
        modes["live"] = lambda: CrisisClassifier.from_runner(runner)
    results = {}
    for mode, make in modes.items():
        pause = args.sleep if mode == "live" else 0.0
        report = evaluate(make(), sets, pause)
        results[mode] = {"summary": summary(report), "counts": report}
    if runner is None:
        results["live"] = "skipped: no GEMINI_API_KEY in the environment or backend/.env"
    else:
        results["live_model"] = runner.model
    print(json.dumps(results, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
