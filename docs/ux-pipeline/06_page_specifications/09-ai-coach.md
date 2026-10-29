# Page 09 Specification — AI Coach & Explainable Strategy Studio (`HERO`, `/coach`)

**Route:** `/coach`  
**Priority:** `Must` · **HERO SCREEN**  
**Branch:** `ui/page-09-ai-coach`  
**Milestone:** Wave 2 (`ui-m3-feature-freeze`)  
**Signature Components Hosted:**
- **Signature #3:** `<WhyThisPanel />` (`frontend/src/components/signature/WhyThisPanel.tsx`) — Every AI Coach turn and action card embeds an expandable 5-part explainability trail (*Data, Inference, Advice, Confidence, Counterfactual*).
- **Signature #8:** `<Mascot />` (`frontend/src/components/signature/Mascot.tsx`) — Renders as the conversational non-clinical companion (`thinking` during analysis, `rest` when fatigue/jitter is high, `celebrate` on milestone convergence).

---

## Goal and primary user story
- **Primary User Story:** *"As a learner or competition evaluator, I want to ask my AI Coach why specific cognitive dimensions are hatched or solid, receive concrete non-clinical study and pacing strategies grounded in my SAT-JEPA differential vector ($\Delta c$), inspect the 5-part `<WhyThisPanel />` trail on every recommendation, and verify that the coach seamlessly falls back to a deterministic rule engine if the LLM is offline."*
- **Jury Rubric Impact:** Directly anchors **Relevance (12% — Layer B AI Coach)**, **Explainability (9% — 5-part `<WhyThisPanel />` on every coach message)**, **Safety (6% — live non-clinical & zero-guilt copy guardrail inspector)**, and **Robustness (10% — 1-click `simulateLlmDown` deterministic rule-engine fallback)**.

---

## Information architecture and content hierarchy
1. **Top Hero Header & Engine Mode Switcher**:
   - Displays Layer B AI Coach status badge (`SAT-JEPA Grounded Coach · Non-Clinical Guardrail Active`), **1-Click Engine Toggle (`Generative Coach` vs `⚙ Deterministic Rule Fallback`)**, active persona selector, and preview state pills (`live`, `fallback-mode`, `rest-pacing`, `loading`, `empty`, `error`, `extreme-text`).
2. **Row 1 — Conversational Coaching Studio + Explainable `<WhyThisPanel />` Feed (12-Col Grid: 7 Cols Interactive Coach Studio + 5 Cols Grounding & Safety Rail)**:
   - **Left 7 Columns (Interactive Coaching Stream & Prompt Composer)**:
     - **Companion Status Strip (`<Mascot />`)**: Summarizes the user's current readiness window, widest uncertainty band (`±CI`), and active engine mode (`SAT-JEPA + LLM` or `Deterministic Rule Engine`).
     - **Quick-Prompt Topic Chips (4 Grounded Scenarios)**:
       1. `Why is my Episodic Separation hatched (<60%)?`
       2. `Optimize my peak focus window from the Fatigue Heatmap`
       3. `How can I raise my AI Verification & Autonomy sub-scores?`
       4. `High hesitation jitter (>110 ms) — switch to Rest-First Pacing`
     - **Active Coach Response Card + Embedded `<WhyThisPanel />`**: Renders the structured non-clinical coaching guidance, concrete 2-minute action button (linking to `/task/:dimId` or `/plan`), and the expanded 5-part `<WhyThisPanel />` (*1. Observed Telemetry Data*, *2. Non-Clinical Inference ($\Delta c$)*, *3. Adaptive Advice*, *4. Epistemic Confidence*, *5. Counterfactual*).
     - **Interactive Prompt Composer & "View Coach Log as Table" Toggle**: Allows typing a custom question or switching the entire coaching session history into a semantic `<table>` (`Prompt`, `Target Dimension`, `Recommended Action`, `Confidence`, `Engine Source`).
   - **Right 5 Columns (SAT-JEPA Differential Vector $\Delta c$ Grounding + Live Non-Clinical Copy Guardrail Inspector)**:
     - **Card A — Active Dimension Grounding (`3/6/7/8/10` Dimensions)**: Shows each active dimension from `DimensionRegistry`, its current score $\pm\text{CI}$, differential vector priority ($\Delta c$), and 1-click `"Ask Coach About [Dim]"` button.
     - **Card B — Live Non-Clinical & Zero-Guilt Copy Guardrail Inspector**: Interactive verifier backed by `lintCopyText()` where evaluators can inspect how the AI Coach sanitizes and blocks clinical diagnostic terms or punitive streak-guilt language before any message reaches the user.

---

## Wireframe (ASCII) at 375 px, 768 px, and 1440 px

### Desktop (`1440 px` — 12-Column Grid)
```text
+--------------------------------------------------------------------------------------------------+
| [Badge: Layer B AI Coach · Non-Clinical] [Engine: Live | Deterministic Fallback] [States: 1..6]  |
| H1: Explainable AI Coach & Cognitive Strategy Studio                   [Open Weekly Plan ->]     |
+---------------------------------------------------------+----------------------------------------+
| INTERACTIVE AI COACH STUDIO (7 Cols)                    | GROUNDING & SAFETY RAIL (5 Cols)       |
| <Mascot state="thinking" /> Companion Brief             | CARD A: SAT-JEPA DELTA-C PRIORITIES    |
| Quick Topics: [Why Hatched?] [Peak Window] [Collab]     |  WM: 78% +-5% (Solid)   [Ask Coach]    |
|---------------------------------------------------------|  EP: 64% +-14% (Hatched)[Ask Coach]    |
| ACTIVE COACH RECOMMENDATION CARD                        |  ...(scales 3/6/7/8/10 dimensions)     |
| "Narrow Episodic Separation with 4 Lure Trials"         |----------------------------------------|
| [Launch 90s EP Calibration ->] [Add to Weekly Plan]     | CARD B: LIVE COPY GUARDRAIL INSPECTOR  |
| <WhyThisPanel /> (5-Part Trail Expanded by Default)     |  Status: PASS (0 clinical/guilt terms) |
|---------------------------------------------------------|  [Test Sample Guardrail Interception]  |
| [Custom Prompt Input: Ask about any dimension...] [Send]|   JSON Context: /v1/dashboard/profile   |
+---------------------------------------------------------+----------------------------------------+
```

### Mobile (`375 px` — 4-Column Single Stack)
```text
+---------------------------------------+
| H1: Explainable AI Coach Studio       |
| [Engine Fallback Toggle] [States]     |
+---------------------------------------+
| <Mascot /> + Quick Topic Chips        |
+---------------------------------------+
| Active Coach Turn + <WhyThisPanel />  |
+---------------------------------------+
| Prompt Composer + Table Toggle        |
+---------------------------------------+
| SAT-JEPA Delta-c Dimension Priorities |
+---------------------------------------+
| Live Non-Clinical Guardrail Inspector |
+---------------------------------------+
```

---

## Component breakdown (existing vs new)
- **New Page Component**:
  - `frontend/src/pages/AiCoachPage.tsx` (lazy-loaded on `/coach`).
- **Existing Components Reused**:
  - `<WhyThisPanel />` (`Signature #3`), `<Mascot />` (`Signature #8`), `<Card />`, `<Badge />`, `<Button />`, `lintCopyText()` (`frontend/src/utils/copyLinter.ts`).

---

## Every state to support
1. **`live` (Default Grounded Coach)**: Shows the active coaching turn grounded in `sat_jepa_delta_c` with `<WhyThisPanel />` expanded and all active dimensions (`3/6/7/8/10`) listed in the grounding rail.
2. **`fallback-mode` (`simulateLlmDown = true` Deterministic Rule Engine)**: Activates the deterministic rule-engine fallback (`sourceModule: 'deterministic_fallback'`), displaying the global & local fallback badges and deterministic threshold rules so judges can verify 100% uptime when the LLM is unreachable.
3. **`rest-pacing` (High Jitter / Fatigue Rest-First Mode)**: Switches `<Mascot />` to `rest` state and recommends a zero-guilt recovery break + lighter single-stream block.
4. **`loading` (Skeleton)**: Shimmering coach message and `<WhyThisPanel />` skeleton while synthesizing $\Delta c$ telemetry.
5. **`empty` (First-Visit Cold Start)**: Prompt starter cards for a learner who has not yet asked a question.
6. **`error` (Telemetry Context Sync Error)**: Recoverable alert banner with 1-click fallback to local cached profile estimates.
7. **`extreme-text` (Multi-Turn Long-Prompt Stress Test)**: Stress-tests long multi-clause reasoning trails and 10-dimension priority lists at `375 px` with zero horizontal overflow.

---

## Copy table (every user-facing string; passes non-clinical & zero-guilt linter)

| Element | Exact Copy | Linter Check |
| :--- | :--- | :---: |
| Page H1 | `Explainable AI Coach & Cognitive Strategy Studio` | Pass |
| Subtitle | `Every recommendation is grounded in your SAT-JEPA differential vector (Δc) and QUEST+ confidence bands—with a 5-part reasoning trail and deterministic rule fallback.` | Pass |
| Fallback Badge | `Deterministic Rule Engine Active (LLM-Offline Safe Mode)` | Pass |
| Guardrail Header | `Live Non-Clinical & Zero-Guilt Copy Guardrail` | Pass |
| Rest Pacing Note | `High hesitation jitter detected—pausing difficulty progression is a smart calibration choice, never a penalty.` | Pass |

---

## Interactions and motion (with the reduced-motion variant)
- **1-Click Topic & Dimension Grounding**: Clicking any of the 4 quick-prompt chips or clicking `"Ask Coach"` next to any of the `3/6/7/8/10` dimensions in the right rail immediately updates the active Coach Recommendation Card and its 5-part `<WhyThisPanel />` trail.
- **1-Click Deterministic Fallback Toggle**: Toggles `simulateLlmDown` in `useAppStore` so evaluators can compare generative synthesis vs deterministic rule-engine output side by side.
- **Interactive Guardrail Verifier**: Evaluators can click `"Verify Current Coach Copy"` or `"Simulate Guardrail Rewrite"` to see `lintCopyText()` validate the active response in real time.

---

## Data contract (types) and the mock fixtures used
- **`CoachTurnSpec` (`frontend/src/pages/AiCoachPage.tsx`)**:
  - `id: string`
  - `topicLabel: string`
  - `userPrompt: string`
  - `dimensionId: string`
  - `headline: string`
  - `coachingBody: string`
  - `actionLabel: string`
  - `actionRoute: string`
  - `mascotState: 'thinking' | 'celebrate' | 'rest' | 'hello'`
  - `whyThis: WhyThisTrail` (switches `sourceModule` to `'deterministic_fallback'` when `simulateLlmDown` is active).

---

## Accessibility notes: focus order, labels, chart table alternative
- **Accessible Form Controls**: The custom prompt input has an explicit `<label htmlFor="coach-prompt-input">` and keyboard submit (`Enter`).
- **1-Click "View Coach Log as Table" Toggle**: Renders all coaching recommendations, target dimensions, confidence scores, and counterfactuals in a semantic `<table>` (`<thead>`, `<th scope="col">`).
- **Scrollable `<pre>` Focusability**: The JSON context inspector includes `tabIndex={0} role="region" aria-label="..."` for keyboard scrolling.

---

## Acceptance checklist (from the Definition of Done)
- [x] Matches this approved spec; any deviation logged in `DECISIONS.md`.
- [x] Only design tokens used (`npm run lint:tokens` exits 0).
- [x] All states (`live`, `fallback-mode`, `rest-pacing`, `loading`, `empty`, `error`, `extreme-text`) implemented and screenshotted.
- [x] Contrast computed via `check-contrast.mjs` ($\ge 4.5:1$ text, $\ge 3.0:1$ UI/marks).
- [x] Complete keyboard navigation, `3px` focus ring, $\ge 44\text{ px}$ targets.
- [x] Reduced motion respected.
- [x] Color never carries meaning alone.
- [x] Copy passes `npm run lint:copy` with zero clinical or guilt terms.
- [x] Zero CLS, zero horizontal scroll at `375 px`, survives `200%` zoom.
- [x] Code-split route (`React.lazy`).
- [x] Unit/component tests + Playwright `axe-core` check (`0` violations).
- [x] Works seamlessly with 3, 6, 7, 8, and 10 dimensions.
- [x] Docs, screenshots, `STATE.md` and commit are done.

---

## Visual Critique Log (Rounds 1 & 2)
- **Round 1 Critique**:
  - *Observation 1*: On `1440 px` desktop, the right 5-column stack (Dimension Grounding + Copy Guardrail Inspector) extended slightly lower than the left 7-column Coaching Studio card.
  - *Fix 1*: Added a compact **Deterministic Rule Engine & Explainability Guarantees** card (`Card L2`) below the main Coaching Studio card in the left 7-column stack so both columns align cleanly at the bottom edge.
  - *Observation 2*: Clicking `3 · ☾ Rest-First Pacing` after `2 · ⚙ Rule Fallback` retained `simulateLlmDown = true`, keeping `<Mascot />` in `'thinking'` state instead of transitioning to `'rest'` state.
  - *Fix 2*: Updated the `3 · ☾ Rest-First Pacing` state handler to set `setSimulateLlmDown(false)` alongside `setActiveTurn(SEEDED_COACH_TURNS[3]!)`, ensuring `<Mascot state="rest" />` renders as designed.
- **Round 2 Critique**:
  - *Observation*: Long dimension names (`Cognitive Flexibility (Set-Shifting)` and `Episodic Pattern Separation`) caused the `Ask Coach` button to wrap onto a second line on some desktop rows.
  - *Fix*: Added `sm:flex-nowrap` on the dimension grounding row and `shrink-0` on the `Ask Coach` button so all `3/6/7/8/10` rows keep their action button aligned on the right edge.

---

## Decisions and known issues
- **Decisions**: Wire the **Deterministic Rule-Engine Fallback** toggle on `/coach` directly to `useAppStore().simulateLlmDown` so toggling it on `/coach` also activates the global AppShell fallback banner and updates `<WhyThisPanel />`'s `sourceModule` to `'deterministic_fallback'`.
- **Known Issues**: None.

---

## Screenshots (paths) and commit hashes
- `docs/ui/screenshots/09-ai-coach-1440.png`
- `docs/ui/screenshots/09-ai-coach-fallback-10dims-1440.png`
- `docs/ui/screenshots/09-ai-coach-dark-1440.png`
- `docs/ui/screenshots/09-ai-coach-768.png`
- `docs/ui/screenshots/09-ai-coach-375.png`
