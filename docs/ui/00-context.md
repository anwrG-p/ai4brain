# 00 — Challenge Context, Rubric Proof Matrix & Team Alignment

> **History.** This describes the UI before brand v2 (BRIAN, the Doodle design, 19 pages, 7 dimensions), superseded on 2026-10-31. Current: the [root README](../../README.md), the [glossary](../../docs/GLOSSARY.md) and `docs/design/BRAND-V2.md`. Kept as a record; not maintained.

## 1. Challenge Summary (CISTAC 1.0 — AI4Brain)
- **Topic**: Continuous, non-clinical cognitive assessment and personalized adaptive coaching powered by generative AI, cognitive science, and temporal representation learning (SAT-JEPA + GMM archetypes).
- **Four Core Pillars**:
  1. **Assess (Layer A)**: Multimodal tasks per cognitive dimension collecting normalized score, response time (`response_time_ms`), error rate/bursts (`error_flag`, `error_burst`), and behavioural hesitation (`hesitation_jitter`, `keystroke_latency_ms`). Mandatory non-biometric mode by default; voice pacing opt-in only.
  2. **Understand (Brain Twin)**: Dynamic, historised cognitive profile with explicit epistemic uncertainty ($\pm \text{CI} / \sigma$), temporal smoothing (SAT-JEPA), and $K=9$ non-clinical cognitive archetypes with hysteresis gating.
  3. **Coach (Layer B)**: Natural-language coaching grounded in prototype differential vectors ($\Delta c$) with a 5-part **"Why this?"** explainability trail and strict non-clinical safety guardrails.
  4. **Improve (Layer C + Collaboration Score)**: Adaptive exercises (85% accuracy target via weighted staircase & QUEST+), radar chart, historical curves, session fatigue heatmaps, goal tracking, and the 0–100 **AI Collaboration Score** (Clarification 20%, Critical Verification 25%, Iteration 20%, Autonomy 20%, Responsible Use 15% — labeled *"Design proposal, not validated"*).

## 2. Key Dates & Submission Targets (Tunisia, UTC+1)
- **Internal Feature Freeze (`ui-m3-feature-freeze`)**: Fri 30/10/2026
- **Target Team Submission (`ui-v1.0-phase1`)**: Sat 31/10/2026 at 18:00 UTC+1
- **Official Phase 1 Deadline**: Sun 01/11/2026 (Public GitHub repo, 3–5 min demo video, $\le 15$ slides, $\le 8$-page report)
- **Surprise Element Reveal**: Fri 06/11/2026
- **Phase 2 Final Pitch**: Sat 07/11/2026 (8 min pitch + 5 min Q&A)

## 3. Scoring Rubric & UI Proof Strategy
- **Phase 1 (60% of total)**:
  - **Relevance (12%)**: Every mandatory Layer A–C item, Collaboration Score, and Privacy control visible and clearly labeled.
  - **Quality (12%)**: Cohesive token system, zero broken states, automated tests, living `/design-system`.
  - **Innovation (12%)**: The 8 Signature Components (Uncertainty Radar, Brain Twin Time Travel, Why-This Panel, Projection Fan Chart, Collaboration Score Card, Privacy Center, Judge Mode Dock, Original Layered SVG Mascot).
  - **UX (9%)**: First insight in $\le 3$ minutes, intuitive navigation, WCAG AA + zero `axe-core` violations.
  - **Explainability (9%)**: Expandable "Why this?" trail on every score, coach reply, and plan item.
  - **Safety (6%)**: Granular consent, Privacy Center, non-biometric default, automated non-clinical copy linter.
- **Phase 2 (40% of total)**:
  - **Generalisation (10%)**: Config-driven `DimensionRegistry` tested with 3, 6, 7, 8, and 10 dimensions; logical CSS properties for RTL readiness.
  - **Robustness (10%)**: Offline banner, LLM-down deterministic fallback, tab-blur trial pause, invalid payload handling.
  - **Profile Quality (8%)**: Honest uncertainty bands, diagonal hatching when confidence is low, visible snapshot history.
  - **Plan Relevance (6%)**: Adaptive exercises and difficulty tiers visibly linked to profile deltas ($\Delta c$).
  - **Defense (6%)**: `<JudgeModeDock />` with instant persona switching, reset, and "Explain this screen" rubric callouts.
