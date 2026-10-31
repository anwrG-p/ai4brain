# Page 16 — Demo & Judge Mode (`/judge-mode`) Specification

> **Superseded (history).** This spec describes the page before brand v2. Now: evaluator tools render only with `?judge=1`. Current route map: `docs/design/BRAND-V2.md`. Kept as a record; not maintained.

- **Page Name & Route**: Demo & Judge Mode (`/judge-mode`) · Signature #7 `<JudgeModeDock />`
- **Wave & Priority**: Wave 3 · **Must** (`P1` Evaluator Defense & Rubric-to-UI Proof Suite · Signature Component #7)
- **Branch**: `ui/page-16-judge-mode`

---

## 1. Purpose, Audience & Primary Job
- **Purpose**: Provide the jury and evaluators with a dedicated, authoritative defense console and interactive control dock. In the AI4Brain competition, judges have strictly bounded time ($\le 8$ minutes pitch + 5 minutes Q&A) to verify complex longitudinal claims, epistemic uncertainty modeling, and robustness under failure modes.
  1. **Instant 1-Click Persona Switching**: Jump instantly between all 6 seeded personas and edge fixtures (`new-user`, `steady-improver`, `noisy-low-confidence`, `edge-missing-dim`, `edge-10-dimensions`, `edge-llm-offline`) without having to complete hundreds of manual calibration trials.
  2. **Generalisation Stress Testing**: Toggle between `3, 6, 7, 8, and 10` dimensions live to verify that radar graphs, fan charts, staircase parameters, and data grids adapt dynamically without layout breakage.
  3. **Fault Injection & Edge State Simulation**: Inject offline connectivity loss (`simulateOffline=true`), degraded LLM timeouts (`simulateLlmDown=true`), and high-jitter fatigue spikes on the fly to inspect deterministic fallback systems and honest UI banners.
  4. **Interactive Rubric Matrix (11 Criteria)**: Connect every official jury criterion across Phase 1 (60%) and Phase 2 (40%) directly to live routes, signature component proofs, and screenshot artifacts.
  5. **Global Dock Integration (`<JudgeModeDock />`)**: A persistent or collapsible quick-dock that allows evaluators to manipulate simulation parameters from any screen across the entire application.
- **Audience**:
  - **Jury Evaluators**: Evaluating **Defense (6% final)**, **Generalisation (10% final)**, **Robustness (10% final)**, and **Relevance (12% final)**. The jury requires immediate proof that the system is not a static mockup but a fully reactive epistemic state engine.
  - **Developers & Presenters**: Delivers an infallible, reset-capable demo environment during the final live pitch on Saturday 07/11/2026.
- **Primary Job**: Let evaluators inspect and manipulate the entire application state, trigger failure conditions, cross-examine rubric criteria against live UI proofs, and reset simulated data with zero friction.

---

## 2. Rubric Criteria Served
- **Defense (Phase 2, 6% final)** — Directly provides the dedicated judge control interface, seeded persona switcher, and rubric proof matrix.
- **Generalisation (Phase 2, 10% final)** — Live interactive toggling across 3, 6, 7, 8, and 10 dimensions with Okabe-Ito colorblind-safe rendering.
- **Robustness (Phase 2, 10% final)** — Real-time simulation of offline mode and LLM-down deterministic fallback.
- **Innovation (Phase 1, 12% final)** — Implements **Signature #7 `<JudgeModeDock />`**.
- **Relevance & Explainability (21% combined)** — Maps all 8 Signature Components and Layers A–C to observable screens with embedded `<WhyThisPanel />`.

---

## 3. ASCII Wireframe (`1440 px` Desktop & `375 px` Mobile)

### Desktop (`1440 px`, 12-Column Grid)
```text
+--------------------------------------------------------------------------------------------------+
| [ST] SynapseTwin · Simulated Data   [3 Dims][6 Dims][7 Dims][10 Dims]  [Theme] [Motion] [Nav...] |
+--------------------------------------------------------------------------------------------------+
| [⚖ Evaluator Defense Suite] [Signature #7 <JudgeModeDock />] [100% Rubric Proof Verified ●]      |
| Demo & Judge Mode Console                                                                        |
| Subtitle: Interactive evaluator dock, 6 seeded personas, failure-injection studio, and rubric map|
+--------------------------------------------------------------------------------------------------+
| HERO CONTROLS: 6 Seeded Persona Switcher Bar (Full Width)                                        |
| [1 · Nour (New User)][2 · Youssef (Steady)][3 · Salma (Noisy)][4 · Partial][5 · 10 Dims][6 · LLM]|
| Active: Youssef (Steady Improver · 6 Wks, 14 Snapshots, 82±4 Collab Score) [Reset All Demo State]|
+---------------------------------------------------------+----------------------------------------+
| LEFT 7 COLUMNS: Fault Injection & System Controls       | RIGHT 5 COLUMNS: Quick Dock & Rubric   |
| +-----------------------------------------------------+ | +------------------------------------+ |
| | Fault Injection & Stress Studio                     | | | Signature #7 <JudgeModeDock />     | |
| | • Offline Network Simulation: [TOGGLE ACTIVE]       | | | Quick Simulation Controls (Dock)   | |
| |   (Buffers up to 500 trials in local queue)         | | | • Persona: [Youssef (Steady)   ▼]  | |
| | • LLM Degradation / 503 Timeout: [TOGGLE ACTIVE]    | | | • Registry: [7 Dimensions (Def) ▼] | |
| |   (Activates deterministic heuristic engine)        | | | • Theme: [☀ Light / ☾ Dark]       | |
| | • High Fatigue & Jitter Probe: [INJECT BURST]       | | | • Motion: [✦ Standard / ⚡ Reduced]| |
| |   (Widens uncertainty bands and triggers coach)     | | | • Telemetry Queue: [142 Cached]    | |
| +-----------------------------------------------------+ | | [Reset to Default Baseline]        | |
| | The 8 Signature Components Fast-Launcher            | +------------------------------------+ |
| | [1. Uncertainty Radar (/design-system)]             | | Rubric Quick-Jump Scorecard          | |
| | [2. Brain Twin Time Travel (/brain-twin)]           | | Phase 1 (60%): 6/6 Criteria Ready    | |
| | [3. Why-This Explainability Panel (/coach)]         | | Phase 2 (40%): 5/5 Criteria Ready    | |
| | [4. Longitudinal Projection Fan (/dimensions/:id)]  | | Total Coverage: 11/11 Verified (100%)| |
| | [5. AI Collaboration Score Card (/collaboration)]   | +------------------------------------+ |
| | [6. Sovereign Privacy Center (/privacy)]            | | Mascot in Judge / Juror Mode         | |
| | [7. Judge Mode Dock (/judge-mode)]                  | | "Explore any failure scenario or     | |
| | [8. Geometric Synaptic Mascot (Profile Reveal)]     | | seeded profile with 1-click."        | |
| +-----------------------------------------------------+ +------------------------------------+ |
| | Comprehensive Jury Rubric-to-UI Proof Matrix (Interactive Table)                              | |
| | [Criterion]        | [Weight] | [What the UI Proves]       | [Primary Route] | [Status / Jump]| |
| | Relevance (P1)     | 12%      | Layers A-C, Collab, Priv   | /dashboard      | [Inspect ->]   | |
| | Quality (P1)       | 12%      | 4px grid, tokens, QA tests | /design-system  | [Inspect ->]   | |
| | Innovation (P1)    | 12%      | 8 Signature Components     | /collaboration  | [Inspect ->]   | |
| | UX (P1)            | 9%       | <=3 min insight, WCAG AA   | /profile-reveal | [Inspect ->]   | |
| | Explainability (P1)| 9%       | 5-part WhyThis trails      | /coach          | [Inspect ->]   | |
| | Safety (P1)        | 6%       | Non-biometric lock, GDPR   | /privacy        | [Inspect ->]   | |
| | Generalisation (P2)| 10%      | 3/6/7/8/10 Dims dynamic    | /dimensions/wm  | [Inspect ->]   | |
| | Robustness (P2)    | 10%      | Offline buffer, rule fallbk| /coach          | [Inspect ->]   | |
| | Profile Quality(P2)| 8%       | Bayesian CI, 14-snap travel| /brain-twin     | [Inspect ->]   | |
| | Plan Relevance (P2)| 6%       | Adaptive staircase & delta-c/plan           | [Inspect ->]   | |
| | Defense (P2)       | 6%       | JudgeModeDock, 6 personas  | /judge-mode     | [Current Page] | |
+--------------------------------------------------------------------------------------------------+
```

### Mobile (`375 px`, 1-Column Stack)
```text
+-----------------------------------------+
| [ST] SynapseTwin         [Theme] [Nav]  |
+-----------------------------------------+
| [⚖ Judge Mode] [11/11 Rubric Ready]     |
| Demo & Judge Mode Console               |
+-----------------------------------------+
| Persona Switcher (Horizontal Scroll)    |
| [Nour][Youssef][Salma][Partial][10D][LLM|
+-----------------------------------------+
| <JudgeModeDock /> (Mobile View)         |
| • Active: Youssef (Steady Improver)     |
| • Dimensions: [3][6][7][10]             |
| • Offline: [TOGGLE]                     |
| • LLM Fallback: [TOGGLE]                |
| [Reset Demo State]                      |
+-----------------------------------------+
| Fast-Launch 8 Signature Components      |
| [Radar][Twin][WhyThis][Fan][Collab]...  |
+-----------------------------------------+
| Rubric Proof Matrix (Scrollable Table)  |
| 11 competition criteria mapped to UI    |
+-----------------------------------------+
```

---

## 4. Visual Hierarchy & Token Mapping
- **Canvas & Surface**: `bg-canvas` (`#FFF8EE` Light / `#0B1020` Dark), `bg-surface` (`#FFFFFF` Light / `#161B30` Dark), `border-border-strong` (`#8C86A0` Light / `#4B5578` Dark).
- **Judge Accent Tokens**: `bg-reward` (`#FFC83D` Light / `#FACC15` Dark), `text-reward-ink` (`#1F1B3B`), `bg-brand` (`#0F766E` Light / `#22D3EE` Dark).
- **Fault Injection Indicators**:
  - Offline Mode: `bg-warning` (`#D97706`), `border-warning`.
  - LLM Fallback: `bg-accent-coral/20 border-accent-coral text-ink`.
- **Typography Pairing 1**:
  - Headings: `font-display` (`Fredoka`, semi-bold/bold).
  - Body & Explanations: `font-body` (`Lexend`, regular/medium).
  - Code & Metadata: `font-mono-tabular` (`JetBrains Mono`, regular/bold).

---

## 5. Interaction Specifications & State Machine
1. **Persona Switching**:
   - Clicking any persona pill (`new-user`, `steady-improver`, `noisy-low-confidence`, `edge-missing-dim`, `edge-10-dimensions`, `edge-llm-offline`) immediately invokes `setActivePersona()`.
   - When `edge-10-dimensions` is clicked, automatically switches `dimensionPreset` to `'10'`.
   - When `edge-llm-offline` is clicked, automatically switches `simulateLlmDown` to `true`.
   - Displays toast/alert: `"Switched to Persona: {name}. All 19 routes updated."`
2. **Dimension Generalisation Switcher**:
   - Toggles across `3`, `6`, `7`, `8`, and `10` dimensions via `setDimensionPreset()`.
3. **Robustness Fault Injections**:
   - Toggle `simulateOffline`: Immediately mounts/unmounts global offline queue banner in `AppShell.tsx`.
   - Toggle `simulateLlmDown`: Immediately mounts/unmounts deterministic rule fallback banner and switches AI Coach engine on `/coach`.
4. **Interactive Rubric Deep-Links**:
   - Clicking `"Inspect ->"` on any rubric row in the proof table navigates directly to the target route with smooth scroll.
5. **Fast-Track Signature Components Launcher**:
   - 8 one-click cards linking directly to the primary home of each signature component.
6. **1-Click State Reset**:
   - Resets all store state to initial defaults (`resetDemoState()`).

---

## 6. Responsive Breakpoints & Adaptations
- **Desktop (`1440 px`)**: 12-column grid. Fault Injection Studio & Signature Launcher in left 7 columns; `<JudgeModeDock />` and Rubric Scorecard in right 5 columns. Full-width Rubric Table below.
- **Tablet (`768 px`)**: Single-column vertical stacking. Dock renders at top. Rubric table scrolls horizontally (`role="region"` with `tabIndex={0}`).
- **Mobile (`375 px`)**: Compact 1-column layout. Persona switcher becomes a horizontal scrollable strip. All buttons maintain $\ge 44 \times 44\text{ px}$ touch targets.

---

## 7. Accessibility & WCAG 2.1 AA Checklist
- [x] **Contrast AA/AAA**: All interactive controls, badges, and code snippets meet $\ge 4.5:1$ contrast against their parent surfaces.
- [x] **WCAG 2.5.3 (Label in Name)**: Every button has matching visible text and accessible name (no divergent `aria-label`).
- [x] **WCAG 2.4.7 (Focus Visible)**: Clear focus rings on all interactive toggles and links.
- [x] **Keyboard Navigation**: Tab navigates through all persona buttons, fault switches, launcher cards, and table rows; Enter/Space activates.
- [x] **Screen Reader Regions**: Rubric matrix and fault controls wrapped in `<div role="region" aria-label="..." tabIndex={0}>`.

---

## 8. Edge Cases, Error States & Offline Mode
- **Extreme Persona Values**: Verified with `noisy-low-confidence` (hatched bands) and `edge-missing-dim` (null dimension handling).
- **Offline Active**: Confirms that navigating between pages functions seamlessly using client-side mock fixtures.
- **Concurrent Faults**: Handles both `simulateOffline=true` and `simulateLlmDown=true` simultaneously with dual warning banners.

---

## 9. Data Contracts & Backend Integration
- **`AppState`** (from `frontend/src/store/useAppStore.ts`):
  - `activePersona: PersonaId`
  - `dimensionPreset: DimensionPresetKey` ('3' | '6' | '7' | '8' | '10')
  - `simulateOffline: boolean`
  - `simulateLlmDown: boolean`
  - `reducedMotion: boolean`
  - `theme: ThemeMode` ('light' | 'dark')
  - `resetDemoState: () => void`

---

## 10. Definition of Done Checklist (10 Items)
- [x] **DoD 01**: Author `frontend/src/components/signature/JudgeModeDock.tsx` and `frontend/src/pages/JudgeModePage.tsx` matching design tokens.
- [x] **DoD 02**: Render 6 seeded persona switcher with 1-click state transition and badge updates.
- [x] **DoD 03**: Render Fault Injection & Stress Studio with offline mode and LLM-down toggles.
- [x] **DoD 04**: Render Dimension Generalisation switcher (3, 6, 7, 8, 10 dims).
- [x] **DoD 05**: Render Fast-Track Launcher for all 8 Signature Components.
- [x] **DoD 06**: Render interactive Jury Rubric-to-UI Proof Matrix table with 11 criteria and deep links.
- [x] **DoD 07**: Render 1-click Reset Demo State action with confirmation feedback.
- [x] **DoD 08**: Wire route `/judge-mode` into `App.tsx` and navigation in `AppShell.tsx`.
- [x] **DoD 09**: Add unit test in `designSystem.test.tsx` verifying persona switching, fault toggling, and rubric navigation.
- [x] **DoD 10**: Pass all QA checks (`npm run qa:checks`) with 0 errors, 0 `axe-core` violations, 0 overflow, and 5 Playwright screenshots saved to `docs/ui/screenshots/16-judge-mode-*.png`.

---

## 11. Design Critique Self-Review (Rounds 1 & 2)
### Round 1 (Picky Designer)
- **Visual Grouping & Tactile Elevation**: Grouped dock controls into distinct tactile sections (Active Persona, Dimension Generalisation, Fault Injections, Appearance & Accessibility) using 2px border strokes and brand/canvas tints.
- **Token Integrity**: Verified 0 arbitrary pixel/rem brackets in Tailwind utility classes; all colors map directly to semantic design tokens.
- **Typography**: Display elements use `font-display` (Fredoka), body copy in `font-sans` (Lexend), and numbers/percentages in `font-mono` (JetBrains Mono).
- **Interactive Feedback**: Instant toast feedback mounted on persona activation and state reset, clearing after 4 seconds.

### Round 2 (Hostile Juror)
- **Live Reactivity**: Verified that selecting Salma (Noisy & Low-Confidence) or Youssef (Steady Improver) in the dock immediately cascades to all 13 application routes and updates all uncertainty radar plots without full page reloads.
- **Zero Horizontal Overflow on 375px Mobile**: Verified via Playwright that the 11-row rubric matrix is wrapped in a keyboard-scrollable `role="region"` with `tabIndex={0}`, eliminating viewport horizontal scroll (`scrollWidth === clientWidth`).
- **Complete Rubric Accountability**: All 11 evaluation criteria (Phase 1 60% + Phase 2 40%) link directly to their corresponding screens with interactive "Inspect ->" jump links.

---

## 12. Verification & Screenshots
These screenshots were removed with brand v2; they are in the repository history at commit `8b8c859`.

- **1440px Desktop (Playful Lab)**: `docs/ui/screenshots/16-judge-mode-1440.png`
- **Seeded Persona Active (Salma)**: `docs/ui/screenshots/16-judge-mode-persona.png`
- **Fault Injections & 10 Dimensions Active**: `docs/ui/screenshots/16-judge-mode-faults-10dims.png`
- **1440px Dark Mode (Night Lab)**: `docs/ui/screenshots/16-judge-mode-dark.png`
- **768px Tablet Viewport**: `docs/ui/screenshots/16-judge-mode-768.png`
- **375px Mobile Viewport**: `docs/ui/screenshots/16-judge-mode-375.png`
