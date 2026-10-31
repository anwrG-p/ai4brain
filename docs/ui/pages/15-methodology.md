# Page 15 Specification: Methodology, Limits & Ethics (`/methodology`)

- **Page Name & Route**: How It Works, Limits & Ethics (`/methodology`)
- **Primary Users**: Competition judges, research evaluators, neurodiverse learners, educators, and students seeking complete scientific and ethical transparency.
- **Challenge Goals**:
  1. **Demystify Cognitive Modeling**: Provide transparent, accessible breakdowns of the entire cognitive data lifecycle—from millisecond probe timestamps and staircase trials to Bayesian latent updates ($\hat{\theta}_i$) and SAT-JEPA differential representations ($\Delta c$).
  2. **Explicit Disclosure of Measurement Limits & Biases**: Enumerate all hardware, environmental, and circadian confounders (screen refresh rate, Bluetooth input latency, circadian slump, practice effects) and show how epistemic uncertainty intervals ($\pm \sigma$) widen to prevent overconfident claims.
  3. **Non-Clinical & Zero-Guilt Ethical Charter**: Solidify the absolute boundary between non-clinical cognitive twin development and medical/diagnostic tools, documenting the active `lintCopyText` guardrail engine and non-punitive streak preservation.
  4. **Algorithmic Recourse & Data Sovereignty**: Document user rights to challenge AI coach recommendations, force deterministic rule fallbacks, and execute full GDPR Article 17/20 data purges.
- **Rubric Criteria Mapping**:
  - **Explainability (Phase 1, 9% final)** — Full mathematical and conceptual explainability; transparent epistemic trails; algorithmic pipeline visualization.
  - **Safety & Ethics (Phase 1, 6% final)** — Non-clinical boundary enforcement; non-biometric lock; bias disclosure; zero-guilt philosophy.
  - **Relevance & Scientific Rigor (Phase 1, 12% final)** — Cognitive psychometrics (Bayesian IRT, staircase thresholds, archetype hysteresis, SAT-JEPA $\Delta c$).
  - **Quality (Phase 1, 12% final)** — Responsive, high-contrast typography pairing; interactive bias explorer; accessible formulas and tables.

---

## 1. Cognitive & Product Purpose

Too many AI-driven cognitive platforms operate as inscrutable "black boxes" that generate flattering or anxiety-inducing scores without scientific justification or error disclosure. Furthermore, commercial wellness tools frequently employ manipulative guilt mechanisms (broken streak counters, punitive shaming) and overstep medical boundaries by implying diagnostic capabilities.

Page 15 establishes **SynapseTwin's Scientific & Ethical Declaration**:
1. **The Cognitive Computation Pipeline**:
   - Visualizing how 4 stages (Active Probe Stimuli $\to$ Weighted Staircasing $\to$ Bayesian Latent State Estimation $\to$ SAT-JEPA Plan Generation) process user interactions.
2. **Mathematical Foundations**:
   - Bayesian trait estimation: $\hat{\theta}_i \sim \mathcal{N}\left(\mu_i, \sigma_i^2\right)$, where variance $\sigma_i^2$ reflects epistemic uncertainty.
   - Archetype Hysteresis: Requires a $3/3$ consecutive session stability window to prevent erratic label flipping.
   - Vector differential: $\Delta c = c_{\text{target}} - c_{\text{current}}$, guiding the adaptive staircase dispatch engine.
3. **Known Biases & Environmental Confounders**:
   - Transparent table detailing 5 major measurement confounders (Hardware latency, Circadian rhythm, Motor fatigue, Practice effects, Visual crowding) and SynapseTwin's architectural mitigation.
4. **Interactive Bias & Uncertainty Simulator**:
   - Allows users to simulate environmental interference (e.g. high input jitter, late-night fatigue) to see how confidence bands dynamically widen.
5. **Ethical Guardrail & Non-Clinical Architecture**:
   - The active dictionary and regex rules enforcing non-diagnostic, non-punitive communication.

---

## 2. Information Architecture & Wireframes

### Desktop Viewport (`1440 px`)

```text
+----------------------------------------------------------------------------------------------------+
|  [ST] SynapseTwin CISTAC 1.0       Active: 7 Dims · Night Lab Switch · Offline Banner              |
+----------------------------------------------------------------------------------------------------+
|  [🔬 Science & Ethics] [Non-Clinical Certified] [Bayesian Rigor ●]                                 |
|                                                                                                    |
|  Methodology, Limits & Ethical Charter                               [ ⚖ Jump to Judge Mode → ]    |
|  Complete scientific disclosure of Bayesian cognitive modeling, known biases, and ethical safety. |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  +-----------------------------------------------------------------------------------------------+ |
|  | 1. THE 4-STAGE COGNITIVE COMPUTATION PIPELINE (Interactive Stepper & Architecture Diagram)    | |
|  | [1. Active Probe]  --->  [2. Staircase IRT]  --->  [3. Bayesian Twin]  --->  [4. SAT-JEPA Plan]  | |
|  | - Millisecond latency    - Dynamic difficulty     - Latent trait μ ± σ       - Action vector Δc | |
|  +-----------------------------------------------------------------------------------------------+ |
|                                                                                                    |
|  +------------------------------------------------------+  +-------------------------------------+ |
|  | LEFT 7 COLUMNS: MATHEMATICAL & PSYCHOMETRIC MODELS   |  | RIGHT 5 COLUMNS: ETHICAL CHARTER    | |
|  |                                                      |  |                                     | |
|  | [Mathematical Formulation & Inference]              |  | [The 4-Pillar Ethical Charter]      | |
|  | - Bayesian Trait Updating:                           |  | 1. Non-Clinical Boundary (Strict)   | |
|  |   θ_hat_i = (τ_0 * μ_0 + τ_s * x_bar) / (τ_0 + τ_s)  |  | 2. Non-Biometric Hardware Lock      | |
|  | - Archetype Hysteresis: 3/3 Consecutive Rule         |  | 3. Zero-Guilt Streak Protection     | |
|  | - SAT-JEPA Vector Difference: Δc = c_tgt - c_cur     |  | 4. Sovereign Data & Algorithmic Recourse |
|  |                                                      |  |                                     | |
|  | [Interactive Bias & Confidence Simulator]            |  | [Live Non-Clinical Guardrail Test]  | |
|  | Input Latency Jitter: [ Slider: 20ms - 250ms ]       |  | Interactive text scanner:           | |
|  | Circadian Alertness:  [ Morning / Slump / Night ]    |  | "Patient shows ADHD deficit..."     | |
|  | -> Computed Confidence Band: ± 9.4% (Widened)        |  | -> [ Flagged: 2 violations caught ] | |
|  +------------------------------------------------------+  +-------------------------------------+ |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
|  KNOWN MEASUREMENT BIASES & MITIGATION MATRIX (Accessible Region & Table)                          |
|  Confounder Name     | Impact on Latency / Score | Detection Mechanism  | Architectural Mitigation |
|  Input Hardware Lag  | +40 to +180 ms latency    | Frame-delta probe    | Baseline calibration     |
|  Circadian Alertness | -12% working memory dips  | Timestamp tagging    | Multi-window averaging   |
|  Motor Coordination  | False error bursts        | Inter-tap variance   | Non-speeded alternative  |
|  Practice Effect     | Artificial score drift    | Novel stimulus seed  | Staircase reshuffling    |
+----------------------------------------------------------------------------------------------------+
|  [Why this transparent methodology? Expandable Epistemic Trail]                                   |
+----------------------------------------------------------------------------------------------------+
```

### Mobile Viewport (`375 px`)

```text
+-----------------------------------+
| [ST] SynapseTwin       [Menu ☰]   |
+-----------------------------------+
| [🔬 Science] [Non-Clinical ●]     |
| Methodology & Ethics              |
+-----------------------------------+
| 4-Stage Pipeline:                 |
| 1. Stimulus Probe                 |
| 2. Staircase Scoring              |
| 3. Bayesian Twin (μ ± σ)          |
| 4. SAT-JEPA Plan (Δc)             |
+-----------------------------------+
| Mathematical Models:              |
| • Bayesian Trait Updating         |
| • Archetype 3/3 Hysteresis        |
| • Vector Differential Δc          |
+-----------------------------------+
| Interactive Bias Simulator:       |
| Jitter: [ 180 ms ]                |
| Result: Band widens to ±9.4%      |
+-----------------------------------+
| Ethical Charter:                  |
| 1. Non-Clinical Guarantee         |
| 2. Hardware Biometric Lock        |
| 3. Zero-Guilt Habit Policy        |
| 4. GDPR Article 17/20 Portability |
+-----------------------------------+
| Biases Matrix (Scrollable Table): |
| [ Hardware Lag, Circadian, etc. ] |
+-----------------------------------+
```

---

## 3. Component Inventory & Design Tokens

- **Card Containers**: `tactile-card p-6 bg-surface border-2 border-border-strong rounded-2xl space-y-6 shadow-sm`
- **Section Headers**: `font-display font-bold text-xl text-ink pb-2 border-b border-border`
- **Formula Blocks**: `p-4 rounded-xl border border-border bg-canvas font-mono text-sm text-ink leading-relaxed overflow-x-auto`
- **Interactive Simulator**: Card containing range sliders, radio buttons, and live dynamic badge reflecting Bayesian confidence width.
- **Copy Guardrail Sandbox**: Interactive input where users or judges can type phrases to see the real-time non-clinical copy linter (`lintCopyText`) in action.
- **Biases Table**: `role="region"` with `aria-label="Measurement Biases Matrix"` and `tabIndex={0}`.
- **Mascot Companion**: `<Mascot state="thinking" size="md" />` explaining epistemic transparency.
- **WhyThisPanel**: Root explainability card grounded in psychometric integrity.

---

## 4. User Interactions & State Transitions

1. **Pipeline Stepper**:
   - Clicking through stages 1 to 4 highlights each phase of data processing with visual callouts and telemetry schemas.
2. **Interactive Bias & Uncertainty Simulator**:
   - Adjusting input latency slider (e.g. 20 ms to 240 ms) dynamically recalculates estimated posterior interval ($\pm \sigma$) from $\pm 3.2\%$ to $\pm 11.8\%$, visually demonstrating how SynapseTwin prevents false precision.
3. **Live Copy Linter Sandbox**:
   - Input allows entering test copy; typing words like "deficit", "ADHD", or "broke your streak" highlights violations with explanatory warnings, proving adherence to `DEC-004`.
4. **Biases & Confounders Explorer**:
   - Allows expanding detail cards or viewing the comprehensive matrix table with keyboard navigation.
5. **Quick Navigation**:
   - Deep links to `/privacy` (Privacy Center), `/judge-mode` (Proof Matrix), and `/assessment` (Live Task Probes).

---

## 5. Responsive Breakpoints & Adaptations

- **Desktop (`1440 px`)**: Full 12-column split layout. Pipeline cards across top; mathematical foundations in left 7 columns; ethical charter and guardrail tester in right 5 columns; full-width measurement matrix below.
- **Tablet (`768 px`)**: Single-column vertical stack with full touch target sizes and horizontal table scrolling with `tabIndex={0}`.
- **Mobile (`375 px`)**: Fluid vertical layout with minimum $44 \times 44\text{ px}$ interactive targets. Zero horizontal scroll on root container (`scrollWidth === clientWidth`).

---

## 6. Accessibility & WCAG 2.1 AA Checklist

- [x] **WCAG 1.4.3 (Contrast Minimum)**: All text tokens, formulas, and badges meet $\ge 4.5:1$ contrast against surface backgrounds.
- [x] **WCAG 1.4.4 (Resize Text)**: Layout fluidly accommodates up to 200% font scaling without data loss or overlapping elements.
- [x] **WCAG 2.1.1 (Keyboard Navigation)**: All sliders, tabs, buttons, and scrollable regions are fully operable via Tab, Enter, Space, and Arrow keys.
- [x] **WCAG 2.5.3 (Label in Name)**: Button accessible names strictly match visual button text.
- [x] **WCAG 2.4.7 (Focus Visible)**: High-contrast focus rings (`focus-ring`) on all interactive inputs and table regions.

---

## 7. Edge Cases, Scientific Rigor & Ethics

- **Zero-Data Cold Start**: First session displays maximal uncertainty ($\pm 18\%$) and transparently warns the user that baseline calibration requires 3 complete sessions.
- **Adversarial / Clinical Queries**: Explicit disclaimer that SynapseTwin cannot be used for insurance, employment screening, or psychiatric diagnosis.
- **Mathematical Integrity**: Formulas use precise standard notation (mean $\mu$, precision $\tau$, variance $\sigma^2$, vector difference $\Delta c$).

---

## 8. Data Contracts & Scientific Definitions

- **Bayesian Trait Estimate**:
  $$\hat{\theta}_i = \frac{\tau_0 \mu_0 + \tau_s \bar{x}}{\tau_0 + \tau_s}, \quad \sigma_{\theta_i} = \frac{1}{\sqrt{\tau_0 + \tau_s}}$$
- **Archetype Hysteresis**:
  $$\text{State}(t) = \begin{cases} A_{\text{new}} & \text{if } \text{Candidate}(t) = \text{Candidate}(t-1) = \text{Candidate}(t-2) = A_{\text{new}} \\ \text{State}(t-1) & \text{otherwise} \end{cases}$$
- **Vector Differential Dispatch**:
  $$\Delta c = c_{\text{target}} - c_{\text{current}} = \left[ \Delta \theta_{\text{WM}}, \Delta \theta_{\text{IC}}, \Delta \theta_{\text{CF}}, \dots \right]$$

---

## 9. Definition of Done Checklist (10 Items)

- [x] **DoD 01**: Author `frontend/src/pages/MethodologyPage.tsx` matching design tokens and semantic classes.
- [x] **DoD 02**: Render 4-Stage Cognitive Computation Pipeline with interactive stage selection.
- [x] **DoD 03**: Render mathematical formulation section with formulas for Bayesian estimation, Archetype Hysteresis, and SAT-JEPA $\Delta c$.
- [x] **DoD 04**: Render Interactive Bias & Uncertainty Simulator with real-time confidence band calculation.
- [x] **DoD 05**: Render 4-Pillar Ethical Charter detailing Non-Clinical Guarantee, Non-Biometric Lock, Zero-Guilt, and Sovereign Data Rights.
- [x] **DoD 06**: Render Live Non-Clinical Copy Guardrail Sandbox powered by `lintCopyText`.
- [x] **DoD 07**: Render Accessible Measurement Biases & Confounders Reference Table (`role="region"` with `tabIndex={0}`).
- [x] **DoD 08**: Wire route `/methodology` in `frontend/src/App.tsx` and navigation link in `frontend/src/components/layout/AppShell.tsx`.
- [x] **DoD 09**: Append 21st unit test in `frontend/src/tests/designSystem.test.tsx`.
- [x] **DoD 10**: Create Playwright E2E suite `frontend/e2e/methodology.spec.ts`, verify 0 `axe-core` violations, 0 horizontal overflow, and save 6 screenshots to `docs/ui/screenshots/15-methodology-*.png`.

---

## 10. Design Critique Self-Review (Rounds 1 & 2)

- **Round 1 (Picky Designer)**:
  - *Observation*: Mathematical formulas rendered as raw code can look harsh and alienating to neurodivergent learners.
  - *Correction Applied*: Formatted each psychometric equation into elevated tactile cards with monospace variable keys, narrative plain-language explanations, and clear mathematical notation.
  - *Observation*: The copy guardrail tester needed to demonstrate live interception without cluttering the screen.
  - *Correction Applied*: Created 3 instant test buttons (Clinical Test, Guilt Test, Valid Test) with live colored badges and highlighted violation tags.
- **Round 2 (Hostile Juror)**:
  - *Question*: "Is this methodology page merely static philosophy, or is it directly connected to live executable logic?"
  - *Evidence*: The page imports and runs the actual `lintCopyText` regex and dictionary engine live, and the Interactive Bias Simulator implements real-time variance calculations matching the Bayesian model.
  - *Question*: "How do you ensure non-biometric compliance?"
  - *Evidence*: Documented under Pillar 2 and verified in telemetry payload schemas: no MediaDevices API or audio streams are instantiated anywhere in the repository.

---

## 11. Verification Evidence & Screenshots

All 6 screenshots captured and verified:
1. `15-methodology-desktop-overview.png` — Full desktop 1440px overview in Playful Lab Light theme showing pipeline, math cards, charter, and biases matrix.
2. `15-methodology-pipeline-step.png` — Interactive stage 3 (Bayesian Twin Updating) selected with active formula and telemetry signature.
3. `15-methodology-bias-simulator.png` — Afternoon Slump and 180 ms input jitter simulated with widened credible interval ($\pm 9.4\%$).
4. `15-methodology-guardrail-sandbox.png` — Copy guardrail sandbox with clinical and punitive terms intercepted in real time.
5. `15-methodology-night-lab.png` — Night Lab Dark mode (`data-theme="dark"`) verified with 0 `axe-core` violations.
6. `15-methodology-mobile.png` — Mobile 375px responsive layout with zero horizontal overflow.
