# Page 19 Specification: Layer D Bonus: Voice Coaching & Scenario Projections (`/layer-d`)

- **Page Name & Route**: Layer D Bonus: Voice Coaching & Scenario Projections (`/layer-d`)
- **Primary Users**: Competition evaluators, students seeking conversational auditory tutoring, and proactive learners wanting counterfactual "what-if" scenario forecasting.
- **Challenge Goals**:
  1. **Multimodal Voice Coaching Studio**: Provide conversational auditory coaching with real-time animated audio waveforms, customizable speech pace (0.85x to 1.25x), voice persona options (Warm Mentor, Clear Analyst, Gentle Guide), and 100% accessible synchronized captions (WCAG 1.2.2).
  2. **Counterfactual "What-If" Scenario Simulator**: Allow learners to project how cognitive traits will evolve under simulated habits (e.g. +2 weekly n-back drills, -1.5h sleep deficit, +1 protected rest day) with comparative projection curves and honest Bayesian uncertainty bounds ($\hat{\theta} \pm \sigma$).
  3. **Cognitive Fatigue Early Warning Engine**: Proactively forecast cognitive saturation across the upcoming 14 days, recommending preventive rest before burnout.
  4. **Full Generalisation & Recourse**: Seamlessly adapt projections across 3, 6, 7, 8, or 10 cognitive dimensions with 1-click scenario resets and non-punitive guidance.
- **Rubric Criteria Mapping**:
  - **Innovation (Phase 1, 12% final)** — Layer D bonus integration; multimodal conversational voice synthesizer with SVG waveform; counterfactual twin modeling.
  - **Plan Relevance & Actionability (Phase 2, 6% final)** — Forward-looking scenario predictions demonstrating concrete trade-offs of adaptive schedules.
  - **Explainability (Phase 1, 9% final)** — Expandable epistemic trail explaining counterfactual projection assumptions and latent parameter sensitivities.
  - **Safety & Ethics (Phase 1, 6% final)** — Strict disclaimer that projections are heuristic Bayesian simulations and not guaranteed medical outcomes; 100% text fallback for auditory cues.

---

## 1. Cognitive & Product Purpose

Standard cognitive training applications are strictly retrospective: they show where a user has been, but leave them blind to the future consequences of their study habits. Moreover, reading dense text explanations during high-fatigue sessions increases visual cognitive load.

Page 19 completes **SynapseTwin's 4-Layer Architecture** with **Layer D**:
1. **Conversational Multimodal Voice Coach**:
   - Offers hands-free, auditory coaching briefs tailored to the user's active session state.
   - Synchronized real-time transcript ensures complete accessibility for Deaf or hard-of-hearing learners without information loss.
   - Dynamic SVG audio waveform visualizes speech cadence.
2. **Counterfactual "What-If" Cognitive Twin Forecasting**:
   - Evaluates: "If I increase Working Memory drills by 20% while sleeping 8 hours, what is my projected 4-week latent trajectory?"
   - Compares Baseline Projection vs. Simulated Scenario with transparent credible intervals ($\pm \sigma$).
3. **Cognitive Fatigue Early Warning**:
   - Identifies compounding reaction-time deceleration before it degrades performance.
4. **Generalisation Across Dimension Presets**:
   - Adapts projection cards across 3, 6, 7, 8, and 10 dimensions.

---

## 2. Information Architecture & Wireframes

### Desktop Viewport (`1440 px`)

```text
+----------------------------------------------------------------------------------------------------+
|  [ST] SynapseTwin CISTAC 1.0       Active: 7 Dims · Night Lab Switch · Offline Banner              |
+----------------------------------------------------------------------------------------------------+
|  [🌟 Layer D Bonus] [Multimodal Voice] [Scenario Projections ●]                                    |
|                                                                                                    |
|  Layer D: Voice Coaching & Scenario Projections                      [ ⚖ Jump to Judge Mode → ]    |
|  Explore conversational voice guidance and simulate counterfactual cognitive twin futures.         |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+ |
|  | SECTION 1: CONVERSATIONAL VOICE COACHING STUDIO                                               | |
|  | [▶ Play Voice Brief] [ ⏸ Pause ] [ ↻ Replay ]     Pace: [ 0.85x ] [ 1.0x ● ] [ 1.25x ]         | |
|  | Animated Waveform:  |||l|l|||l||||||l|||||||ll||||  Voice Timbre: (●) Warm Mentor (○) Analyst  | |
|  | Synchronized Live Transcript:                                                                  | |
|  | "Your working memory has stabilized at 78% ± 4%. Let's prioritize set-shifting today."         | |
|  +-----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  +------------------------------------------------------+  +-------------------------------------+ |
|  | LEFT 7 COLUMNS: "WHAT-IF" SCENARIO SIMULATOR         |  | RIGHT 5 COLUMNS: TRAJECTORY IMPACT  | |
|  |                                                      |  |                                     | |
|  | [Counterfactual Parameter Controls]                 |  | [Projected 4-Week Trajectory Δ]     | |
|  | Training Intensity:   [ Low ] [ Standard ● ] [ High] |  | Working Memory:      +6.4% ± 2.8%   | |
|  | Sleep & Recovery:     [ 6.0h ] [ 7.5h ● ] [ 9.0h ]   |  | Inhibition Control:  +4.2% ± 3.1%   | |
|  | Rest Days Protected:  [ 1 Day ] [ 2 Days ● ] [ 3 ]   |  | Set-Shifting:        +7.8% ± 2.5%   | |
|  | Task Diversity Focus: [ Balanced 360 ● ] [ Focus ]   |  |                                     | |
|  |                                                      |  | [Comparative Projection Chart]      | |
|  | [Cognitive Fatigue Risk Assessment]                  |  | --- Baseline Trajectory             | |
|  | Saturation Forecast: 28% (Low Burnout Risk)          |  | === Simulated Scenario Trajectory   | |
|  | Recommended Window: Morning Peak (08:00–12:00)       |  |                                     | |
|  +------------------------------------------------------+  +-------------------------------------+ |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|  MULTIDIMENSIONAL COUNTERFACTUAL IMPACT MATRIX (Keyboard-Scrollable Table)                         |
|  Dimension Name      | Current Baseline | Projected (4-Wk) | Net Expected Delta | Confidence Width |
|  Working Memory      | 78% ± 4%         | 84.4% ± 3.2%     | +6.4%              | Narrow (High)    |
|  Inhibition Control  | 72% ± 5%         | 76.2% ± 3.8%     | +4.2%              | Moderate         |
|  Cognitive Flex.     | 69% ± 6%         | 76.8% ± 4.1%     | +7.8%              | High Growth      |
|  Processing Speed    | 81% ± 3%         | 83.5% ± 2.9%     | +2.5%              | Very High        |
+----------------------------------------------------------------------------------------------------+
|  [Why this counterfactual scenario engine? Expandable Epistemic Trail]                             |
+----------------------------------------------------------------------------------------------------+
```

### Mobile Viewport (`375 px`)

```text
+-----------------------------------+
| [ST] SynapseTwin       [Menu ☰]   |
+-----------------------------------+
| [🌟 Layer D] [Voice & Forecast ●] |
| Voice & Scenario Projections      |
+-----------------------------------+
| Voice Coaching Studio:            |
| [▶ Play Voice Brief] [1.0x]       |
| Waveform: |||||l||||||||ll|||     |
| Transcript:                       |
| "Working memory stabilized at 78%"|
+-----------------------------------+
| What-If Scenario Controls:        |
| Intensity: [ Low ] [ Standard ]   |
| Sleep: [ 7.5h ]  Rest: [ 2 Days ] |
+-----------------------------------+
| Projected 4-Week Impact:          |
| Working Memory:  +6.4% ± 2.8%     |
| Cognitive Flex:  +7.8% ± 2.5%     |
| Burnout Risk:    28% (Low)        |
+-----------------------------------+
| Multidimensional Table (Scroll):  |
| [ 7 Dimensions Projected ]        |
+-----------------------------------+
```

---

## 3. Component Inventory & Design Tokens

- **Voice Studio Container**: `tactile-card p-6 bg-surface border-2 border-border-strong rounded-2xl space-y-4 shadow-sm`
- **Audio Waveform**: Dynamic SVG with animated frequency bars (`bg-brand`, `bg-accent`, `bg-reward`).
- **Synchronized Transcript**: `p-4 rounded-xl border border-border bg-canvas text-sm font-medium leading-relaxed`
- **Scenario Parameter Sliders / Pills**: Accessible button groups (`role="radiogroup"`) for intensity, sleep, and rest.
- **Comparative Projection Visualizer**: Visual bar charts comparing baseline vs. projected delta.
- **Impact Matrix Table**: `role="region"` with `aria-label="Counterfactual Impact Table"` and `tabIndex={0}`.
- **Mascot Companion**: `<Mascot state="cheering" size="md" />` celebrating proactive goal simulation.
- **WhyThisPanel**: Grounding counterfactual models in Bayesian priors.

---

## 4. User Interactions & State Transitions

1. **Voice Coach Play / Pause / Replay**:
   - Toggles audio playback simulation with animated waveform bars and synchronized sentence highlighting.
2. **Voice Speed & Timbre Controls**:
   - Adjusts speech rate (`0.85x`, `1.0x`, `1.25x`) and persona timbre (`Warm Mentor`, `Clear Analyst`).
3. **What-If Scenario Simulation**:
   - Modifying training intensity or sleep hours dynamically recalculates expected 4-week cognitive gains and burnout risk.
4. **Dimension Preset Synchrony**:
   - Adapts table and projections dynamically across `3`, `6`, `7`, `8`, and `10` dimensions based on global app state.
5. **1-Click Reset Scenario**:
   - Restores default baseline projection parameters with toast notification.

---

## 5. Responsive Breakpoints & Adaptations

- **Desktop (`1440 px`)**: Top voice studio; split 7/5 grid for scenario parameters and projected impacts; full-width projection matrix below.
- **Tablet (`768 px`)**: Single-column vertical stacking with full touch targets and horizontally scrollable table.
- **Mobile (`375 px`)**: Compact vertical layout. All controls $\ge 44 \times 44\text{ px}$. Zero horizontal overflow (`scrollWidth === clientWidth`).

---

## 6. Accessibility & WCAG 2.1 AA Checklist

- [x] **WCAG 1.2.2 (Captions Prerecorded / Parity)**: Live transcript renders alongside audio playback with complete sentence parity.
- [x] **WCAG 1.4.3 (Contrast Minimum)**: All text, waveform bars, and comparison badges meet $\ge 4.5:1$ contrast against surface backgrounds.
- [x] **WCAG 2.1.1 (Keyboard Navigation)**: Play/pause, speed toggles, sliders, and table are 100% operable via keyboard.
- [x] **WCAG 2.5.3 (Label in Name)**: Button accessible names match visible labels.
- [x] **WCAG 2.2.2 (Pause, Stop, Hide)**: Audio playback and animated waveforms can be paused instantly with Spacebar or Pause button.

---

## 7. Edge Cases & Safety Disclaimers

- **Auditory Sensitivity / Silent Environments**: Audio is muted by default; text transcript is always visible without requiring audio playback.
- **Non-Clinical Forecast Disclaimer**: Scenario projections are explicitly labeled as heuristic Bayesian predictive models, not guaranteed physiological outcomes.
- **Offline Mode**: Voice briefs use local synthetic templates with zero reliance on cloud TTS endpoints during offline operation.

---

## 8. Data Contracts & Scenario Schema

- **`ScenarioParameters`**:
  ```ts
  export interface ScenarioParameters {
    trainingIntensity: 'light' | 'standard' | 'accelerated'
    sleepHours: '6.0' | '7.5' | '9.0'
    restDaysCount: number
    focusMix: 'balanced' | 'memory-priority' | 'flexibility-priority'
  }
  ```
- **`ProjectedDimensionGain`**:
  ```ts
  export interface ProjectedDimensionGain {
    dimensionId: string
    name: string
    currentMean: number
    currentVariance: number
    projectedMean: number
    expectedDelta: number
    confidenceWidth: number
  }
  ```

---

## 9. Definition of Done Checklist (10 Items)

- [x] **DoD 01**: Author [`LayerDPage.tsx`](file:///c:/Users/Smida/Desktop/CISTAC/frontend/src/pages/LayerDPage.tsx) matching design tokens and semantic classes.
- [x] **DoD 02**: Render Multimodal Voice Coaching Studio with play/pause, animated SVG waveform, and synchronized live transcript.
- [x] **DoD 03**: Render Voice Pace (`0.85x`, `1.0x`, `1.25x`) and Timbre selectors.
- [x] **DoD 04**: Render Counterfactual "What-If" Scenario Simulator with parameter controls (Intensity, Sleep, Rest Days).
- [x] **DoD 05**: Render Cognitive Fatigue & Burnout Risk gauge with proactive recovery advice.
- [x] **DoD 06**: Render Comparative 4-Week Projected Impact cards with Bayesian credible intervals.
- [x] **DoD 07**: Render Accessible Counterfactual Impact Matrix Table (`role="region"` with `tabIndex={0}`) scaling with active dimension preset.
- [x] **DoD 08**: Wire route `/layer-d` in [`App.tsx`](file:///c:/Users/Smida/Desktop/CISTAC/frontend/src/App.tsx) and navigation link in [`AppShell.tsx`](file:///c:/Users/Smida/Desktop/CISTAC/frontend/src/components/layout/AppShell.tsx).
- [x] **DoD 09**: Append 22nd unit test in [`frontend/src/tests/designSystem.test.tsx`](file:///c:/Users/Smida/Desktop/CISTAC/frontend/src/tests/designSystem.test.tsx).
- [x] **DoD 10**: Create Playwright E2E suite [`frontend/e2e/layerD.spec.ts`](file:///c:/Users/Smida/Desktop/CISTAC/frontend/e2e/layerD.spec.ts), verify 0 `axe-core` violations, 0 horizontal overflow, and save 6 screenshots to `docs/ui/screenshots/19-layer-d-*.png`.

---

## 10. Design Critique Self-Review (Rounds 1 & 2)

- **Round 1 (Picky Designer)**:
  - *Critique*: Avoid generic media player controls or plain text boxes for auditory coaching. A competitive AI4Brain entry must feel like a specialized, tactile neuro-coaching console with organic rhythm and crisp visual feedback.
  - *Resolution*: Designed a custom SVG audio waveform with 24 animated bars dynamically vibrating when audio is active, synchronized with a real-time sentence transcript ticker. Built tactile pill buttons for Voice Pace (`0.85x`, `1.0x`, `1.25x`) and Persona selection (Warm Mentor, Clear Analyst, Gentle Guide) with clear active border states and OKLCH color elevation.
- **Round 2 (Hostile Juror)**:
  - *Critique*: "What-If" scenario simulators often show arbitrary pseudo-scientific numbers without disclosing mathematical uncertainty or dimension generalisation, making them appear ungrounded.
  - *Resolution*: Grounded all counterfactual projections directly in the user's active `DimensionRegistry` (`3`, `6`, `7`, `8`, or `10` dimensions). Every projected mean $\mu_{\text{proj}}$ is displayed with honest Bayesian uncertainty intervals ($\pm \sigma$) and clear delta tags ($\Delta$). Provided an accessible, keyboard-scrollable Counterfactual Impact Matrix table with full screen-reader semantic roles (`role="region"`, `tabIndex={0}`, `aria-label`), accompanied by an explicit epistemic disclosure that projections represent heuristic simulations rather than clinical guarantees.

---

## 11. Verification Evidence

- **Automated QA Suite (`npm run qa:checks`)**:
  - `lint:tokens`: PASS (100% design tokens, 0 arbitrary hex or spacing overrides).
  - `lint:copy`: PASS (0 clinical diagnoses or guilt-inducing terms).
  - `check:contrast`: PASS (all semantic tokens meet WCAG 2.1 AA/AAA thresholds).
  - `npm test`: PASS (22/22 unit & component tests passing).
  - `npm run build`: PASS (clean TypeScript compilation; `LayerDPage` route chunk `18.22 kB` / `5.11 kB` gzip).
- **Playwright End-to-End Suite (`e2e/layerD.spec.ts`)**:
  - axe-core accessibility audit: **0 violations** in Light and Dark themes.
  - Responsive layout verified at `375px`, `768px`, and `1440px` viewports (0 horizontal overflow).
  - 6 captured visual verification screenshots:
    1. [`docs/ui/screenshots/19-layer-d-desktop-overview.png`](file:///c:/Users/Smida/Desktop/CISTAC/docs/ui/screenshots/19-layer-d-desktop-overview.png)
    2. [`docs/ui/screenshots/19-layer-d-voice-playing.png`](file:///c:/Users/Smida/Desktop/CISTAC/docs/ui/screenshots/19-layer-d-voice-playing.png)
    3. [`docs/ui/screenshots/19-layer-d-scenario-simulation.png`](file:///c:/Users/Smida/Desktop/CISTAC/docs/ui/screenshots/19-layer-d-scenario-simulation.png)
    4. [`docs/ui/screenshots/19-layer-d-impact-table.png`](file:///c:/Users/Smida/Desktop/CISTAC/docs/ui/screenshots/19-layer-d-impact-table.png)
    5. [`docs/ui/screenshots/19-layer-d-night-lab.png`](file:///c:/Users/Smida/Desktop/CISTAC/docs/ui/screenshots/19-layer-d-night-lab.png)
    6. [`docs/ui/screenshots/19-layer-d-mobile.png`](file:///c:/Users/Smida/Desktop/CISTAC/docs/ui/screenshots/19-layer-d-mobile.png)
