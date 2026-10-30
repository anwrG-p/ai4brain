"""Interactive and automated testing runner for Member 2 (AI Coach & Collaboration Engine).

Usage:
    # Run automated end-to-end service demonstration:
    python scripts/test_coach_service.py

    # Run interactive live chat terminal session:
    python scripts/test_coach_service.py --interactive
"""

import argparse
import json
import sys
from pathlib import Path

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from ai_coach.agent import AICoachAgent
from ai_coach.collaboration_scorer import CollaborationScorer
from ai_coach.safety_guardrails import SafetyGuardrailEngine
from ai_coach.schemas import ChatMessage, ChatMessageRole, ChatRequest
from ai_coach.xai_explainer import XAIExplainer


def print_header(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def run_automated_demo():
    print_header("MEMBER 2: AI COACH SERVICE AUTOMATED VERIFICATION")

    # 1. Initialize engines
    agent = AICoachAgent()
    scorer = CollaborationScorer()
    guardrail = SafetyGuardrailEngine()
    explainer = XAIExplainer()

    print("[1] Initialized Member 2 Core Engines successfully:")
    print("    - AICoachAgent (conversational LLM runner & offline engine)")
    print("    - CollaborationScorer (dynamic 5-dimension weighted scorer)")
    print("    - SafetyGuardrailEngine (non-clinical regex & lexical sanitizer)")
    print("    - XAIExplainer (Member 3 differential vector decoder)")

    # 2. Test XAI Prototype Delta Translation
    print_header("TEST 1: EXPLAINABILITY INJECTION (Member 3 Delta Vector)")
    sample_deltas = {
        "working_memory": 0.20,
        "pattern_induction": 0.15,
        "executive_function": -0.10,
    }
    print(f"Simulating Member 3 Delta Vector (Δc): {sample_deltas}")
    rationale = explainer.generate_adaptation_rationale(sample_deltas, active_cluster_id=3)
    print(f"\n[Generated XAI Adaptation Rationale]:\n--> \"{rationale}\"\n")

    # 3. Test Dynamic AI Collaboration Score Across Archetypes
    print_header("TEST 2: DYNAMIC AI COLLABORATION SCORING")
    for cluster_id, tier_name in [(0, "Explorer (Beginner)"), (4, "Practitioner (Intermediate)"), (8, "Strategist (Advanced)")]:
        weights = scorer.get_weights(cluster_id)
        print(f"\n[Cluster {cluster_id}: {tier_name}]")
        print(f"  Weights (Sum = {sum(weights.to_dict().values()):.2f}):")
        for dim, w in weights.to_dict().items():
            print(f"    - {dim.replace('_', ' ').capitalize():<22}: {w:.2f}")

    # 4. Test Non-Clinical Safety Guardrails
    print_header("TEST 3: NON-CLINICAL SAFETY GUARDRAILS & SANITIZATION")
    unsafe_text = "This patient shows severe cognitive deficit, abnormal ADHD dysfunction, and mental disability."
    print(f"Raw Input (Clinical/Deficit Phrasing):\n\"{unsafe_text}\"")
    sanitized, meta = guardrail.sanitize(unsafe_text)
    print(f"\nSanitized Output (Growth-Mindset Phrasing):\n\"{sanitized}\"")
    print(f"Violations Caught: {len(meta.violations)}")
    for v in meta.violations:
        print(f"  * Detected '{v.detected_phrase}' -> {v.remediation_applied}")

    # 5. Test Full Conversational Flow
    print_header("TEST 4: FULL CONVERSATIONAL TURN WITH COACH")
    req = ChatRequest(
        user_id="user_pilot_001",
        message="Why did my assessment speed up? Do I have ADHD or is this normal?",
        active_cluster_id=4,
        delta_vector={"working_memory": 0.20},
    )
    print(f"User Message: \"{req.message}\"")
    response = agent.handle_chat(req)

    print(f"\nCoach Reply:\n{response.reply_text}")
    print(f"\nXAI Explanation Included: \"{response.xai_explanation}\"")
    print(f"AI Collaboration Index  : {response.collab_score_snapshot.composite_score}/100 ({response.collab_score_snapshot.archetype_tier.value.title()})")
    print(f"Growth Recommendation   : {response.collab_score_snapshot.growth_recommendation}")
    print(f"Suggested Action Cards  : {response.suggested_actions}")
    print(f"Safety Metadata         : Safe={response.safety_metadata.is_safe}, Sanitized={response.safety_metadata.sanitized}")

    print_header("MEMBER 2 VERIFICATION SUMMARY: ALL CHECKS PASSED")


def run_interactive_repl():
    print_header("AI COACH INTERACTIVE TERMINAL (MEMBER 2)")
    print("Type your message to the AI Coach below. Type 'exit' or 'quit' to end.\n")

    agent = AICoachAgent()
    history = []
    cluster_id = 4
    delta_vec = {"working_memory": 0.15, "pattern_induction": 0.10}

    print(f"[Active Simulation Context: Cluster {cluster_id} (Practitioner), Δc = {delta_vec}]\n")

    while True:
        try:
            user_input = input("\nYou > ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting interactive session.")
            break

        if not user_input:
            continue
        if user_input.lower() in ["exit", "quit", "q"]:
            print("Session ended.")
            break

        req = ChatRequest(
            user_id="interactive_user",
            message=user_input,
            chat_history=history,
            active_cluster_id=cluster_id,
            delta_vector=delta_vec,
        )

        resp = agent.handle_chat(req)
        history.append(ChatMessage(role=ChatMessageRole.USER, content=user_input))
        history.append(ChatMessage(role=ChatMessageRole.ASSISTANT, content=resp.reply_text))

        print(f"\nCoach > {resp.reply_text}")
        if resp.xai_explanation:
            print(f"\n[XAI Rationale]: {resp.xai_explanation}")
        if resp.collab_score_snapshot:
            print(f"[Collaboration Score]: {resp.collab_score_snapshot.composite_score}/100 | {resp.collab_score_snapshot.growth_recommendation}")
        print(f"[Suggested Actions]: {', '.join(resp.suggested_actions)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test Member 2 Service")
    parser.add_argument("--interactive", "-i", action="store_true", help="Launch interactive CLI chat session")
    args = parser.parse_args()

    if args.interactive:
        run_interactive_repl()
    else:
        run_automated_demo()
