# 01. Welcome (`/`) · HERO PAGE

## Purpose, user moment, rubric criteria
- **Purpose**: First-impression landing screen that communicates the 4 pillars (*Assess, Understand, Coach, Improve*), proves epistemic honesty at a glance via a live interactive preview of the Uncertainty Radar, and launches users or evaluators into their first insight in under 3 minutes via two clear paths: **"Start 2-Minute Baseline"** or **"Try a Judge Demo Persona"**.
- **User / Evaluator Moment**: Second `0:00` of the 3–5 minute demo video, Slide 2 of the pitch deck, and the very first screen evaluators open. Must survive a video freeze-frame with zero visual clutter.
- **Rubric Criteria Served**:
  - **UX (Phase 1 — 9%)**: First insight in $\le 3$ minutes; unmistakable primary CTA vs. instant Judge Persona bypass.
  - **Relevance (Phase 1 — 12%)**: Clearly labels the 4 challenge pillars (*Assess, Understand, Coach, Improve*), non-biometric guarantee, and dynamic 0–100 Collaboration Score.
  - **Innovation & Profile Quality (Phase 1 — 12% & Phase 2 — 8%)**: Live interactive preview of the Uncertainty Radar (`75% ± 6%` vs hatched low-confidence range) right on the hero canvas.
- **Time Budget**: `2.5 hours` (+50% alert threshold: `3.75 hours`).

---

## Wireframes: desktop, mobile

### Desktop (`1440 px` — Asymmetric 7:5 Split Hero + 4-Pillar Proof Strip + Instant Persona Launcher)
```text
+--------------------------------------------------------------------------------------------------+
| [ST] SynapseTwin · CISTAC 1.0     [Simulated Data]    [3|6|7|10 Dims] [Dark/Light] [Style Guide] |
+--------------------------------------------------------------------------------------------------+
| HERO LEFT (7 cols)                                 | HERO RIGHT (5 cols): LIVE TWIN PREVIEW CARD |
| [Badge: ★ CISTAC 1.0] [✓ Non-Biometric Mode ON]    | +-----------------------------------------+ |
|                                                    | | Live Brain Twin Preview                 | |
| Meet your evolving cognitive twin—                 | | [Calibrated] [Low-Conf] [Partial] [...] | |
| mapped with honest confidence ranges,              | |         ( Uncertainty Radar )           | |
| never fixed labels.                                | |         ● WM 68%±5%  ■ IC 75%±6%        | |
|                                                    | |         ▨ EP 81%±16%                    | |
| [Friendly Companion Guide · State: Hello Slot]     | | [Sample Coaching Explainability Trail]  | |
| [ Start 2-Minute Baseline → ] [Try Demo Persona ↓] | +-----------------------------------------+ |
| [Live Engine & Telemetry Contract Architecture]    |                                             |
| ⏱ First Insight ≤ 3 Mins · 🔒 Privacy · 📐 CI      |                                             |
+----------------------------------------------------+---------------------------------------------+
| THE 4 CHALLENGE PILLARS (Layers A → C + Collaboration Score)                                     |
| +-----------------------+ +-----------------------+ +-----------------------+ +----------------+ |
| | 01 · ASSESS (Layer A) | | 02 · UNDERSTAND       | | 03 · COACH (Layer B)  | | 04 · IMPROVE   | |
| +-----------------------+ +-----------------------+ +-----------------------+ +----------------+ |
+--------------------------------------------------------------------------------------------------+
| INSTANT JUDGE & DEMO PERSONA LAUNCHER (One-Click Teleport to Calibrated Profile)                 |
| +--------------------------------+ +--------------------------------+ +------------------------+ |
| | ● Youssef · Steady Improver    | | ▨ Salma · Irregular Schedule   | | ★ Nour · First-Time    | |
| +--------------------------------+ +--------------------------------+ +------------------------+ |
+--------------------------------------------------------------------------------------------------+
```

### Mobile (`375 px` — Single-Column Priority Stack)
```text
+---------------------------------------+
| [ST] SynapseTwin   [7 Dims] [Theme]   |
+---------------------------------------+
| [★ CISTAC 1.0] [✓ Non-Biometric]      |
| Meet your evolving cognitive twin—    |
| mapped with honest confidence ranges. |
| [ Start 2-Minute Baseline → (44px) ]  |
| [ Try a Judge Demo Persona ↓ (44px) ] |
+---------------------------------------+
| LIVE BRAIN TWIN PREVIEW               |
| [Calibrated] [Low-Conf] [Partial]     |
|       ( Uncertainty Radar )           |
| [View as Table]                       |
+---------------------------------------+
| 4 PILLARS: Assess · Understand ·      |
| Coach · Improve                       |
+---------------------------------------+
| JUDGE PERSONA LAUNCHER                |
| [Card: Youssef · Steady Improver]     |
| [Card: Salma · Irregular Schedule]    |
| [Card: Nour · First-Time Learner]     |
+---------------------------------------+
```

---

## Content and copy deck
- **Eyebrow Badges**:
  - `★ CISTAC 1.0 · Cognitive Growth Agent`
  - `✓ Mandatory Non-Biometric Mode ON`
  - `◈ ${N} Dimensions Configured`
- **Hero Headline**: `Meet your evolving cognitive twin—mapped with honest confidence ranges, never fixed labels.`
- **Hero Subcopy**: `Unlike one-off static tests, SynapseTwin continuously calibrates your profile across ${N} cognitive dimensions, visualizes epistemic uncertainty (±CI), and shows the exact telemetry behind every piece of coaching advice.`
- **Primary CTA**: `Start 2-Minute Baseline →`
- **Secondary CTA**: `Try a Judge Demo Persona ↓`
- **4 Pillars Copy**:
  1. **01 · ASSESS (Layer A)**: `Adaptive Micro-Tasks, Zero Biometrics Required`
  2. **02 · UNDERSTAND (Brain Twin)**: `Historised Profile with Honest Uncertainty Bands`
  3. **03 · COACH (Layer B)**: `Explainable, Non-Clinical Growth Guidance`
  4. **04 · IMPROVE (Layer C + Collab Score)**: `Adaptive Weekly Plans & 0–100 Collaboration Score`

---

## States: loading, empty, partial, error, offline, low confidence
- **Ready (`calibrated`)**: Shows `steady-improver` (Youssef) in the Hero Preview Radar with solid high-confidence bands (`84%` overall confidence).
- **Low Confidence (`low-confidence`)**: Switches the live radar to `noisy-low-confidence` (Salma), highlighting the diagonal SVG hatching (`pattern#low-conf-hatch`) and preliminary range badge.
- **Partial (`partial`)**: Shows how an unassessed dimension (`scorePct: null`) renders cleanly on the preview radar and table.
- **Loading (`loading`)**: Skeleton shimmer state (`role="status"`).
- **Empty (`empty`)**: Zero-data baseline prompt for `new-user` (Nour).
- **Error (`error`)**: Simulated `/v1/dashboard/profile` timeout alert with 1-click `"Retry Preview Load"` recovery.
- **Extreme Values (`extreme-text`)**: Overflow & high-magnitude stress check (`99.8% ± 0.2% · 9,999,999 events · 18,450 ms`).
- **Offline & LLM-Down**: Respects global `<AppShell />` banners.

---

## Interactions and motion (with the reduced-motion variant)
- **Hero Preview State Switcher**: Instant tab switch between `Calibrated (84%)`, `Low-Conf (Hatched)`, `Partial (1 Missing)`, `Loading`, `Empty (New)`, `Error`, and `Extreme Values` inside the right hero card.
- **1-Click Persona Launcher Cards**: Clicking any of the 3 persona cards at the bottom updates `useAppStore.activePersona`, syncs the Hero Preview Radar, and displays an accessible `role="status"` banner confirming the loaded persona.
- **Tactile Motion**: Buttons depress `translateY(2px)` on `:active` over `--duration-fast` (`120ms`); disabled under `prefers-reduced-motion: reduce` or `data-reduced-motion="true"`.
- **Mascot Slot**: Reserves `data-mascot-slot="welcome-hero"` with a friendly non-clinical greeting badge that upgrades to `<Mascot state="hello" />` during the Mascot Sprint (after Dashboard exists).

---

## Data contract (types) and the mock fixtures used
- **Types (`frontend/src/contracts/` & `frontend/src/config/`)**:
  - `DimensionConfig[]` from `getDimensionsByPreset(dimensionPreset)` (`3 | 6 | 7 | 8 | 10` dimensions).
  - `DimensionEstimate[]` from `buildEstimatesForDimensions(dimensions, previewPersona)`.
  - `CollaborationScorePayload` (`SAMPLE_COLLABORATION_SCORE`) for Pillar 04 (`82 ± 4`).
  - `WhyThisTrail` (`SAMPLE_WHY_THIS_TRAIL`) embedded inside the Hero Preview card.

---

## Accessibility notes: focus order, labels, chart table alternative
- **Heading Hierarchy**: Single `<h1>` (`Meet your evolving cognitive twin...`), `<h2>` for *Live Brain Twin Preview*, *How SynapseTwin Closes the Cognitive Growth Loop*, and *Try a Seeded Demo Persona (First Insight in 1 Click)*, `<h3>` for individual pillar and persona cards.
- **Focus Order**: Skip link $\rightarrow$ Global header controls $\rightarrow$ Primary CTA (`Start 2-Minute Baseline →`) $\rightarrow$ Secondary CTA (`Try a Judge Demo Persona ↓`) $\rightarrow$ Design System link $\rightarrow$ Hero Preview tabs & `"View as Table"` toggle $\rightarrow$ `"Inspect reasoning trail"` button $\rightarrow$ 4 Pillar cards $\rightarrow$ 3 Persona launcher buttons.
- **Touch Targets**: All CTAs, preview tabs, and persona launcher buttons enforce `min-h-11` (`44px`).
- **Chart Table Alternative**: Hero `<UncertaintyRadar />` includes the 1-click `"View as Table"` button.

---

## Step 7 Critique Log (Picky Designer & Hostile Juror)
1. **Round 1 — Picky Designer Critique**:
   - *Finding 1*: Initial Tailwind v4 `@theme` self-reference (`--color-canvas: var(--color-canvas)`) caused circular CSS custom properties; fixed in `tokens.css` by defining Playful Lab defaults inside `@theme` and wrapping resets/primitives in `@layer base` and `@layer components`.
   - *Finding 2*: In `01-welcome-1440.png`, the left 7-column hero card was shorter than the right 5-column card, leaving dead canvas below the left column, and `Badge` pills allowed text wrapping (`Confidence \n 86%`).
   - *Fix Applied*: Added `whitespace-nowrap shrink-0` to `Badge.tsx` and made the 7:5 hero grid `items-stretch` with `flex flex-col justify-between`.
2. **Round 2 — Hostile Juror Critique**:
   - *Finding*: *"Does this landing screen prove technical depth (QUEST+ 85% target, SAT-JEPA Δc, 8 task schemas) before a judge even clicks into the app?"*
   - *Fix Applied*: Added the **Live Engine & Telemetry Contract Architecture** strip (`QUEST+ / 85%`, `SAT-JEPA Δc`, `95% ±CI Bands`, `0 Biometrics`) into the lower section of the left Hero card, aligning both Hero columns at `1440px` while surfacing mathematical rigor above the fold.

---

## Acceptance checklist (from the Definition of Done)
- [x] Matches this approved spec; any deviation logged in `DECISIONS.md`.
- [x] Only design tokens used (`npm run lint:tokens` exits 0).
- [x] All states (ready, low-confidence hatched, partial, loading, empty, error, offline, extreme text) implemented and screenshotted.
- [x] Contrast computed via `check-contrast.mjs` ($\ge 4.5:1$ text, $\ge 3.0:1$ UI/marks).
- [x] Complete keyboard navigation, `3px` focus ring, logical tab order, $\ge 44\text{ px}$ targets.
- [x] Reduced motion respected.
- [x] Color never carries meaning alone (vertex shapes + glyph badges + table toggle).
- [x] Copy passes `npm run lint:copy` with zero clinical or guilt terms.
- [x] Zero CLS, zero horizontal scroll at `375 px`, survives `200%` zoom.
- [x] Code-split route (`React.lazy` — `WelcomePage` chunk `16.08 kB` / `5.07 kB` gzipped).
- [x] Unit/component tests (`5/5` pass) + Playwright axe-core check (`0` violations in Light & Dark).
- [x] Works seamlessly with 3, 6, 7, 8, and 10 dimensions.
- [x] Docs, screenshots, `STATE.md` and commit are done.

---

## Decisions and known issues
- **Decisions**: Reserve `data-mascot-slot="welcome-hero"` on Page 01 until Page 06 (Dashboard) is built, honoring Section 7 (*"Start it only after the design direction is locked and the dashboard exists"*).
- **Known Issues**: None.

---

## Screenshots (paths) and commit hashes
- `docs/ui/screenshots/01-welcome-1440.png`
- `docs/ui/screenshots/01-welcome-768.png`
- `docs/ui/screenshots/01-welcome-375.png`
- `docs/ui/screenshots/01-welcome-10dims-hatched-1440.png`
- `docs/ui/screenshots/01-welcome-dark-1440.png`
