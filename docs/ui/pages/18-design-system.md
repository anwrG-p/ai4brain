# 18. Living Style Guide (`/design-system`)

> **Superseded (history).** This spec describes the page before brand v2. Now: `/design-system` redirects to Home; tokens live in `frontend/src/styles/tokens.css`. Current route map: `docs/design/BRAND-V2.md`. Kept as a record; not maintained.

## Purpose, user moment, rubric criteria
- **Purpose**: Single source of truth for all visual tokens, typography, Okabe-Ito WCAG 3:1 dimension scales (3 to 10 dimensions), interactive UI primitives, signature component previews, and live automated QA checks (WCAG contrast calculator + Non-Clinical Copy Linter).
- **User / Evaluator Moment**: Visited by teammates reusing components and by IEEE judges inspecting craft, accessibility rigor, and design-system consistency.
- **Rubric Criteria Served**:
  - **Quality (Phase 1 — 12%)**: Proves one coherent token-driven design system with computed contrast and reusable primitives.
  - **Generalisation (Phase 2 — 10%)**: Live 3-to-10 dimension palette & marker shape switcher.
  - **Safety & Accessibility (Phase 1 — 6% & 9%)**: Interactive Non-Clinical Copy Linter sandbox, Light/Dark theme switch, and Reduced Motion toggle.
- **Time Budget**: `2.5 hours` (+50% alert threshold: `3.75 hours`).

---

## Wireframes: desktop, mobile

### Desktop (`1440 px` — 2-Column Sticky Spec Layout)
```text
+--------------------------------------------------------------------------------------------------+
| [SynapseTwin Logo]  Living Design System (/design-system)   [Theme: Light/Dark] [Reduced Motion] |
+----------------------+---------------------------------------------------------------------------+
| STICKY SECTION NAV   | HERO BANNER: Playful Lab + Night Lab · OKLCH Token System (v1.0)          |
| 1. Color & Contrast  | [Badge: 100% Token Coverage] [Badge: WCAG 2.1 AA/AAA Verified]            |
| 2. Dimension Scale   +---------------------------------------------------------------------------+
| 3. Typography        | SECTION 1: SEMANTIC COLOR ROLES & COMPUTED CONTRAST TABLE                 |
| 4. Spacing & Tactile | +-----------------+-----------------+-----------------+-----------------+ |
| 5. Buttons & Inputs  | | Canvas #FFF8EE  | Surface #FFFFFF | Brand #0F766E   | Reward #FFC83D  | |
| 6. Cards & Badges    | | Ink 15.61:1 AAA | Ink 16.92:1 AAA | White 5.48:1 AA | Ink 10.64:1 AAA | |
| 7. Uncertainty UI    | +-----------------+-----------------+-----------------+-----------------+ |
| 8. Copy Linter Live  +---------------------------------------------------------------------------+
| 9. Do / Don't Rules  | SECTION 2: DIMENSION REGISTRY PALETTE (Interactive: [3] [6] [7] [10] Dims)|
|                      | [● WM #0072B2 4.9:1] [■ IC #C45100 4.2:1] [▲ CF #008662 4.1:1] ...        |
|                      +---------------------------------------------------------------------------+
|                      | SECTION 3–7: TYPE SPECIMEN, BUTTON MATRIX (7 STATES), CARDS, UNCERTAINTY  |
|                      +---------------------------------------------------------------------------+
|                      | SECTION 8: LIVE NON-CLINICAL COPY LINTER SANDBOX                          |
|                      | [Input: Test any coach/UI sentence...] -> [PASS / FLAGGED TERMS + FIX]    |
+----------------------+---------------------------------------------------------------------------+
```

### Mobile (`375 px` — Single-Column Stack with Horizontal Pill Nav)
```text
+---------------------------------------+
| SynapseTwin · Design System           |
| [Light/Dark] [Motion: ON/OFF]         |
+---------------------------------------+
| [Colors] [Dims] [Type] [Buttons] ...  |
+---------------------------------------+
| 1. SEMANTIC TOKENS & WCAG RATIOS      |
| [Card: Canvas #FFF8EE · 15.61:1 AAA]  |
| [Card: Brand #0F766E  · 5.48:1 AA ]   |
+---------------------------------------+
| 2. DIMENSION PALETTE ([3][6][7][10])  |
| ● WM (4.9:1)  ■ IC (4.2:1)            |
+---------------------------------------+
| 3. BUTTONS & INPUTS (≥44px targets)   |
| [ Primary CTA ]                       |
| [ Secondary   ]                       |
+---------------------------------------+
```

---

## Content and copy deck
- **Page Header Title**: `SynapseTwin Living Design System`
- **Page Subtitle**: `Token-first architecture combining Playful Lab warmth with epistemic and accessibility rigor. Every color ratio is computed via WCAG 2.1 relative luminance.`
- **Section Headings**:
  1. `01 · Semantic Color Tokens & Computed Contrast`
  2. `02 · Okabe-Ito Dimension Scale (3 to 10 Dimensions)`
  3. `03 · Typography Scale (Fredoka · Lexend · JetBrains Mono)`
  4. `04 · 4 px Grid, Radii & Tactile Elevation`
  5. `05 · Interactive Primitives & All 7 States`
  6. `06 · Epistemic Uncertainty & Why-This Primitives`
  7. `07 · Live Non-Clinical Copy Linter`
  8. `08 · Component Anatomy: Do & Don't`
- **Do / Don't Copy**:
  - **Do**: *"Pair every percentage estimate with its confidence interval (e.g., 76% ± 5%) and use diagonal hatching when confidence is below 0.60."*
  - **Don't**: *"Never display naked scores as fixed traits, never use coral (#FF6B6B) for text, and never use clinical or guilt-inducing language."*

---

## States: loading, empty, partial, error, offline, low confidence
- **Loading**: Skeleton placeholders (`var(--color-surface-raised)`) matching exact card heights (`min-h-[140px]`) so CLS = `0.00`.
- **Empty**: When filtering component tokens with no match, shows a clean card with a `"Reset token filter"` CTA.
- **Partial**: Displays a live preview of a Partial Dimension Card (`scorePct: null`, `"Not yet assessed — 2 min baseline ready"`).
- **Error**: Interactive demo of `<SystemStateCard variant="error" />` with retry handler.
- **Offline / LLM-Down**: Interactive preview toggles for the global `<OfflineBanner />` and `<LlmFallbackBanner />`.
- **Low Confidence**: Side-by-side comparison of High Confidence (`0.86`, solid fill) vs. Low Confidence (`0.48`, diagonal SVG hatch `url(#low-confidence-hatch)` + preliminary badge).

---

## Interactions and motion (with the reduced-motion variant)
- **Theme Switcher**: Instant CSS variable swap (`data-theme="light"` vs `data-theme="dark"`) persisted in Zustand preferences store.
- **Dimension Count Switcher (`3 | 6 | 7 | 10`)**: Dynamically re-renders the dimension swatch grid and mini radar polygon to prove 3-to-10 dimension scalability.
- **Tactile Buttons**: Hover lifts brightness slightly; `:active` translates `Y` by `+2px` while compressing `--shadow-tactile` from `3px` to `1px` over `--duration-fast` (`120ms`).
- **Reduced-Motion Variant**: Toggling `Reduced Motion` (or OS `prefers-reduced-motion: reduce`) sets `data-reduced-motion="true"`, removing vertical button translation and replacing shimmer skeletons with static high-contrast borders.

---

## Data contract (types) and the mock fixtures used
- **Types (`frontend/src/contracts/`)**:
  - `DimensionConfig` (`id`, `code`, `name`, `backendDimensionKey`, `schemaTypes`, `colorToken`, `markerShape`, `scientificDefinition`)
  - `ContrastPairReport` (`role`, `fgHex`, `bgHex`, `ratio`, `level`: `'AAA' | 'AA' | 'AA-Large' | 'FAIL'`)
  - `CopyLintResult` (`isClean`, `flaggedTerms`, `suggestions`)
- **Fixtures Used**:
  - `DIMENSION_PRESETS.sevenDefault`, `DIMENSION_PRESETS.sixBackend`, `DIMENSION_PRESETS.threeMinimal`, `DIMENSION_PRESETS.tenSurprise`
  - Sample high-confidence (`WM: 76% ± 5%`) and low-confidence (`EP: 54% ± 18%`) `DimensionEstimate` fixtures.

---

## Accessibility notes: focus order, labels, chart table alternative
- **Landmarks**: `<header role="banner">`, `<nav aria-label="Design system sections">`, `<main id="main-content">`, and skip-to-content link as first focusable element.
- **Focus Order**: Skip link $\rightarrow$ Theme/Motion header controls $\rightarrow$ Section jump pills $\rightarrow$ Interactive component matrix $\rightarrow$ Copy Linter input & test chips.
- **Touch Targets**: Every button, filter pill, and switch enforces `min-h-11` (`44px`) and `min-w-11` (`44px`).
- **Chart Table Alternative**: The Uncertainty preview chart includes an accessible `<button aria-expanded>` toggle revealing a semantic `<table>` with `scope="col"` headers.

---

## Acceptance checklist (from the Definition of Done)
- [x] Matches this approved spec; any deviation logged in `DECISIONS.md`.
- [x] Only design tokens used (`npm run lint:tokens` exits 0).
- [x] All states (loading, empty filter, partial card, error card, offline banner, low-confidence hatch, long text, huge numbers) implemented and screenshotted.
- [x] Contrast computed via `check-contrast.mjs`: body text $\ge 4.5:1$, UI boundaries & dimension marks $\ge 3.0:1$.
- [x] Complete keyboard navigation, `3px` focus ring, logical tab order, $\ge 44\text{ px}$ targets.
- [x] Reduced motion respected.
- [x] Color never carries meaning alone (dimension shapes `● ■ ▲ ◆ ⬠ ⬢ ★ ✚ ◎ ⧗` + table toggle).
- [x] Copy passes `npm run lint:copy` with zero clinical or guilt terms.
- [x] Zero CLS, zero horizontal scroll at `375 px`, survives `200%` zoom.
- [x] Code-split route (`React.lazy` — `DesignSystemPage` chunk `21.69 kB` gzipped).
- [x] Unit tests for contrast calculator, copy linter, and dimension registry (3 to 10 dims) + Playwright axe check (`0` violations in Light & Dark).
- [x] Works seamlessly with 3, 6, 7, 8, and 10 dimensions.
- [x] Docs, screenshots, `STATE.md` and commit are done.

---

## Decisions and known issues
- **Decisions**: Governed by `DEC-001` through `DEC-006` in [`DECISIONS.md`](../DECISIONS.md).
- **Critique Fixes Applied (Step 7)**:
  - **D1 & D2 (Picky Designer)**: Increased radar label radius to `142` with vertical top/bottom boost and `paintOrder="stroke"` halo; implemented all 10 distinct SVG geometric vertex markers (`circle`, `square`, `triangle`, `diamond`, `pentagon`, `hexagon`, `star`, `cross`, `ring`, `hourglass`).
  - **D3 (Picky Designer)**: Added mobile-first stacked contrast cards (`sm:hidden`) so `375 px` screenshots display all 21 WCAG ratios without horizontal table clipping.
  - **J1 & J2 (Hostile Juror)**: Added copy-pasteable teammate reuse snippet & accessibility contract in Section 04, and captured dedicated multi-state screenshot (`18-design-system-states-1440.png`).
- **Time Burn-down**: Budget `2.5 h` | Actual `1.8 h` (`0.7 h` under budget).
- **Known Issues**: None.

---

## Screenshots (paths) and commit hashes
- `docs/ui/screenshots/18-design-system-1440.png` (1440 px Desktop — Playful Lab Light, 7 dimensions)
- `docs/ui/screenshots/18-design-system-768.png` (768 px Tablet)
- `docs/ui/screenshots/18-design-system-375.png` (375 px Mobile — responsive contrast cards)
- `docs/ui/screenshots/18-design-system-10dims-1440.png` (1440 px — 10-Dimension Generalisation Stress Test)
- `docs/ui/screenshots/18-design-system-dark-1440.png` (1440 px — Night Lab Dark Theme)
- `docs/ui/screenshots/18-design-system-states-1440.png` (1440 px — Offline/LLM-Down banners + Error State + Flagged Copy Linter)

