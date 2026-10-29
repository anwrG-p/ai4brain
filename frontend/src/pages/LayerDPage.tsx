import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'
import { Mascot } from '../components/features/brand/Mascot'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { useAppStore } from '../state/useAppStore'
import { getDimensionsByPreset } from '../config/dimensions'
import type { WhyThisTrail } from '../types'

const LAYER_D_WHY_TRAIL: WhyThisTrail = {
  id: 'trail-layer-d-projections',
  confidence: 0.97,
  observedData: [
    'Multimodal speech synthesis utilizes standardized frequency bands and conversational sentence cadences.',
    'Counterfactual trajectory forecasting models latent ability growth using Bayesian Markov decision processes.',
    'Fatigue saturation coefficients compound non-linearly when consecutive rest intervals fall below 48 hours.',
  ],
  inference:
    'Layer D expands SynapseTwin from a reflective twin into a proactive cognitive simulation partner.',
  recommendation:
    'Target a 3-session weekly cadence with 2 protected rest days to maximize latent gain while keeping fatigue below 30%.',
  counterfactual:
    'Without scenario forecasting, accelerated 5-day schedules produce diminishing returns due to unmodeled cognitive saturation.',
  sourceModule: 'sat_jepa_delta_c',
}

const TRANSCRIPT_SENTENCES = [
  'Good morning! Your working memory has stabilized at 78% ± 4% across recent calibration sessions.',
  'Today’s adaptive plan recommends two short set-shifting drills to narrow your cognitive flexibility interval.',
  'Remember to take your scheduled 5-minute pause at 11:30 to preserve optimal attentional alertness.',
]

export function LayerDPage() {
  const { dimensionPreset } = useAppStore()
  const activeDimensions = getDimensionsByPreset(dimensionPreset)

  // Voice Studio State
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [activeSentenceIdx, setActiveSentenceIdx] = useState<number>(0)
  const [speechPace, setSpeechPace] = useState<'0.85' | '1.0' | '1.25'>('1.0')
  const [voiceTimbre, setVoiceTimbre] = useState<'mentor' | 'analyst'>('mentor')

  // Scenario Simulator State
  const [trainingIntensity, setTrainingIntensity] = useState<'light' | 'standard' | 'accelerated'>('standard')
  const [sleepHours, setSleepHours] = useState<'6.0' | '7.5' | '9.0'>('7.5')
  const [restDaysCount, setRestDaysCount] = useState<number>(2)
  const [focusMix, setFocusMix] = useState<'balanced' | 'memory' | 'flexibility'>('balanced')

  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Handle simulated audio playback progression
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isPlaying) {
      const intervalMs = speechPace === '0.85' ? 3500 : speechPace === '1.0' ? 2800 : 2200
      timer = setInterval(() => {
        setActiveSentenceIdx((prev) => {
          if (prev < TRANSCRIPT_SENTENCES.length - 1) {
            return prev + 1
          }
          setIsPlaying(false)
          return 0
        })
      }, intervalMs)
    }
    return () => clearInterval(timer)
  }, [isPlaying, speechPace])

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleReplay = () => {
    setActiveSentenceIdx(0)
    setIsPlaying(true)
  }

  const handleResetScenario = () => {
    setTrainingIntensity('standard')
    setSleepHours('7.5')
    setRestDaysCount(2)
    setFocusMix('balanced')
    showToast('What-If scenario parameters restored to default baseline.')
  }

  // Calculate Fatigue / Burnout Risk Score (0 - 100)
  const calculateBurnoutRisk = () => {
    let score = 20
    if (trainingIntensity === 'light') score -= 10
    if (trainingIntensity === 'accelerated') score += 35

    if (sleepHours === '6.0') score += 25
    if (sleepHours === '9.0') score -= 15

    if (restDaysCount === 1) score += 20
    if (restDaysCount === 3) score -= 15

    return Math.max(10, Math.min(95, score))
  }

  const burnoutRisk = calculateBurnoutRisk()

  // Calculate multiplier for expected gains
  const getGainMultiplier = (dimId: string) => {
    let mult = 1.0
    if (trainingIntensity === 'light') mult *= 0.6
    if (trainingIntensity === 'accelerated') mult *= 1.4

    if (sleepHours === '6.0') mult *= 0.75
    if (sleepHours === '9.0') mult *= 1.2

    if (focusMix === 'memory' && (dimId === 'working_memory' || dimId === 'attention')) {
      mult *= 1.35
    }
    if (focusMix === 'flexibility' && (dimId === 'cognitive_flexibility' || dimId === 'processing_speed')) {
      mult *= 1.35
    }

    // High burnout penalty
    if (burnoutRisk > 65) {
      mult *= 0.7
    }

    return mult
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border-2 border-brand bg-surface shadow-xl flex items-center gap-3 animate-fadeIn"
        >
          <span className="text-brand font-bold text-lg" aria-hidden="true">
            ✓
          </span>
          <p className="text-sm font-semibold text-ink">{toastMessage}</p>
        </div>
      )}

      {/* Header section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" glyph="🌟">
              Layer D Bonus
            </Badge>
            <Badge tone="info" glyph="🎙">
              Multimodal Voice Studio
            </Badge>
            <Badge tone="reward" glyph="●">
              Scenario Projections
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/coach"
              className="tactile-btn bg-surface text-ink px-3.5 py-1.5 text-xs font-semibold inline-flex items-center no-underline border border-border"
            >
              AI Coach →
            </Link>
          </div>
        </div>

        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight text-ink">
            Layer D: Voice Coaching &amp; Scenario Projections
          </h1>
          <DoodleSquiggle className="max-w-xs mt-1" />
          <p className="text-ink-muted text-base max-w-3xl mt-1">
            Experience conversational multimodal voice guidance and simulate counterfactual cognitive twin futures.
            Test schedule trade-offs before committing your study calendar.
          </p>
        </div>
      </section>

      {/* Section 1: Multimodal Conversational Voice Coaching Studio */}
      <Card className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="font-display font-bold text-xl text-ink flex items-center gap-2">
              <span aria-hidden="true">🎙</span> Conversational Voice Coaching Studio
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Auditory coaching briefs with synchronized live transcripts and customizable speech cadence.
            </p>
          </div>
          <Badge tone="success" glyph="✓">
            100% Text Caption Parity
          </Badge>
        </div>

        {/* Audio Console Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left Player Controls */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <Button
                variant={isPlaying ? 'secondary' : 'primary'}
                size="md"
                onClick={handlePlayPause}
              >
                {isPlaying ? '⏸ Pause Voice Brief' : '▶ Play Voice Brief'}
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={handleReplay}
              >
                ↺ Replay
              </Button>
            </div>

            {/* Pace & Timbre Controls */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <span className="text-xs font-bold text-ink block">Speech Rate:</span>
                <div role="radiogroup" aria-label="Speech pace" className="flex gap-1">
                  {(['0.85', '1.0', '1.25'] as const).map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      role="radio"
                      aria-checked={speechPace === rate}
                      onClick={() => setSpeechPace(rate)}
                      className={`px-2 py-1 rounded text-xs font-semibold focus-ring cursor-pointer border ${
                        speechPace === rate
                          ? 'border-brand bg-brand text-brand-ink'
                          : 'border-border bg-surface text-ink hover:bg-surface-raised'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-ink block">Voice Timbre:</span>
                <div role="radiogroup" aria-label="Voice timbre" className="flex gap-1">
                  {[
                    { id: 'mentor', label: 'Mentor' },
                    { id: 'analyst', label: 'Analyst' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={voiceTimbre === t.id}
                      onClick={() => setVoiceTimbre(t.id as typeof voiceTimbre)}
                      className={`px-2 py-1 rounded text-xs font-semibold focus-ring cursor-pointer border ${
                        voiceTimbre === t.id
                          ? 'border-brand bg-brand text-brand-ink'
                          : 'border-border bg-surface text-ink hover:bg-surface-raised'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right SVG Waveform Visualizer */}
          <div className="md:col-span-7 p-4 rounded-xl border border-border bg-canvas/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ink flex items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    isPlaying ? 'bg-success animate-pulse' : 'bg-ink-muted'
                  }`}
                  aria-hidden="true"
                />
                Audio Waveform Visualizer
              </span>
              <span className="text-ink-muted font-mono">
                {isPlaying ? `Playing (${speechPace}x · ${voiceTimbre})` : 'Paused'}
              </span>
            </div>

            {/* Animated Frequency Bars */}
            <div
              className="flex items-center justify-between h-14 px-2 pt-1 gap-1"
              aria-hidden="true"
            >
              {[12, 28, 45, 20, 60, 34, 18, 52, 70, 42, 25, 65, 38, 80, 55, 30, 48, 62, 22, 35, 58, 26, 40, 16].map(
                (baseHeight, i) => {
                  const dynamicHeight = isPlaying ? Math.min(100, baseHeight + (i % 3) * 12) : 15
                  return (
                    <div
                      key={i}
                      className="w-1.5 rounded-full transition-all duration-200 bg-brand"
                      style={{
                        height: `${dynamicHeight}%`,
                        opacity: isPlaying ? 0.9 : 0.35,
                      }}
                    />
                  )
                },
              )}
            </div>
          </div>
        </div>

        {/* Synchronized Live Transcript */}
        <div className="p-4 rounded-xl border border-border bg-canvas space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Synchronized Accessible Transcript:
            </span>
            <Badge tone="neutral">Real-Time Captions</Badge>
          </div>

          <div className="space-y-2">
            {TRANSCRIPT_SENTENCES.map((sentence, idx) => {
              const isCurrent = activeSentenceIdx === idx && isPlaying
              return (
                <p
                  key={idx}
                  className={`p-2.5 rounded-lg text-sm transition-all ${
                    isCurrent
                      ? 'border-l-4 border-brand bg-brand/10 font-bold text-ink shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <span className="font-mono text-xs text-brand mr-2 font-bold">
                    0{idx + 1}.
                  </span>
                  {sentence}
                </p>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Section 2: 12-Column Grid (What-If Scenario Simulator & Projected Impacts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Parameter Controls & Burnout Risk */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card A: Counterfactual Scenario Tuner */}
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2">
                <span aria-hidden="true">🎛</span> Counterfactual "What-If" Scenario Tuner
              </h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResetScenario}
                title="Reset scenario parameters to standard baseline"
              >
                ↺ Reset
              </Button>
            </div>

            {/* Parameter 1: Training Intensity */}
            <div className="space-y-2">
              <label id="intensity-label" className="text-xs font-bold text-ink block">
                Weekly Training Intensity
              </label>
              <div
                role="radiogroup"
                aria-labelledby="intensity-label"
                className="grid grid-cols-3 gap-2"
              >
                {[
                  { id: 'light', label: 'Light', desc: '1 session / week' },
                  { id: 'standard', label: 'Standard', desc: '3 sessions / week' },
                  { id: 'accelerated', label: 'Accelerated', desc: '5 sessions / week' },
                ].map((item) => {
                  const active = trainingIntensity === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTrainingIntensity(item.id as typeof trainingIntensity)}
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

            {/* Parameter 2: Sleep & Recovery Target */}
            <div className="space-y-2 pt-2 border-t border-border">
              <label id="sleep-label" className="text-xs font-bold text-ink block">
                Average Sleep &amp; Recovery Target
              </label>
              <div
                role="radiogroup"
                aria-labelledby="sleep-label"
                className="grid grid-cols-3 gap-2"
              >
                {[
                  { id: '6.0', label: '6.0 Hours', desc: 'Sub-optimal (-25% gain)' },
                  { id: '7.5', label: '7.5 Hours', desc: 'Balanced Baseline' },
                  { id: '9.0', label: '9.0 Hours', desc: 'Restored (+20% gain)' },
                ].map((item) => {
                  const active = sleepHours === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSleepHours(item.id as typeof sleepHours)}
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

            {/* Parameter 3: Protected Rest Days */}
            <div className="space-y-2 pt-2 border-t border-border">
              <label id="rest-label" className="text-xs font-bold text-ink block">
                Protected Rest Days (Zero-Penalty Streak Preservation)
              </label>
              <div
                role="radiogroup"
                aria-labelledby="rest-label"
                className="grid grid-cols-3 gap-2"
              >
                {[
                  { count: 1, label: '1 Day / Week', desc: 'Minimal Rest' },
                  { count: 2, label: '2 Days / Week', desc: 'Recommended' },
                  { count: 3, label: '3 Days / Week', desc: 'Deep Consolidation' },
                ].map((item) => {
                  const active = restDaysCount === item.count
                  return (
                    <button
                      key={item.count}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setRestDaysCount(item.count)}
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

            {/* Parameter 4: Dimension Focus Mix */}
            <div className="space-y-2 pt-2 border-t border-border">
              <label id="mix-label" className="text-xs font-bold text-ink block">
                Cognitive Focus Allocation
              </label>
              <div
                role="radiogroup"
                aria-labelledby="mix-label"
                className="grid grid-cols-3 gap-2"
              >
                {[
                  { id: 'balanced', label: 'Balanced 360°', desc: 'Even distribution' },
                  { id: 'memory', label: 'Memory Priority', desc: '+35% WM & Attention' },
                  { id: 'flexibility', label: 'Flexibility Priority', desc: '+35% CF & Speed' },
                ].map((item) => {
                  const active = focusMix === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setFocusMix(item.id as typeof focusMix)}
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
          </Card>

          {/* Card B: Cognitive Fatigue & Burnout Risk Early Warning */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2">
                <span aria-hidden="true">🔋</span> Cognitive Fatigue &amp; Burnout Risk Forecast
              </h2>
              <Badge tone={burnoutRisk > 60 ? 'danger' : burnoutRisk > 35 ? 'warning' : 'success'}>
                {burnoutRisk}% Risk Score
              </Badge>
            </div>

            {/* Meter Bar */}
            <div className="space-y-2">
              <div className="w-full h-4 rounded-full bg-surface-raised overflow-hidden border border-border">
                <div
                  className={`h-full transition-all duration-300 ${
                    burnoutRisk > 60
                      ? 'bg-danger'
                      : burnoutRisk > 35
                      ? 'bg-warning'
                      : 'bg-success'
                  }`}
                  style={{ width: `${burnoutRisk}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-ink-muted font-mono">
                <span>0% Optimal Resilience</span>
                <span>50% Moderate Load</span>
                <span>100% Saturation</span>
              </div>
            </div>

            <p className="text-xs text-ink leading-relaxed">
              {burnoutRisk > 60
                ? '⚠ Elevated Burnout Risk: High training volume without sufficient rest intervals degrades latency and inflates error bursts. Add a protected rest day to maintain trajectory.'
                : burnoutRisk > 35
                ? '⚡ Moderate Load: Sustainable progression pace. Ensure 7.5+ hours of sleep on assessment evenings.'
                : '✓ Optimal Resilience: Balanced cadence allows full neural consolidation. Minimal risk of cognitive fatigue.'}
            </p>
          </Card>
        </div>

        {/* Right Column (5 cols): Projected 4-Week Impacts & Companion */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card C: Projected 4-Week Latent Trajectory Impacts */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display font-bold text-base text-ink flex items-center gap-2">
                <span aria-hidden="true">📈</span> Projected 4-Week Latent Trajectory
              </h2>
              <Badge tone="brand">Bayesian Heuristic</Badge>
            </div>

            <p className="text-xs text-ink-muted">
              Estimated 4-week net gains derived from simulated training intensity, sleep recovery, and focus allocation.
            </p>

            {/* Top 3 Dimension Impact Cards */}
            <div className="space-y-3">
              {activeDimensions.slice(0, 3).map((d) => {
                const mult = getGainMultiplier(d.id)
                const baseDelta = d.id === 'working_memory' ? 4.8 : d.id === 'inhibition_control' ? 3.6 : 5.4
                const projectedGain = (baseDelta * mult).toFixed(1)
                const uncertaintyWidth = (2.2 / Math.sqrt(mult)).toFixed(1)

                return (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-xl border border-border bg-canvas/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <span style={{ color: d.colorCssVar }}>{d.markerGlyph}</span>
                        {d.name}
                      </span>
                      <span className="font-mono text-xs font-bold text-success">
                        +{projectedGain}% ± {uncertaintyWidth}%
                      </span>
                    </div>

                    {/* Comparative delta progress bar */}
                    <div className="w-full h-2 rounded-full bg-surface-raised overflow-hidden border border-border">
                      <div
                        className="h-full bg-brand transition-all duration-300"
                        style={{ width: `${Math.min(100, Number(projectedGain) * 8)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Non-Clinical Disclaimer */}
            <div className="p-3 rounded-lg border border-border bg-surface text-xs text-ink-muted leading-relaxed">
              <strong>Epistemic Note:</strong> Projections represent mathematical simulations of cognitive adaptation curves based on healthy adult psychometric literature, not clinical predictions.
            </div>

            {/* Companion Mascot */}
            <div className="pt-2 flex items-center gap-3 bg-surface-raised p-3 rounded-xl border border-border">
              <Mascot state="celebrate" size="sm" />
              <p className="text-xs text-ink leading-tight">
                <strong>What-if simulations put you in control!</strong> Testing scenarios before scheduling protects your streak and ensures balanced growth!
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Section 3: Full-Width Multidimensional Counterfactual Impact Matrix Table */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2">
              <span aria-hidden="true">📊</span> Multidimensional Counterfactual Impact Matrix
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Live projected trajectory for all {activeDimensions.length} active cognitive dimensions in preset {dimensionPreset}.
            </p>
          </div>
          <Badge tone="neutral" glyph="◈">
            Preset {dimensionPreset} Dimensions
          </Badge>
        </div>

        <div
          role="region"
          aria-label="Counterfactual Impact Table"
          tabIndex={0}
          className="focus-ring overflow-x-auto rounded-xl border border-border"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-canvas/80 text-ink-muted uppercase tracking-wider font-semibold border-b border-border">
              <tr>
                <th scope="col" className="p-3">Dimension Name</th>
                <th scope="col" className="p-3">Current Baseline</th>
                <th scope="col" className="p-3">Projected (4-Wk)</th>
                <th scope="col" className="p-3">Net Expected Delta</th>
                <th scope="col" className="p-3">Credible Interval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeDimensions.map((d, idx) => {
                const mult = getGainMultiplier(d.id)
                const baselineScore = 70 + (idx * 3) % 15
                const baseDelta = 3.5 + (idx % 3) * 1.5
                const delta = (baseDelta * mult).toFixed(1)
                const projected = (baselineScore + Number(delta)).toFixed(1)
                const interval = (2.4 / Math.sqrt(mult)).toFixed(1)

                return (
                  <tr key={d.id} className="hover:bg-surface-raised transition-colors">
                    <td className="p-3 font-semibold text-ink flex items-center gap-2">
                      <span style={{ color: d.colorCssVar }}>{d.markerGlyph}</span>
                      {d.name}
                    </td>
                    <td className="p-3 font-mono text-ink-muted">{baselineScore}% ± 4%</td>
                    <td className="p-3 font-mono font-bold text-ink">{projected}%</td>
                    <td className="p-3 font-mono font-bold text-success">+{delta}%</td>
                    <td className="p-3 font-mono text-ink-muted">± {interval}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* WhyThisPanel Epistemic Trail */}
      <WhyThisPanel trail={LAYER_D_WHY_TRAIL} />
    </div>
  )
}

export default LayerDPage
