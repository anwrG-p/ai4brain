"""Comprehensive test suite for Member 2 (AI Coach & Collaboration Engine)."""

import json
import logging
import re
from pathlib import Path

import pytest
from ai_coach import agent as agent_module
from ai_coach.agent import MAX_BUBBLE_WORDS, AICoachAgent, split_bubbles
from ai_coach.collaboration_scorer import (
    ARCHETYPE_WEIGHT_PROFILES,
    CollaborationScorer,
)
from ai_coach.safety_guardrails import (
    BANNED_RULES,
    BANNED_TERMS_PATH,
    CLINICAL_TERM_REPLACEMENTS,
    COACH_ONLY_RULES,
    CRISIS_REPLY_EN,
    CRISIS_REPLY_FR,
    DISCLAIMER_TEXT,
    HEALTH_SIGNPOST_REPLY,
    SAFE_FALLBACK_REPLY,
    SHARED_RULES,
    SafetyGuardrailEngine,
    crisis_check,
    health_signpost,
    lint_text,
)
from ai_coach.schemas import (
    PILLAR_LABELS,
    ArchetypeTier,
    ChatMessage,
    ChatMessageRole,
    ChatRequest,
    CognitiveDimension,
    DimensionScores,
    DimensionWeights,
    GateResult,
    PillarId,
    ReplySource,
)
from ai_coach.xai_explainer import XAIExplainer
import src.coach as src_coach

REPO_ROOT = Path(__file__).resolve().parents[1]
COPY_LINTER_TS = REPO_ROOT / "frontend" / "src" / "utils" / "copyLinter.ts"
PILLARS_TS = REPO_ROOT / "frontend" / "src" / "features" / "insights" / "pillars.ts"
PROMPTS_DIR = REPO_ROOT / "ai_coach" / "prompts"


class TestSafetyGuardrails:
    """Tests for non-clinical guardrails and lexical filters."""

    def setup_method(self):
        self.guardrail = SafetyGuardrailEngine()

    def test_clean_growth_mindset_text_is_safe(self):
        clean_text = (
            "Your working memory sequence stability improved by 15% through repeated practice. "
            "Focus on pacing and strategic chunking heuristics."
        )
        meta = self.guardrail.check_safety(clean_text)
        assert meta.is_safe is True
        assert len(meta.clinical_terms_detected) == 0

    def test_detects_prohibited_clinical_terms(self):
        clinical_text = "The user exhibits signs of ADHD and mild cognitive impairment with abnormal dysfunction."
        meta = self.guardrail.check_safety(clinical_text)
        assert meta.is_safe is False
        detected = [t.lower() for t in meta.clinical_terms_detected]
        assert any("adhd" in t for t in detected)
        assert any("cognitive impairment" in t for t in detected)
        assert any("abnormal" in t for t in detected)
        assert any("dysfunction" in t for t in detected)

    def test_sanitize_withholds_the_reply_instead_of_rewriting_it(self):
        # BE-05 replaced the old rewrite map ("patient" -> "learner", "deficit" -> "targeted growth
        # opportunity"): a reply with a banned term is withheld whole, never reworded.
        clinical_text = "Treating this patient for cognitive deficit and neurological disorder."
        sanitized, meta = self.guardrail.sanitize(clinical_text, fallback="Let's try a round.")
        assert meta.sanitized is True
        assert sanitized == "Let's try a round."
        assert "learner" not in sanitized.lower()
        assert "targeted growth opportunity" not in sanitized.lower()

    def test_diagnostic_inquiry_detection_and_disclaimer(self):
        user_prompt = "Do I have ADHD or dementia?"
        assert self.guardrail.is_diagnostic_inquiry(user_prompt) is True

        reply = "Let's focus on exercises to strengthen your working memory and attention pacing."
        wrapped = self.guardrail.wrap_with_disclaimer_if_needed(reply, user_prompt=user_prompt)
        assert "non-clinical cognitive fitness" in wrapped
        assert "do not provide medical or psychiatric diagnoses" in wrapped


class TestCollaborationScorer:
    """Tests for Dynamic AI Collaboration Scoring engine."""

    def setup_method(self):
        self.scorer = CollaborationScorer()

    def test_all_archetype_weights_sum_to_one(self):
        for cluster_id in range(9):
            weights: DimensionWeights = self.scorer.get_weights(cluster_id)
            w_dict = weights.to_dict()
            total_sum = sum(w_dict.values())
            assert pytest.approx(total_sum, rel=1e-3) == 1.0, f"Cluster {cluster_id} weights must sum to 1.0"

    def test_weight_distribution_shift_across_archetypes(self):
        # Explorer (cluster 0): Clarification + Iteration should dominate
        w_explorer = self.scorer.get_weights(0).to_dict()
        assert w_explorer["clarification"] >= 0.30
        assert w_explorer["iteration"] >= 0.30
        assert w_explorer["autonomy"] <= 0.15

        # Strategist (cluster 8): Critical Verification + Autonomy should dominate
        w_strategist = self.scorer.get_weights(8).to_dict()
        assert w_strategist["critical_verification"] >= 0.30
        assert w_strategist["autonomy"] >= 0.35
        assert w_strategist["clarification"] <= 0.10

    def test_composite_score_calculation(self):
        # Cluster 4 (balanced weights: 0.20 each)
        dims = DimensionScores(
            clarification=80.0,
            critical_verification=70.0,
            iteration=90.0,
            autonomy=60.0,
            responsible_use=100.0,
        )
        res = self.scorer.calculate_score(dims, cluster_id=4)
        expected = (80.0 * 0.20) + (70.0 * 0.20) + (90.0 * 0.20) + (60.0 * 0.20) + (100.0 * 0.20)
        assert pytest.approx(res.composite_score, abs=0.1) == expected
        assert res.archetype_tier == ArchetypeTier.PRACTITIONER
        assert res.growth_recommendation != ""

    def test_interaction_signals_evaluation(self):
        chat_history = [
            ChatMessage(role=ChatMessageRole.USER, content="Could you clarify how this matrix pattern works? Why is this rule applied?"),
            ChatMessage(role=ChatMessageRole.ASSISTANT, content="Here is how the transformation functions..."),
            ChatMessage(role=ChatMessageRole.USER, content="Are you sure? What if we rotate counterclockwise instead? I verified the alternative."),
        ]
        dims = self.scorer.evaluate_interaction_signals(chat_history)
        assert dims.clarification > 40.0
        assert dims.critical_verification > 40.0
        assert dims.iteration > 30.0


class TestXAIExplainer:
    """Tests for Member 3 Prototype Differential Vector Δc translation."""

    def setup_method(self):
        self.explainer = XAIExplainer()

    def test_positive_working_memory_delta(self):
        delta = {"working_memory": 0.20}
        rationale = self.explainer.generate_adaptation_rationale(delta, active_cluster_id=2)
        # Exercise-level wording (controller ruling on the BE-05 review): no improvement claim.
        assert rationale == (
            "We adjusted the working memory pacing and added an item to remember. Your last few rounds were steady."
        )
        assert "pacing" in rationale

    @pytest.mark.parametrize("dim", [d.value for d in CognitiveDimension] + ["unknown_skill"])
    @pytest.mark.parametrize("delta", [0.3, 0.06, -0.06, -0.3])
    @pytest.mark.parametrize("uncertainty", [0.0, 0.9])
    def test_no_rationale_claims_improvement_or_quotes_a_percentage(self, dim, delta, uncertainty):
        texts = [
            self.explainer.generate_adaptation_rationale({dim: delta}, active_cluster_id=4, uncertainty=uncertainty),
            self.explainer.generate_adaptation_rationale({}, active_cluster_id=4),
            self.explainer.generate_adaptation_rationale({dim: 0.01}, active_cluster_id=4),
        ]
        for text in texts:
            assert "improv" not in text.lower(), text
            assert "%" not in text, text

    def test_negative_pattern_induction_delta(self):
        delta = {"pattern_induction": -0.15}
        rationale = self.explainer.generate_adaptation_rationale(delta, active_cluster_id=1)
        assert "scaffolded visual contrast cues" in rationale or "matrix" in rationale

    def test_prompt_context_formatting(self):
        delta = {"working_memory": 0.20, "executive_function": -0.10}
        prompt_block = self.explainer.format_xai_prompt_context(
            delta_vector=delta,
            cluster_id=3,
        )
        assert "Active Cognitive Archetype Index: Cluster 3" in prompt_block
        assert "working_memory: +20.0%" in prompt_block
        assert "executive_function: -10.0%" in prompt_block


class TestAICoachAgent:
    """End-to-end conversational agent testing."""

    def setup_method(self):
        self.agent = AICoachAgent()

    def test_handle_chat_turn_with_xai_and_guardrails(self):
        req = ChatRequest(
            user_id="user_123",
            message="Why did the task get faster? Could you explain the new timing?",
            active_cluster_id=3,
            delta_vector={"working_memory": 0.20},
        )
        resp = self.agent.handle_chat(req)
        assert resp.xai_explanation is not None
        assert "working memory" in resp.xai_explanation.lower()
        assert resp.collab_score_snapshot is not None
        assert 0.0 <= resp.collab_score_snapshot.composite_score <= 100.0
        assert resp.safety_metadata.is_safe is True
        assert len(resp.suggested_actions) >= 2

    def test_custom_llm_callable_with_safety_sanitization(self):
        # Simulate an LLM that mistakenly output a clinical word
        def mock_llm_runner(messages):
            return "You did well, but your ADHD deficit is noticeable."

        agent = AICoachAgent(llm_callable=mock_llm_runner)
        req = ChatRequest(
            user_id="user_test",
            message="How did I do on the last test?",
            active_cluster_id=1,
        )
        resp = agent.handle_chat(req)
        # Verify guardrail sanitized the output
        assert "adhd" not in resp.reply_text.lower()
        assert "deficit" not in resp.reply_text.lower()
        assert resp.safety_metadata.sanitized is True

    def test_generate_learning_path(self):
        curriculum = self.agent.generate_learning_path(
            user_id="user_456",
            cluster_id=7,
            delta_vector={"spatial_orientation": 0.15},
        )
        assert curriculum["user_id"] == "user_456"
        assert curriculum["archetype_tier"] == ArchetypeTier.STRATEGIST.value
        assert len(curriculum["modules"]) >= 3
        assert curriculum["safety_certified"] is True


class TestSrcCoachCompatibility:
    """Verify src/coach re-exports match README deliverables."""

    def test_imports_match(self):
        assert hasattr(src_coach, "AICoachAgent")
        assert hasattr(src_coach, "CollaborationScorer")
        assert hasattr(src_coach, "SafetyGuardrailEngine")
        assert hasattr(src_coach, "XAIExplainer")


# ---------------------------------------------------------------------------------------------
# BE-05: domain alignment
# ---------------------------------------------------------------------------------------------


class TestDomainEnums:
    def test_episodic_memory_is_a_dimension(self):
        # The six telemetry dimensions, written out so ai_coach stays independent of any server.
        assert CognitiveDimension("episodic_memory") is CognitiveDimension.EPISODIC_MEMORY
        assert {d.value for d in CognitiveDimension} == {
            "working_memory",
            "pattern_induction",
            "executive_function",
            "spatial_orientation",
            "processing_speed",
            "episodic_memory",
        }

    def test_pillar_ids_and_labels_match_the_frontend(self):
        source = PILLARS_TS.read_text(encoding="utf-8")
        ids = re.search(r"PILLAR_IDS = \[([^\]]*)\]", source)
        assert ids, "PILLAR_IDS not found in pillars.ts"
        assert [p.value for p in PillarId] == re.findall(r"'([a-z]+)'", ids.group(1))
        labels = dict(re.findall(r"^\s+([a-z]+): '([^']+)',$", source.split("PILLAR_LABELS")[1].split("}")[0], re.M))
        assert {p.value: PILLAR_LABELS[p] for p in PillarId} == labels

    def test_episodic_memory_has_its_own_rationale(self):
        rationale = XAIExplainer().generate_adaptation_rationale({"episodic_memory": 0.12}, active_cluster_id=2)
        assert rationale == "We added closer look-alikes. Your last few rounds were steady."
        assert "improved" not in rationale and "%" not in rationale


def _parse_copy_linter_rules(source: str):
    """Pull BANNED_RULES out of copyLinter.ts: (pattern, flags, termLabel, category, suggestion)."""
    block = source.split("export const BANNED_RULES")[1].split("\n]")[0]
    rule_rx = re.compile(
        r"\{\s*pattern:\s*/(?P<src>(?:\\/|[^/\n])+)/(?P<flags>[a-z]*),\s*"
        r"termLabel:\s*(?P<q1>['\"])(?P<label>.*?)(?P=q1),\s*"
        r"category:\s*'(?P<cat>[a-z_]+)',\s*"
        r"replacementSuggestion:\s*(?P<q2>['\"])(?P<sugg>.*?)(?P=q2),\s*\}",
        re.S,
    )
    rules = [
        (m["src"], m["flags"], m["label"], m["cat"], m["sugg"]) for m in rule_rx.finditer(block)
    ]
    assert len(rules) == block.count("pattern:"), "a copyLinter rule did not parse; update the parser"
    return rules


class TestBannedTermsParity:
    """One banned list: `shared` in banned_terms.json must equal copyLinter.ts BANNED_RULES."""

    def test_shared_rules_match_copy_linter_rule_for_rule(self):
        ts_rules = _parse_copy_linter_rules(COPY_LINTER_TS.read_text(encoding="utf-8"))
        json_rules = [
            (r["pattern"], r["flags"], r["termLabel"], r["category"], r["replacementSuggestion"])
            for r in json.loads(BANNED_TERMS_PATH.read_text(encoding="utf-8"))["shared"]
        ]
        assert json_rules == ts_rules

    def test_every_rule_compiles_and_python_matches_like_js(self):
        assert len(BANNED_RULES) == len(SHARED_RULES) + len(COACH_ONLY_RULES)
        # The JS lookbehind on "diagnosis" is emulated in Python.
        assert lint_text("This is not a diagnosis.") == []
        assert lint_text("A non-diagnostic estimate.") == []
        assert [t for _, t in lint_text("Your diagnosis is ready.")] == ["diagnosis"]
        assert [t for _, t in lint_text("You broke your 7-day streak")] == ["broke your 7-day streak"]

    @pytest.mark.parametrize(
        "text",
        [
            "Practice grows your neuroplasticity.",
            "This lights up your prefrontal cortex.",
            "Your hippocampus is working hard.",
            "Each win gives you a dopamine hit.",
            "Colours that lower cortisol.",
            "We will rewire your brain.",
            "You'll be smarter at work.",
            "You scored better than 80% of players.",
        ],
    )
    def test_u5_and_claim_terms_are_banned_in_loti_output(self, text):
        assert lint_text(text), text


class TestPromptsInLotisVoice:
    def _all_prompt_text(self):
        agent = AICoachAgent()
        assembled = agent.assemble_system_prompt(cluster_id=3, delta_vector={"working_memory": 0.2})
        files = [p.read_text(encoding="utf-8") for p in sorted(PROMPTS_DIR.glob("*.txt"))]
        return [assembled, *files]

    def test_prompts_contain_no_banned_or_u5_terms(self):
        for text in self._all_prompt_text():
            hits = [(r.term_label, t) for r, t in lint_text(text)]
            assert hits == [], hits
            lowered = text.lower()
            for word in ("neuroplastic", "neuro", "brain region", "cortex", "dopamine", "cognitive fitness coach"):
                assert word not in lowered, word

    def test_system_prompt_is_loti_with_the_12_word_rule(self):
        prompt = (PROMPTS_DIR / "system_coach.txt").read_text(encoding="utf-8")
        assert prompt.startswith("You are Loti")
        assert "12 words per bubble" in prompt
        assert "not a person, a doctor or a therapist" in prompt

    @pytest.mark.parametrize(
        "message,cluster",
        [
            ("Why did it get harder?", 3),
            ("What is my score?", 4),
            ("hello", 0),
            ("hello", 4),
            ("hello", 8),
        ],
    )
    def test_offline_replies_are_short_bubbles_and_lint_clean(self, message, cluster):
        resp = AICoachAgent().handle_chat(ChatRequest(user_id="u", message=message, active_cluster_id=cluster))
        assert resp.reply_source == ReplySource.OFFLINE
        bubbles = split_bubbles(resp.reply_text)
        assert 1 <= len(bubbles) <= 3
        for bubble in bubbles:
            assert len(bubble.split()) <= MAX_BUBBLE_WORDS, bubble
        assert lint_text(resp.reply_text) == []

    def test_fixed_replies_are_lint_clean(self):
        for text in (SAFE_FALLBACK_REPLY, HEALTH_SIGNPOST_REPLY, DISCLAIMER_TEXT, CRISIS_REPLY_EN):
            assert lint_text(text) == [], text
        assert len(SAFE_FALLBACK_REPLY.split()) <= MAX_BUBBLE_WORDS
        assert len(HEALTH_SIGNPOST_REPLY.split()) <= MAX_BUBBLE_WORDS


# ---------------------------------------------------------------------------------------------
# Research backlog #1 (backend half): crisis layer and signposting instead of euphemism
# ---------------------------------------------------------------------------------------------


class TestNoEuphemism:
    def test_rewrite_map_is_gone(self):
        assert CLINICAL_TERM_REPLACEMENTS == {}
        old_euphemisms = (
            "cognitive endurance challenge",
            "distinct cognitive modality",
            "adaptive neural restructuring",
            "divergent attentional style",
            "learner",
            "growth opportunity",
        )
        engine = SafetyGuardrailEngine()
        for word in ("dementia", "disability", "brain injury", "ADHD", "patient", "deficit"):
            out, _ = engine.sanitize(f"Note on {word} here.")
            assert not any(e in out for e in old_euphemisms), out

    @pytest.mark.parametrize(
        "llm_text",
        [
            "Your dementia risk looks like a cognitive endurance challenge.",
            "With your disability, try this.",
            "Brain injury can slow you down.",
        ],
    )
    def test_output_with_health_words_is_withheld_not_reworded(self, llm_text):
        out, meta = SafetyGuardrailEngine().sanitize(llm_text)
        assert meta.sanitized is True
        assert out == SAFE_FALLBACK_REPLY
        for euphemism in ("cognitive endurance challenge", "distinct cognitive modality", "adaptive neural restructuring"):
            assert euphemism not in out

    @pytest.mark.parametrize(
        "message",
        [
            "I think I might have dementia, my memory is bad",
            "I have a disability, can I still play?",
            "Do I have ADHD?",
            "My doctor said it's a brain injury",
            "Est-ce que j'ai un TDAH ?",
            "Should I take supplements for memory?",
        ],
    )
    def test_user_raising_health_gets_the_doctor_signpost_and_no_llm(self, message):
        calls = []
        agent = AICoachAgent(llm_callable=lambda msgs: calls.append(msgs) or "Sure!")
        resp = agent.handle_chat(ChatRequest(user_id="u", message=message))
        assert resp.reply_source == ReplySource.HEALTH_SIGNPOST
        assert resp.reply_text == "I can't assess health. A doctor can."
        assert calls == []

    def test_user_words_reach_the_llm_unchanged(self):
        seen = []
        agent = AICoachAgent(llm_callable=lambda msgs: seen.append(msgs) or "Nice work today.")
        message = "Patient mode please: I decline the hint and feel behind."
        agent.handle_chat(ChatRequest(user_id="u", message=message))
        assert seen[0][-1] == {"role": "user", "content": message}

    @pytest.mark.parametrize(
        "message",
        ["Do I have time for one more round?", "I'm being patient with this timer", "I decline the hint"],
    )
    def test_everyday_words_do_not_trigger_the_signpost(self, message):
        assert health_signpost(message) == GateResult(hit=False)


class TestCrisisCheck:
    @pytest.mark.parametrize(
        "text",
        [
            "I want to kill myself",
            "I want to KILL myself!!!",
            "thinking about SUICIDE",
            "i feel suicidal",
            "self-harm again",
            "self harm",
            "selfharm",
            "I want to hurt myself",
            "I can't go on",
            "i cant go on anymore",
            "I can’t go on",
            "I cannot go on",
            "I want to end my life",
            "I want to end it all",
            "I wanna die",
            "I don't want to live anymore",
            "everyone would be better off dead without me",
            "I'm not safe right now",
            "thinking of taking an overdose",
            # Review probe (BE-05 fix round): inflections, slang, misspellings, missing phrases.
            "kms",
            "I'm going to kms tonight",
            "i want to kil myself",
            "thinking about sucide",
            "suicde",
            "I don't want to be here anymore",
            "I've been cutting myself again",
            "I keep hurting myself",
            "thinking about killing myself",
            "I'm thinking of ending my life",
            "taking my own life",
            "i want to unalive myself",
            "no point in living anymore",
            "I wish I could disappear forever",
            "I want it all to stop, I can't do this anymore",
            "Im done with life",
            "I want to die",
            "i wanna d1e",
            "I mutilate myself",
        ],
    )
    def test_english_crisis_phrases_are_caught(self, text):
        result = crisis_check(text)
        assert result.hit is True
        assert result.reply == CRISIS_REPLY_EN

    @pytest.mark.parametrize(
        "text",
        [
            "Je veux me tuer",
            "j'ai envie de mourir",
            "J’ai envie de mourir…",
            "je pense au suicide",
            "Je veux me suicider",
            "J'ai des idées noires",
            "Je ne veux plus vivre",
            "je veux mettre fin à mes jours",
            "Je n'ai plus envie de vivre",
            "je veux en finir",
            "JE VEUX MOURIR",
            # Review probe (BE-05 fix round)
            "je veux en finir, j'en peux plus",
            "je veux juste en finir",
            "j'ai envie d'en finir",
            "je pense à me tuer",
            "je vais me foutre en l'air",
            "je veux crever",
            "je veux disparaître",
            "je me fais du mal",
            "je me suis fait du mal hier",
            "je me scarifie",
            "j'ai pensé à me suicider hier",
            "envie d'en finir avec tout ça",
            "je suis suicidaire",
            "j'ai plus envie de vivre",
            "je n'ai plus de raison de vivre",
        ],
    )
    def test_french_crisis_phrases_are_caught_and_answered_in_french(self, text):
        result = crisis_check(text)
        assert result.hit is True
        assert result.reply == CRISIS_REPLY_FR

    @pytest.mark.parametrize(
        "text",
        [
            "this task is killing me",
            "This timer is KILLING me!!",
            "I'm dying to see my score",
            "I could kill for a coffee",
            "that round killed me",
            "I'm dead tired",
            "I'm going to die of boredom",
            "go on then",
            "I am tired today",
            "Great",
            "ça me tue",
            "je suis mort de fatigue",
            "je vais me tuer à la tâche",
            "j'en peux plus de ce chrono",
            "je veux en finir avec cet exercice",
            "j'ai envie d'en finir avec l'exercice",
            "vivement en finir avec ce niveau",
            "je vais crever de chaud",
            "",
        ],
    )
    def test_everyday_idioms_are_not_flagged(self, text):
        assert crisis_check(text) == GateResult(hit=False)

    def test_reply_is_calm_and_points_to_emergency_services_and_a_crisis_line(self):
        assert "emergency" in CRISIS_REPLY_EN and "crisis line" in CRISIS_REPLY_EN
        assert "urgence" in CRISIS_REPLY_FR and "prévention du suicide" in CRISIS_REPLY_FR
        for reply in (CRISIS_REPLY_EN, CRISIS_REPLY_FR):
            for number in ("112", "3114", "988"):
                assert number in reply
            assert "!" not in reply

    def test_shape_matches_the_frontend_seam(self):
        assert crisis_check("hello").model_dump(exclude_none=True) == {"hit": False}
        assert set(crisis_check("I want to die").model_dump(exclude_none=True)) == {"hit", "reply"}
        assert SafetyGuardrailEngine().crisis_check("I want to die") == crisis_check("I want to die")

    def test_crisis_hit_never_reaches_the_llm_and_has_no_chips(self):
        calls = []
        agent = AICoachAgent(llm_callable=lambda msgs: calls.append(msgs) or "Sure!")
        resp = agent.handle_chat(ChatRequest(user_id="u", message="I want to end my life"))
        assert calls == []
        assert resp.reply_source == ReplySource.CRISIS
        assert resp.reply_text == CRISIS_REPLY_EN
        assert resp.suggested_actions == []
        assert resp.collab_score_snapshot is None
        assert agent.reply_source_counts[ReplySource.CRISIS.value] == 1

    def test_crisis_text_in_history_is_gated_before_the_llm(self):
        calls = []
        agent = AICoachAgent(llm_callable=lambda msgs: calls.append(msgs) or "Sure!")
        history = [
            ChatMessage(role=ChatMessageRole.USER, content="I want to end my life"),
            ChatMessage(role=ChatMessageRole.ASSISTANT, content="Let's try a round."),
        ]
        resp = agent.handle_chat(ChatRequest(user_id="u", message="why?", chat_history=history))
        assert calls == []
        assert resp.reply_source == ReplySource.CRISIS
        assert resp.reply_text == CRISIS_REPLY_EN

    def test_crisis_phrase_split_across_turns_is_caught(self):
        calls = []
        agent = AICoachAgent(llm_callable=lambda msgs: calls.append(msgs) or "Sure!")
        history = [ChatMessage(role=ChatMessageRole.USER, content="honestly I want to")]
        resp = agent.handle_chat(ChatRequest(user_id="u", message="end it all", chat_history=history))
        assert calls == []
        assert resp.reply_source == ReplySource.CRISIS

    def test_assistant_turns_are_not_gated(self):
        # Only the user's words are checked; Loti's own scripted lines never trip the gate.
        history = [ChatMessage(role=ChatMessageRole.ASSISTANT, content="Please call 988 if you want to die.")]
        resp = AICoachAgent().handle_chat(ChatRequest(user_id="u", message="hello", chat_history=history))
        assert resp.reply_source == ReplySource.OFFLINE

    def test_health_text_in_history_gets_the_signpost(self):
        calls = []
        agent = AICoachAgent(llm_callable=lambda msgs: calls.append(msgs) or "Sure!")
        history = [ChatMessage(role=ChatMessageRole.USER, content="I think I have dementia")]
        resp = agent.handle_chat(ChatRequest(user_id="u", message="why?", chat_history=history))
        assert calls == []
        assert resp.reply_source == ReplySource.HEALTH_SIGNPOST

    def test_crisis_check_runs_before_the_health_signpost(self):
        resp = AICoachAgent().handle_chat(ChatRequest(user_id="u", message="my depression makes me want to die"))
        assert resp.reply_source == ReplySource.CRISIS


class TestLLMFallback:
    def _request(self):
        return ChatRequest(user_id="u", message="hello", active_cluster_id=4)

    def test_llm_error_is_logged_counted_and_answered_offline(self, caplog):
        def broken_llm(messages):
            raise TimeoutError("upstream timed out")

        agent = AICoachAgent(llm_callable=broken_llm)
        with caplog.at_level(logging.WARNING, logger=agent_module.__name__):
            resp = agent.handle_chat(self._request())

        offline = AICoachAgent().handle_chat(self._request())
        assert resp.reply_source == ReplySource.OFFLINE_AFTER_LLM_ERROR
        assert resp.reply_text == offline.reply_text
        assert agent.reply_source_counts[ReplySource.OFFLINE_AFTER_LLM_ERROR.value] == 1
        assert any("TimeoutError" in r.getMessage() for r in caplog.records)
        assert all("hello" not in r.getMessage() for r in caplog.records)

    def test_failure_log_never_contains_user_text(self, caplog):
        secret = "my private sentence 7f3a"

        def echoing_llm(messages):
            raise RuntimeError(f"bad request: {messages[-1]['content']}")

        agent = AICoachAgent(llm_callable=echoing_llm)
        with caplog.at_level(logging.DEBUG):
            resp = agent.handle_chat(ChatRequest(user_id="u", message=secret))
        assert resp.reply_source == ReplySource.OFFLINE_AFTER_LLM_ERROR
        assert any("RuntimeError" in r.getMessage() for r in caplog.records)
        assert all(secret not in r.getMessage() for r in caplog.records)
        assert all(r.exc_info is None for r in caplog.records)

    @pytest.mark.parametrize("bad", [None, "", "   ", 42])
    def test_empty_or_non_text_llm_reply_falls_back(self, bad, caplog):
        agent = AICoachAgent(llm_callable=lambda msgs: bad)
        with caplog.at_level(logging.WARNING, logger=agent_module.__name__):
            resp = agent.handle_chat(self._request())
        assert resp.reply_source == ReplySource.OFFLINE_AFTER_LLM_ERROR
        assert resp.reply_text.strip()
        assert caplog.records

    def test_banned_llm_reply_is_withheld_logged_and_replaced_offline(self, caplog):
        agent = AICoachAgent(llm_callable=lambda msgs: "Great job, that's real neuroplasticity!")
        with caplog.at_level(logging.WARNING, logger=agent_module.__name__):
            resp = agent.handle_chat(self._request())
        assert resp.reply_source == ReplySource.OFFLINE_AFTER_LINT
        assert "neuroplastic" not in resp.reply_text.lower()
        assert resp.safety_metadata.sanitized is True
        assert agent.reply_source_counts[ReplySource.OFFLINE_AFTER_LINT.value] == 1
        assert any("withheld" in r.getMessage() for r in caplog.records)

    def test_clean_llm_reply_is_used_as_is(self):
        agent = AICoachAgent(llm_callable=lambda msgs: "Nice rhythm today.")
        resp = agent.handle_chat(self._request())
        assert resp.reply_source == ReplySource.LLM
        assert resp.reply_text == "Nice rhythm today."
        assert not agent.reply_source_counts
