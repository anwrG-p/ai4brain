# 01 — UX Strategy: Personas, Journeys & Epistemic Principles

> **History.** This describes the UI before brand v2 (BRIAN, the Doodle design, 19 pages, 7 dimensions), superseded on 2026-10-31. Current: the [root README](../../README.md), the [glossary](../../docs/GLOSSARY.md) and `docs/design/BRAND-V2.md`. Kept as a record; not maintained.

## 1. Core UX Philosophy
- **First Insight in $\le 3$ Minutes**: Users and evaluators reach a complete, uncertainty-aware Brain Twin profile in under 3 minutes via either the **2-Minute Quick Baseline** (3 core trials per dimension) or the **1-Click Judge Persona Switcher**.
- **Epistemic Honesty by Default**: No score is ever shown without its confidence band ($\pm \text{CI}$). Low-confidence dimensions (`confidence < 0.60`) automatically render with diagonal SVG hatching and plain-language guidance on how many trials will narrow the range.
- **Zero-Guilt, Non-Clinical Voice**: No medical/diagnostic labels (*ADHD, deficit, impairment, disorder, symptom*) and no punitive streak mechanics (*"you broke your streak"*). Every error is framed as useful calibration signal that sharpens the Brain Twin.

---

## 2. Seeded Personas & Edge Fixtures (`src/services/mocks/fixtures/`)

| Persona ID | Name & Context | Profile Characteristics | Primary Rubric Proof |
| :--- | :--- | :--- | :--- |
| **`new-user`** | **Nour** (1st-Year Engineering Student) | 0 prior sessions, fresh consent onboarding, non-biometric mode locked ON, ready for 2-min baseline. | UX (9%), Safety (6%) |
| **`steady-improver`** | **Youssef** (6 Weeks History, 14 Snapshots) | High confidence ($0.82\text{–}0.91$), narrowing uncertainty bands across 6 weeks, Collaboration Score `82 ± 4`, active SAT-JEPA archetype transition. | Profile Quality (8%), Innovation (12%), Plan Relevance (6%) |
| **`noisy-low-confidence`** | **Salma** (Irregular Late-Night Sessions) | High RT variance and hesitation jitter; 4 dimensions with `confidence < 0.55` triggering hatched radar bands and fatigue coaching. | Profile Quality (8%), Explainability (9%) |
| **`edge-missing-dim`** | **Edge Fixture A** (Partial Profile) | 1 dimension unassessed (`null` estimate) to verify graceful partial-state rendering on radar and cards. | Robustness (10%) |
| **`edge-10-dimensions`** | **Edge Fixture B** (Generalisation Stress Test) | Switches `DimensionRegistry` between **3, 6, 7, 8, and 10 dimensions** dynamically. | Generalisation (10%) |
| **`edge-llm-offline`** | **Edge Fixture C** (LLM-Down / Offline Fallback) | Simulates LLM 503 timeout; activates deterministic rule-based coaching & plan fallback with honest status banner. | Robustness (10%), Defense (6%) |
