import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'
import { Mascot } from '../components/features/brand/Mascot'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { lintCopyText, SAMPLE_CLINICAL_DEMO_INPUT, SAMPLE_GUILT_DEMO_INPUT } from '../utils/copyLinter'
import type { WhyThisTrail } from '../types'

const METHODOLOGY_WHY_TRAIL: WhyThisTrail = {
  id: 'trail-methodology-epistemics',
  confidence: 0.99,
  observedData: [
    'Psychometric Item Response Theory requires explicit standard error reporting on all latent ability scores.',
    'Hardware latency variance across consumer devices spans 16 ms (144Hz wired) to 210 ms (Bluetooth mobile).',
    'The non-clinical copy guardrail engine actively monitors 14 diagnostic and punitive guilt patterns.',
  ],
  inference:
    'SynapseTwin maintains scientific credibility by disclosing measurement limits and modeling uncertainty explicitly.',
  recommendation:
    'Evaluate cognitive growth using 30-day Bayesian moving intervals rather than single-trial snapshots.',
  counterfactual:
    'Without explicit uncertainty modeling, a 120 ms Bluetooth keyboard lag would be misclassified as cognitive decline.',
  sourceModule: 'deterministic_fallback',
}

interface PipelineStage {
  id: number
  title: string
  subtitle: string
  icon: string
  description: string
  formula: string
  telemetrySignature: string
  safetyCheck: string
}

const PIPELINE_STAGES: readonly PipelineStage[] = [
  {
    id: 1,
    title: 'Active Probe Stimuli',
    subtitle: 'Millisecond-Accurate Telemetry',
    icon: '⚡',
    description:
      'Stimulus presentation is locked to the browser animation frame (requestAnimationFrame). Every trial captures timestamped touch/key events, incongruent lure response deltas, and precision jitter.',
    formula: 'RT_i = t_{response} - t_{stimulus} - \\delta_{input\\_offset}',
    telemetrySignature: '{ trialIndex: 14, probeType: "n_back_spatial", latencyMs: 342, isLure: true }',
    safetyCheck: 'Non-Biometric Guarantee: Zero webcam, eye-tracking, or mic streaming during probes.',
  },
  {
    id: 2,
    title: 'Weighted Staircase IRT',
    subtitle: 'Dynamic Difficulty Targeting 85% Accuracy',
    icon: '📈',
    description:
      'Rather than fixed-difficulty testing, difficulty adjusts dynamically following a modified 1-up/2-down staircase protocol to pinpoint the boundary of cognitive effort while minimizing frustration.',
    formula: 'd\' = Z(Hit\\ Rate) - Z(False\\ Alarm\\ Rate)',
    telemetrySignature: '{ staircaseLevel: 3, stepSize: 0.25, reversalCount: 4, dPrime: 2.18 }',
    safetyCheck: 'Anti-Frustration Clamp: Staircase caps at 3 consecutive errors to protect learner motivation.',
  },
  {
    id: 3,
    title: 'Bayesian Twin Updating',
    subtitle: 'Latent Trait Distribution (μ ± σ)',
    icon: '🧠',
    description:
      'Raw trial scores are mapped to latent cognitive dimensions via conjugate Gaussian Bayesian belief updating. Variance decreases as observations accumulate, producing an honest credible interval.',
    formula: '\\hat{\\theta}_i = \\frac{\\tau_0 \\mu_0 + \\tau_s \\bar{x}}{\\tau_0 + \\tau_s}, \\quad \\sigma_{\\theta} = \\frac{1}{\\sqrt{\\tau_0 + \\tau_s}}',
    telemetrySignature: '{ dimension: "working_memory", mean: 0.78, variance: 0.0016, confidence: 0.88 }',
    safetyCheck: 'Uncertainty Floor: Early baseline sessions display wide confidence bands (±15%) to avoid overconfident claims.',
  },
  {
    id: 4,
    title: 'SAT-JEPA Plan Generation',
    subtitle: 'Vector Difference (Δc) Dispatch',
    icon: '🎯',
    description:
      'Adaptive exercise generation compares current multidimensional latent state against user-selected targets to produce the differential vector Δc, selecting drills with maximal recovery payoff.',
    formula: '\\Delta c = c_{target} - c_{current} = [ \\Delta \\theta_{WM}, \\Delta \\theta_{IC}, \\Delta \\theta_{CF}, \\dots ]',
    telemetrySignature: '{ targetDelta: { WM: +0.08, IC: +0.03 }, prioritizedDrill: "Dual N-Back Level 3" }',
    safetyCheck: 'Zero-Guilt Protection: Rest days and missed sessions never penalize trajectory slope or streak contracts.',
  },
]

const BIASES_TABLE_DATA = [
  {
    name: 'Hardware Latency & Bluetooth Jitter',
    impact: '+40 ms to +180 ms latency overhead',
    detection: 'Frame-delta timestamps & standard deviation spikes',
    mitigation: 'Input latency calibration baseline (138 ms) and outlier clustering.',
  },
  {
    name: 'Circadian Rhythm Alertness Dip',
    impact: '8% to 14% drop in speed & working memory',
    detection: 'Session timestamp vs preferred peak focus window',
    mitigation: 'Multi-session moving window averaging across morning and afternoon.',
  },
  {
    name: 'Motor Tremor & Coordination Noise',
    impact: 'Elevated reaction times and accidental double-taps',
    detection: 'Inter-tap interval variance distribution < 60 ms',
    mitigation: 'Generous tap targets (≥ 44 px), keyboard mapping (1/2), and debounce filter.',
  },
  {
    name: 'Practice & Familiarity Drift',
    impact: 'Artificial score drift after 6+ identical runs',
    detection: 'Trial sequence index counter (n > 10)',
    mitigation: 'Algorithmic stimulus seed rotation and randomized lure position generation.',
  },
  {
    name: 'Sensory Crowding & Fatigue',
    impact: 'Elevated error bursts after 8+ minutes of sustained focus',
    detection: 'Trial duration timer & reaction-time slope degradation',
    mitigation: 'Mandatory session timeboxing (< 5 min) and 1-click Calm Sensory Mode.',
  },
]

export function MethodologyPage() {
  const [activeStage, setActiveStage] = useState<number>(1)
  const [jitterMs, setJitterMs] = useState<number>(45)
  const [circadianWindow, setCircadianWindow] = useState<'morning' | 'slump' | 'night'>('morning')
  const [sessionCount, setSessionCount] = useState<number>(8)

  // Copy Linter Sandbox State
  const [sandboxText, setSandboxText] = useState<string>(
    'Learner demonstrated steady improvement in working memory with 78% accuracy.',
  )

  const lintResult = lintCopyText(sandboxText)

  // Calculate simulated confidence interval width based on input parameters
  const calculateSimulatedUncertainty = () => {
    // Baseline uncertainty from session count (more sessions = narrower interval)
    const baseVariance = Math.max(0.03, 0.16 / Math.sqrt(sessionCount))

    // Jitter penalty (higher latency jitter = wider interval)
    const jitterPenalty = (jitterMs / 250) * 0.05

    // Circadian penalty (testing during slump/night increases noise)
    const circadianPenalty =
      circadianWindow === 'morning' ? 0.0 : circadianWindow === 'slump' ? 0.025 : 0.04

    const totalInterval = (baseVariance + jitterPenalty + circadianPenalty) * 100
    return totalInterval.toFixed(1)
  }

  const simulatedWidth = calculateSimulatedUncertainty()
  const currentStage = PIPELINE_STAGES.find((s) => s.id === activeStage) ?? PIPELINE_STAGES[0]!

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" glyph="🔬">
              Science &amp; Ethics
            </Badge>
            <Badge tone="success" glyph="✓">
              Non-Clinical Certified
            </Badge>
            <Badge tone="reward" glyph="●">
              Bayesian Rigor
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/privacy"
              className="tactile-btn bg-surface text-ink px-3.5 py-1.5 text-xs font-semibold inline-flex items-center no-underline border border-border"
            >
              Privacy &amp; Non-Biometric Lock →
            </Link>
          </div>
        </div>

        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight text-ink">
            Methodology, Limits &amp; Ethical Charter
          </h1>
          <DoodleSquiggle className="max-w-xs mt-1" />
          <p className="text-ink-muted text-base max-w-3xl mt-1">
            Complete scientific disclosure of Bayesian cognitive modeling, measurement limits,
            known environmental confounders, and non-clinical ethical guardrails.
          </p>
        </div>
      </section>

      {/* Section 1: The 4-Stage Cognitive Computation Pipeline */}
      <Card className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="font-display font-bold text-xl text-ink flex items-center gap-2">
              <span aria-hidden="true">🔄</span> The 4-Stage Cognitive Computation Pipeline
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              How SynapseTwin converts raw millisecond probe inputs into explainable, non-clinical twin models.
            </p>
          </div>
          <Badge tone="neutral" glyph="◈">
            Deterministic Pipeline
          </Badge>
        </div>

        {/* Stage Stepper Tabs */}
        <div
          role="tablist"
          aria-label="Cognitive pipeline stages"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          {PIPELINE_STAGES.map((stg) => {
            const isActive = activeStage === stg.id
            return (
              <button
                key={stg.id}
                role="tab"
                id={`stage-tab-${stg.id}`}
                aria-selected={isActive}
                aria-controls={`stage-panel-${stg.id}`}
                onClick={() => setActiveStage(stg.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer focus-ring flex flex-col justify-between ${
                  isActive
                    ? 'border-brand bg-brand/10 shadow-sm'
                    : 'border-border bg-surface hover:bg-surface-raised'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg" aria-hidden="true">
                      {stg.icon}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                        isActive
                          ? 'bg-brand text-brand-ink'
                          : 'bg-surface-raised text-ink-muted'
                      }`}
                    >
                      Step 0{stg.id}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-sm text-ink">{stg.title}</h3>
                  <p className="text-xs text-ink-muted mt-1">{stg.subtitle}</p>
                </div>
                {isActive && (
                  <span className="text-brand font-bold text-xs mt-3 block">
                    ● Active View
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Active Stage Detail Panel */}
        <div
          role="tabpanel"
          id={`stage-panel-${currentStage.id}`}
          aria-labelledby={`stage-tab-${currentStage.id}`}
          className="p-5 rounded-xl border border-border bg-canvas/60 space-y-4 animate-fadeIn"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display font-bold text-base text-ink flex items-center gap-2">
              <span>{currentStage.icon}</span> Stage {currentStage.id}: {currentStage.title}
            </h3>
            <Badge tone="brand">Verified Psychometric Stage</Badge>
          </div>

          <p className="text-sm text-ink leading-relaxed">{currentStage.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                Mathematical Model:
              </span>
              <div className="p-3 rounded-lg border border-border bg-surface font-mono text-xs text-ink overflow-x-auto">
                <code>{currentStage.formula}</code>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                Telemetry Payload Signature:
              </span>
              <div className="p-3 rounded-lg border border-border bg-surface font-mono text-xs text-ink-muted overflow-x-auto">
                <code>{currentStage.telemetrySignature}</code>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-border bg-surface flex items-center gap-2 text-xs">
            <span className="text-brand font-bold">🛡 Safety Check:</span>
            <span className="text-ink">{currentStage.safetyCheck}</span>
          </div>
        </div>
      </Card>

      {/* Main Grid: Left 7 cols (Math & Simulator) + Right 5 cols (Ethical Charter & Guardrail) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Mathematical & Psychometric Formulations */}
          <Card className="p-6 space-y-6">
            <div className="border-b border-border pb-3">
              <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2">
                <span aria-hidden="true">📐</span> Mathematical &amp; Algorithmic Foundations
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Exact equations governing trait estimation, state hysteresis, and adaptive trajectory dispatch.
              </p>
            </div>

            {/* Formula 1: Conjugate Bayesian Updating */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">
                  1. Conjugate Gaussian Trait Estimation
                </h3>
                <Badge tone="neutral">Bayesian IRT</Badge>
              </div>
              <p className="text-xs text-ink-muted">
                Each cognitive dimension is maintained as a normal distribution parameterized by prior mean
                <code className="font-mono text-ink mx-1">μ_0</code>, prior precision
                <code className="font-mono text-ink mx-1">τ_0</code>, and sample precision
                <code className="font-mono text-ink mx-1">τ_s</code>.
              </p>
              <div className="p-4 rounded-xl border border-border bg-canvas font-mono text-xs text-ink leading-relaxed overflow-x-auto">
                <p className="font-bold">θ_hat_i = (τ_0 * μ_0 + τ_s * x_bar) / (τ_0 + τ_s)</p>
                <p className="text-ink-muted mt-1">σ_θ = 1 / sqrt(τ_0 + τ_s)</p>
              </div>
            </div>

            {/* Formula 2: Archetype Hysteresis */}
            <div className="space-y-2 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">
                  2. Archetype Classification Hysteresis (3/3 Rule)
                </h3>
                <Badge tone="neutral">Anti-Oscillation</Badge>
              </div>
              <p className="text-xs text-ink-muted">
                To prevent rapid, jarring label flips due to daily alertness fluctuations, an archetype reassignment
                requires 3 consecutive sessions in the new cluster candidate before updating the profile state.
              </p>
              <div className="p-4 rounded-xl border border-border bg-canvas font-mono text-xs text-ink leading-relaxed overflow-x-auto">
                <p className="font-bold">State(t) = A_new  if Candidate(t) == Candidate(t-1) == Candidate(t-2) == A_new</p>
                <p className="text-ink-muted mt-1">State(t) = State(t-1) otherwise</p>
              </div>
            </div>

            {/* Formula 3: Vector Differential Δc */}
            <div className="space-y-2 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">
                  3. SAT-JEPA Latent Vector Differential
                </h3>
                <Badge tone="neutral">Exercise Dispatch</Badge>
              </div>
              <p className="text-xs text-ink-muted">
                Weekly plans and AI Coach recommendations compare the current estimated state vector against
                the user’s balance goals, dispatching drills that optimize total cognitive symmetry.
              </p>
              <div className="p-4 rounded-xl border border-border bg-canvas font-mono text-xs text-ink leading-relaxed overflow-x-auto">
                <p className="font-bold">Δc = c_target - c_current = [ Δθ_WM, Δθ_IC, Δθ_CF, Δθ_AT, ... ]</p>
              </div>
            </div>
          </Card>

          {/* Card: Interactive Bias & Confidence Simulator */}
          <Card className="p-6 space-y-6">
            <div className="border-b border-border pb-3">
              <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2">
                <span aria-hidden="true">🎛</span> Interactive Bias &amp; Confidence Simulator
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Simulate environmental noise to observe how SynapseTwin honestly widens its epistemic credible interval.
              </p>
            </div>

            {/* Input Jitter Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="jitter-slider" className="font-bold text-ink">
                  Hardware Latency &amp; Bluetooth Jitter:
                </label>
                <span className="font-mono font-bold text-ink">{jitterMs} ms</span>
              </div>
              <input
                id="jitter-slider"
                type="range"
                min="20"
                max="240"
                step="5"
                value={jitterMs}
                onChange={(e) => setJitterMs(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
              <div className="flex justify-between text-xs text-ink-muted">
                <span>20 ms (Wired 144Hz)</span>
                <span>120 ms (Standard Web)</span>
                <span>240 ms (High Bluetooth Lag)</span>
              </div>
            </div>

            {/* Session Count Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="session-slider" className="font-bold text-ink">
                  Accumulated Assessment Sessions:
                </label>
                <span className="font-mono font-bold text-ink">{sessionCount} sessions</span>
              </div>
              <input
                id="session-slider"
                type="range"
                min="1"
                max="20"
                step="1"
                value={sessionCount}
                onChange={(e) => setSessionCount(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer"
              />
              <div className="flex justify-between text-xs text-ink-muted">
                <span>1 session (Cold Start)</span>
                <span>8 sessions (Stabilizing)</span>
                <span>20 sessions (High Precision)</span>
              </div>
            </div>

            {/* Circadian Window Radio Group */}
            <div className="space-y-2">
              <span id="circadian-label" className="text-xs font-bold text-ink block">
                Circadian Alertness Timing:
              </span>
              <div
                role="radiogroup"
                aria-labelledby="circadian-label"
                className="grid grid-cols-3 gap-2"
              >
                {[
                  { id: 'morning', label: 'Morning Peak', desc: 'Alert' },
                  { id: 'slump', label: 'Afternoon Slump', desc: 'Fatigued' },
                  { id: 'night', label: 'Late Night', desc: 'High Noise' },
                ].map((item) => {
                  const active = circadianWindow === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setCircadianWindow(item.id as typeof circadianWindow)}
                      className={`p-2.5 rounded-lg border-2 text-center transition-all cursor-pointer focus-ring ${
                        active
                          ? 'border-brand bg-brand/10 font-bold'
                          : 'border-border bg-surface hover:bg-surface-raised'
                      }`}
                    >
                      <span className="text-xs block text-ink">{item.label}</span>
                      <span className="text-xs text-ink-muted block mt-0.5">{item.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Dynamic Uncertainty Band Result */}
            <div className="p-4 rounded-xl border-2 border-border-strong bg-canvas space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink uppercase tracking-wider">
                  Computed Posterior Credible Band:
                </span>
                <Badge tone={Number(simulatedWidth) > 8 ? 'warning' : 'success'}>
                  ± {simulatedWidth}%
                </Badge>
              </div>

              {/* Progress bar visualizer */}
              <div className="w-full h-3 rounded-full bg-surface-raised overflow-hidden border border-border">
                <div
                  className={`h-full transition-all duration-300 ${
                    Number(simulatedWidth) > 10
                      ? 'bg-warning'
                      : Number(simulatedWidth) > 6
                      ? 'bg-brand'
                      : 'bg-success'
                  }`}
                  style={{ width: `${Math.min(100, Number(simulatedWidth) * 5)}%` }}
                />
              </div>

              <p className="text-xs text-ink-muted leading-relaxed">
                {Number(simulatedWidth) > 8
                  ? '⚠ Epistemic Guardrail: Broad confidence interval detected. Archetype updating is intentionally dampened to prevent false claims.'
                  : '✓ High precision: Sufficient session history and minimal hardware jitter allow confident trait tracking.'}
              </p>
            </div>
          </Card>
        </div>

        {/* Right Column (5 cols): Ethical Charter & Guardrail Sandbox */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card: The 4-Pillar Ethical Charter */}
          <Card className="p-6 space-y-4">
            <div className="border-b border-border pb-3">
              <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2">
                <span aria-hidden="true">📜</span> The 4-Pillar Ethical Charter
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Constitutional guardrails baked directly into the codebase.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-border bg-surface space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-ink">1. Non-Clinical Boundary</span>
                  <Badge tone="success">Strict</Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  Never provides clinical, medical, or psychiatric diagnostic labels. SynapseTwin is an educational cognitive twin, not a medical device.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-ink">2. Non-Biometric Hardware Lock</span>
                  <Badge tone="brand">Hardware</Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  Zero access to webcams, audio recordings, or biometric eye-tracking. Only timestamped probe interactions are recorded.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-ink">3. Zero-Guilt Philosophy</span>
                  <Badge tone="reward">Empathy</Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  Planned rest days preserve streak contracts. Prohibits shame-based notifications, punitive streak resets, and dark patterns.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border bg-surface space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-ink">4. Data Sovereignty &amp; Recourse</span>
                  <Badge tone="info">GDPR</Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  Complete client-side persistence, single-click Article 20 JSON archive export, and cryptographic Article 17 deletion certificates.
                </p>
              </div>
            </div>
          </Card>

          {/* Card: Live Non-Clinical Copy Guardrail Sandbox */}
          <Card className="p-6 space-y-4">
            <div className="border-b border-border pb-3">
              <h2 className="font-display font-bold text-base text-ink flex items-center gap-2">
                <span aria-hidden="true">🛡</span> Live Non-Clinical Copy Guardrail Sandbox
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Test the actual regex guardrail engine (<code className="font-mono">lintCopyText</code>) enforcing non-clinical vocabulary in real time.
              </p>
            </div>

            {/* Quick Test Presets */}
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setSandboxText(SAMPLE_CLINICAL_DEMO_INPUT)
                }
              >
                Clinical Test
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setSandboxText(SAMPLE_GUILT_DEMO_INPUT)
                }
              >
                Guilt Test
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setSandboxText(
                    'Working memory shows steady adaptation with 78% accuracy across lure trials.',
                  )
                }
              >
                Valid Test
              </Button>
            </div>

            {/* Textarea */}
            <div className="space-y-1">
              <label htmlFor="guardrail-input" className="text-xs font-bold text-ink block">
                Enter Text to Inspect:
              </label>
              <textarea
                id="guardrail-input"
                rows={3}
                value={sandboxText}
                onChange={(e) => setSandboxText(e.target.value)}
                className="w-full p-3 rounded-lg border-2 border-border bg-surface text-ink text-xs focus-ring"
                placeholder="Type or paste sample UI copy to check against the safety dictionary..."
              />
            </div>

            {/* Real-time Lint Result */}
            <div
              className={`p-3 rounded-xl border-2 space-y-2 ${
                lintResult.isClean
                  ? 'border-success/60 bg-success/10'
                  : 'border-danger/60 bg-danger/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <span>{lintResult.isClean ? '✓' : '⚠'}</span>
                  {lintResult.isClean
                    ? '100% Compliant Non-Clinical Copy'
                    : `${lintResult.violations.length} Violation(s) Flagged`}
                </span>
                <Badge tone={lintResult.isClean ? 'success' : 'danger'}>
                  {lintResult.isClean ? 'Safe' : 'Blocked'}
                </Badge>
              </div>

              {!lintResult.isClean && (
                <div className="space-y-1.5 pt-1">
                  {lintResult.violations.map((v, i) => (
                    <div
                      key={i}
                      className="p-2 rounded bg-surface border border-danger/40 text-xs space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-danger">"{v.term}"</span>
                        <span className="text-xs uppercase font-bold text-ink-muted">
                          {v.category}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted">
                        Suggested replacement: <strong className="text-ink">{v.replacementSuggestion}</strong>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mascot Companion */}
            <div className="pt-2 flex items-center gap-3 bg-surface-raised p-3 rounded-xl border border-border">
              <Mascot state="thinking" size="sm" />
              <p className="text-xs text-ink leading-tight">
                <strong>Empathetic epistemics.</strong> Words shape self-perception. Our copy linter prevents pathologizing normal human variance!
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Full-width Section: Measurement Biases & Mitigations Reference Table */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2">
              <span aria-hidden="true">📊</span> Known Measurement Biases &amp; Mitigations Reference Matrix
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Transparent disclosure of hardware, physiological, and environmental confounders and their architectural mitigations.
            </p>
          </div>
          <Badge tone="neutral" glyph="◈">
            5 Documented Confounders
          </Badge>
        </div>

        <div
          role="region"
          aria-label="Measurement Biases Matrix"
          tabIndex={0}
          className="focus-ring overflow-x-auto rounded-xl border border-border"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-canvas/80 text-ink-muted uppercase tracking-wider font-semibold border-b border-border">
              <tr>
                <th scope="col" className="p-3">Confounder Name</th>
                <th scope="col" className="p-3">Observed Impact on Signal</th>
                <th scope="col" className="p-3">Detection Mechanism</th>
                <th scope="col" className="p-3">Architectural Mitigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {BIASES_TABLE_DATA.map((row) => (
                <tr key={row.name} className="hover:bg-surface-raised transition-colors">
                  <td className="p-3 font-semibold text-ink">{row.name}</td>
                  <td className="p-3 text-warning font-mono">{row.impact}</td>
                  <td className="p-3 text-ink-muted">{row.detection}</td>
                  <td className="p-3 font-medium text-ink">{row.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* WhyThisPanel Epistemic Trail */}
      <WhyThisPanel trail={METHODOLOGY_WHY_TRAIL} />
    </div>
  )
}

export default MethodologyPage
