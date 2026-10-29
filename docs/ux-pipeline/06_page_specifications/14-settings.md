# Page 14 Specification: Settings & Accessibility Controls (`/settings`)

- **Page Name & Route**: Settings & Accessibility Controls (`/settings`)
- **Primary Users**: Neurodivergent learners, screen reader users, keyboard-only operators, students requiring sensory adjustments, and competition evaluators.
- **Challenge Goals**:
  1. **Comprehensive Cognitive Ergonomics & Neurodiversity**: Provide granular visual, motor, and auditory adaptation controls that accommodate varying sensory profiles (ADHD, sensory sensitivity, low vision, motor tremors) without punitive penalties.
  2. **Live Preference Preview**: Reflect changes to theme mode, motion reduction, font scaling, and high-contrast tokens immediately across all views in real time.
  3. **Zero-Guilt Notification & Rest Policies**: Allow users to configure non-punitive reminder frequencies and quiet study windows, respecting intentional rest days.
  4. **Keyboard Remapper & Ergonomics**: Display clear keyboard shortcuts for task execution (`1/2/3`, `Space`, `Escape`, `?`) with conflict-free operation.
- **Rubric Criteria Mapping**:
  - **UX (Phase 1, 9% final)** — Full WCAG 2.1 AA compliance, custom font scaling (100%–130%), reduced motion toggle, sensory dampening, keyboard ergonomics.
  - **Quality (Phase 1, 12% final)** — Token-driven preferences persisted to `localStorage`; instant visual feedback; zero unstyled controls.
  - **Safety (Phase 1, 6% final)** — Zero-guilt streak protection settings, notification boundaries, direct linkage to Sovereign Privacy Center.
  - **Generalisation (Phase 2, 10% final)** — Dimension preset configuration (3, 6, 7, 8, 10 dims), direction/locale readiness (`ltr` / `rtl`).

---

## 1. Cognitive & Product Purpose

Cognitive performance assessments and adaptive tutoring environments place unique cognitive demands on users. Users experiencing sensory fatigue, visual crowding, or motor coordination challenges frequently underperform on standard reaction-time and recall probes—not due to underlying cognitive deficits, but due to interface friction.

Page 14 establishes **SynapseTwin's Cognitive Ergonomics Suite**:
1. **Sensory & Visual Adaptations**:
   - Theme Mode switching (Warm Playful Lab `#FFF8EE` vs. Focused Night Lab `#0B1020`).
   - Granular font scale adjustment (`100%`, `115%`, `130%`) adhering to WCAG 1.4.4 Resize Text without truncating critical data cards.
   - High-contrast visual marker enhancement (amplifies Okabe-Ito geometric glyph contrast on radar and chart axes).
2. **Motion & Vestibular Comfort**:
   - `prefers-reduced-motion` synchronization: Disables SVG orbital animations, timeline spring physics, and continuous pulse rings, replacing them with instantaneous transitions.
3. **Cognitive Fatigue & Sound Management**:
   - Subconscious audio cue volume adjustments (low-frequency chime, click feedback, or complete silent mode for zero distraction).
4. **Non-Punitive Habit & Study Boundaries**:
   - Configuration of preferred study windows (Morning Peak, Afternoon Focus, Evening Recharge) and intentional rest days, ensuring the Bayesian trajectory algorithms never interpret planned pauses as lapse in commitment.
5. **Cognitive Dimension Registry Default**:
   - Quick selector for default dimension preset (3, 6, 7 default, 8, 10 stress).

---

## 2. Information Architecture & Wireframes

### Desktop Viewport (`1440 px`)

```text
+----------------------------------------------------------------------------------------------------+
|  [ST] SynapseTwin CISTAC 1.0       Active: 7 Dims · Night Lab Switch · Offline Banner              |
+----------------------------------------------------------------------------------------------------+
|  [⚙ Cognitive Ergonomics] [Neurodiversity Grounded] [WCAG 2.1 AA Verified ●]                       |
|                                                                                                    |
|  Settings & Accessibility Controls                                   [ ⚖ Jump to Judge Mode → ]    |
|  Personalize sensory presentation, keyboard ergonomics, notification boundaries, and dimensions.   |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +------------------------------------------------------+  +-------------------------------------+ |
|  | LEFT 7 COLUMNS: ACCESSIBILITY & PREFERENCE CONTROLS  |  | RIGHT 5 COLUMNS: LIVE PREVIEW & DS  | |
|  |                                                      |  |                                     | |
|  | [1. Visual & Sensory Ergonomics]                     |  | Live Visual Ergonomics Preview:     | |
|  | Theme:  (●) Light (Playful Lab)  (○) Dark (Night)    |  | +---------------------------------+ | |
|  | Text Scale: [ 100% ]  [ 115% ]  [ 130% (High Zoom) ] |  | | Sample Cognitive Card Preview   | | |
|  | High-Contrast Glyph Markers: [x] Enhanced (● ■ ▲)   |  | | Working Memory: 78% ± 4%        | | |
|  |                                                      |  | | [● Circle Glyph] [Okabe-Ito]    | | |
|  | [2. Motion & Animation Physics]                      |  | +---------------------------------+ | |
|  | Reduced Motion Mode: [ Switch: ON / OFF ]            |  |                                     | |
|  | -> Disables spring physics and continuous pulses.    |  | Keyboard Shortcut Remapping:        | |
|  |                                                      |  | ◈ Answer 1: [ Key 1 ] [Custom]   | |
|  | [3. Auditory Feedback & Task Pacing]                 |  | ◈ Answer 2: [ Key 2 ] [Custom]   | |
|  | Task Audio Cues: (●) Subconscious Chime  (○) Mute    |  | ◈ Pause / Resume: [ Space ]      | |
|  | Auto-Pause on Window Blur: [x] Enabled (Mandatory)   |  | ◈ Help Overlay:   [ ? ]          | |
|  |                                                      |  |                                     | |
|  | [4. Non-Punitive Habit & Study Windows]              |  | Sovereign Privacy & Data:           | |
|  | Preferred Study Window: [ Morning Peak (08:00–12:00) ]|  | [ Open Privacy Center (/privacy) → ]| |
|  | Protected Rest Days: [x] Wed  [x] Sun (Zero Penalty) |  | [ Reset All Preferences to Default ]| |
|  |                                                      |  |                                     | |
|  | [5. Dimension Pool Registry Preset]                  |  | Juror Quick Evaluation Notes:       | |
|  | Cognitive Dimension Pool: [ 7 Dims (Standard) v ]    |  | "Changes persist in LocalStorage    | |
|  +------------------------------------------------------+  +-------------------------------------+ |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|  ACCESSIBLE SHORTCUT & ERGONOMICS REFERENCE TABLE (Keyboard-Scrollable Region)                    |
|  Action Name         | Primary Shortcut | Alternate Key | Context            | Scope           |
|  Select Option 1     | Key 1            | NumPad 1      | Task Runner Probes | In-Task Only    |
|  Select Option 2     | Key 2            | NumPad 2      | Task Runner Probes | In-Task Only    |
|  Pause Task          | Space            | 'P'           | Task Runner Probes | In-Task Only    |
|  Exit to Safety      | Escape           | Alt+X         | Global Navigation  | Universal       |
+----------------------------------------------------------------------------------------------------+
|  [Why this cognitive accessibility architecture? Expandable Epistemic Trail]                       |
+----------------------------------------------------------------------------------------------------+
```

### Mobile Viewport (`375 px`)

```text
+-----------------------------------+
| [ST] SynapseTwin       [Menu ☰]   |
+-----------------------------------+
| [⚙ Ergonomics] [WCAG AA ●]        |
| Settings & Accessibility          |
+-----------------------------------+
| Visual Presentation:              |
| Theme: [☀ Light]  [☾ Dark]        |
| Text Zoom: [100%] [115%] [130%]   |
| Enhanced Markers: [x] On          |
+-----------------------------------+
| Motion Physics:                   |
| Reduced Motion: [ Switch: ON ]    |
+-----------------------------------+
| Audio & Pacing:                   |
| Sound Effects: [○ Mute] [● Chime] |
| Window Blur Auto-Pause: [x] Active|
+-----------------------------------+
| Habit Boundaries:                 |
| Window: [Morning Focus 08:00]     |
| Rest Days: Wed, Sun (Preserved)   |
+-----------------------------------+
| Shortcuts Quick Guide:            |
| 1 / 2: Answer Probe               |
| Space: Pause Task                 |
| Esc: Return to Hub                |
+-----------------------------------+
| [ Reset All Preferences ]         |
+-----------------------------------+
```

---

## 3. Component Inventory & Design Tokens

- **Card Container**: `tactile-card p-6 bg-surface border-2 border-border-strong rounded-2xl space-y-6 shadow-sm`
- **Section Headers**: `font-display font-bold text-lg text-ink pb-2 border-b border-border`
- **Toggles / Switches**: Accessible `<button role="switch">` with high-contrast active state (`bg-brand text-brand-ink`).
- **Segmented Radio Controls**: Accessible radio pill group (`role="radiogroup"`) for Theme, Text Zoom, and Dimension Preset.
- **Preview Card**: `p-4 rounded-xl border border-border bg-canvas/40` rendering dynamic preview of selected typography and tokens.
- **Buttons**:
  - Primary: `Button variant="primary"`
  - Secondary: `Button variant="secondary"`
  - Reset Defaults: `Button variant="secondary"` with toast confirmation
- **Mascot Companion**: Layered SVG `<Mascot state="idle" size="md" />` providing friendly reassurance.

---

## 4. User Interactions & State Transitions

1. **Theme Switcher**:
   - Toggles between `light` (`Playful Lab`) and `dark` (`Night Lab`). Immediately applies `data-theme` to `<html>` and saves to `useAppStore`.
2. **Text Scaling Selector**:
   - Toggles between `100%`, `115%`, and `130%`. Immediately updates sample card preview and root font variable.
3. **Reduced Motion Toggle**:
   - Toggles `reducedMotion` state in `useAppStore`, synchronizing `data-reduced-motion` on `<html>`.
4. **Enhanced Glyph Markers**:
   - Toggles geometric marker clarity on cognitive dimensions (`●`, `■`, `▲`, `◆`, `⬟`, `⬢`, `★`, `✚`, `◎`, `⧗`).
5. **Dimension Preset Selector**:
   - Directly manipulates `dimensionPreset` (`3`, `6`, `7`, `8`, `10`), updating active cognitive pool throughout the app.
6. **Habit Windows & Rest Days**:
   - Checkboxes allow selecting rest days (e.g. Wednesday, Sunday) which preserves zero-guilt streak protection contracts on `/goals`.
7. **1-Click Reset to Factory Defaults**:
   - Restores default settings (`theme: 'light'`, `reducedMotion: false`, `dimensionPreset: '7'`, text scale: `100%`).

---

## 5. Responsive Breakpoints & Adaptations

- **Desktop (`1440 px`)**: 12-column grid. Setting category cards in left 7 columns; live interactive preview card, keyboard shortcuts guide, and quick privacy link in right 5 columns. Full-width keyboard reference table below.
- **Tablet (`768 px`)**: Single-column vertical stacking. Setting categories stack cleanly. Table wrapped in keyboard-scrollable `role="region"` with `tabIndex={0}`.
- **Mobile (`375 px`)**: Single-column layout. Form controls expand to 100% width with min touch target $\ge 44 \times 44\text{ px}$. Zero horizontal overflow (`scrollWidth === clientWidth`).

---

## 6. Accessibility & WCAG 2.1 AA Checklist

- [x] **WCAG 1.4.3 (Contrast Minimum)**: All interactive toggles, badge labels, and text meet $\ge 4.5:1$ contrast ratio.
- [x] **WCAG 1.4.4 (Resize Text)**: Controls and cards gracefully support scaling up to 130% without horizontal scroll or text collision.
- [x] **WCAG 2.1.1 (Keyboard Navigation)**: Every toggle, radio pill, checkbox, and button is fully reachable and actionable via Tab and Enter/Space.
- [x] **WCAG 2.5.3 (Label in Name)**: Button accessible names strictly match visible labels (no divergent `aria-label`).
- [x] **WCAG 2.4.7 (Focus Visible)**: Clear, unambiguous focus rings (`focus-ring`) on all interactive controls.
- [x] **Screen Reader Feedback**: Dynamic preference changes announced via `role="status"` and `aria-live="polite"`.

---

## 7. Edge Cases, Neurodiversity & Offline Persistence

- **Sensory Overload Mitigation**: One-click "Calm Sensory Mode" disables sounds, animations, and high-frequency visual accents simultaneously.
- **Local Storage Corruption**: If saved settings cannot be parsed, safely falls back to standard defaults without crashing.
- **Complete Offline Functionality**: Settings are stored client-side in LocalStorage and Zustand; zero network calls required to modify or save preferences.

---

## 8. Data Contracts & Store Slices

- **`AccessibilityPreferences`**:
  ```ts
  export interface AccessibilityPreferences {
    theme: 'light' | 'dark'
    textScale: '100' | '115' | '130'
    reducedMotion: boolean
    enhancedGlyphs: boolean
    soundEffects: boolean
    blurAutoPause: boolean
    studyWindow: string
    restDays: string[]
    dimensionPreset: '3' | '6' | '7' | '8' | '10'
  }
  ```
- **`AppState`** (from `frontend/src/store/useAppStore.ts`):
  - `theme: ThemeMode`
  - `setTheme: (theme: ThemeMode) => void`
  - `reducedMotion: boolean`
  - `setReducedMotion: (reduced: boolean) => void`
  - `dimensionPreset: DimensionPresetKey`
  - `setDimensionPreset: (preset: DimensionPresetKey) => void`
  - `resetDemoState: () => void`

---

---

## 9. Definition of Done Checklist (10 Items)

- [x] **DoD 01**: Author [`SettingsPage.tsx`](file:///c:/Users/Smida/Desktop/CISTAC/frontend/src/pages/SettingsPage.tsx) matching design tokens and semantic classes.
- [x] **DoD 02**: Render Theme Mode selector (Playful Lab vs. Night Lab) with real-time application and `data-theme` synchronization.
- [x] **DoD 03**: Render Text Scaling controls (100%, 115%, 130%) with live interactive cognitive card preview.
- [x] **DoD 04**: Render Reduced Motion toggle with instant `data-reduced-motion` attribute update on root element.
- [x] **DoD 05**: Render Enhanced Glyph Markers toggle displaying Okabe-Ito geometric symbols.
- [x] **DoD 06**: Render Cognitive Dimension Pool preset switcher (3, 6, 7, 8, 10 dims) synced with `useAppStore`.
- [x] **DoD 07**: Render Non-Punitive Habit & Study Windows with protected rest days checkboxes.
- [x] **DoD 08**: Render accessible keyboard shortcuts reference table (`role="region"` with `tabIndex={0}`).
- [x] **DoD 09**: Wire route `/settings` in [`App.tsx`](file:///c:/Users/Smida/Desktop/CISTAC/frontend/src/App.tsx) and navigation link in [`AppShell.tsx`](file:///c:/Users/Smida/Desktop/CISTAC/frontend/src/components/layout/AppShell.tsx).
- [x] **DoD 10**: Pass all QA checks (`npm run qa:checks`), 0 `axe-core` violations, 0 overflow, and save 6 Playwright screenshots to `docs/ui/screenshots/14-settings-*.png`.

---

## 10. Design Critique Self-Review (Rounds 1 & 2)

- **Round 1 (Picky Designer)**:
  - *Observation*: Standard browser checkboxes and radio pills frequently appear small and generic, clashing with the Playful Lab aesthetic.
  - *Correction Applied*: Created custom high-contrast tactile cards and pill buttons with distinct 2px borders, active fill styling, and visible focus rings.
  - *Observation*: Font scaling can easily break card aspect ratios or cause text collision.
  - *Correction Applied*: Tested dynamic cognitive preview card at 100%, 115%, and 130% zoom, ensuring fluid height and zero text truncation.
- **Round 2 (Hostile Juror)**:
  - *Question*: "Does switching theme or text zoom in settings actually affect the live app, or is it just isolated mock UI?"
  - *Evidence*: Theme and text scale directly mutate `document.documentElement` attributes (`data-theme`, `data-reduced-motion`, `data-text-scale`), and synchronize with Zustand store slice, instantaneously propagating across all routes.
  - *Question*: "Are the keyboard shortcuts accessible for non-mouse users?"
  - *Evidence*: The shortcuts reference table is wrapped in a dedicated keyboard-focusable region (`role="region"`, `tabIndex={0}`) with `<kbd>` tags and clear scope definitions.

---

## 11. Verification Evidence & Screenshots

All 6 screenshots captured and verified:
1. `14-settings-desktop-overview.png` — Full desktop 1440px overview in Playful Lab Light theme with all 5 settings cards and live preview.
2. `14-settings-calm-sensory-mode.png` — Calm Sensory Mode engaged with toast notification banner.
3. `14-settings-night-lab.png` — Night Lab Dark mode (`data-theme="dark"`) with verified contrast.
4. `14-settings-high-zoom-130.png` — High cognitive zoom (130%) dynamically updating preview card.
5. `14-settings-shortcuts-table.png` — Accessible keyboard shortcuts reference table (`role="region"`, `tabIndex={0}`).
6. `14-settings-mobile.png` — Mobile 375px responsive layout with zero horizontal overflow.
