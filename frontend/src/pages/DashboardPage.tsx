import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDimensionsByPreset } from '../config/dimensions'
import {
  buildEstimatesForDimensions,
  SAMPLE_COLLABORATION_SCORE,
  SAMPLE_WHY_THIS_TRAIL,
} from '../services/mocks/fixtures'
import { useAppStore, type PersonaId } from '../state/useAppStore'
import { FatigueHeatmap } from '../components/features/analytics/FatigueHeatmap'
import { ProjectionFanChart } from '../components/features/brain-twin/ProjectionFanChart'
import { UncertaintyRadar } from '../components/features/radar/UncertaintyRadar'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { BrianMascot } from '../components/features/brand/BrianMascot'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useEmilyStore } from '../state/useEmilyStore'
import { EMILY_EMOTION_CONFIGS } from '../styles/emilyTokens'

type DashboardViewState =
  | 'calibrated'
  | 'low-confidence'
  | 'partial'
  | 'empty'
  | 'loading'
  | 'error'
  | 'extreme-text'

export default function DashboardPage() {
  const {
    dimensionPreset,
    activePersona,
    setActivePersona,
  } = useAppStore()

  const [viewState, setViewState] = useState<DashboardViewState>(() => {
    if (activePersona === 'noisy-low-confidence') return 'low-confidence'
    if (activePersona === 'edge-missing-dim') return 'partial'
    if (activePersona === 'new-user') return 'empty'
    return 'calibrated'
  })

  const { currentEmotion, setManualEmotion } = useEmilyStore()
  const emilyConfig = EMILY_EMOTION_CONFIGS[currentEmotion]

  const effectivePersona: PersonaId =
    viewState === 'low-confidence'
      ? 'noisy-low-confidence'
      : viewState === 'partial'
        ? 'edge-missing-dim'
        : viewState === 'empty'
          ? 'new-user'
          : 'steady-improver'

  const activeDimensions = useMemo(
    () => getDimensionsByPreset(dimensionPreset),
    [dimensionPreset],
  )

  const estimates = useMemo(
    () => buildEstimatesForDimensions(activeDimensions, effectivePersona),
    [activeDimensions, effectivePersona],
  )

  const handleSelectViewState = (next: DashboardViewState) => {
    setViewState(next)
    if (next === 'calibrated') setActivePersona('steady-improver')
    if (next === 'low-confidence') setActivePersona('noisy-low-confidence')
    if (next === 'partial') setActivePersona('edge-missing-dim')
    if (next === 'empty') setActivePersona('new-user')
  }

  const personaDisplayName = useMemo(() => {
    if (viewState === 'low-confidence') return 'Salma'
    if (viewState === 'empty') return 'Nour'
    return 'Youssef'
  }, [viewState])

  const heroInsightSentence = useMemo(() => {
    if (viewState === 'low-confidence') {
      return 'Your reaction time variance suggests a gentle recovery block today.'
    }
    if (viewState === 'empty') {
      return 'Your cognitive baseline is ready for calibration.'
    }
    return 'Your working memory is trending up.'
  }, [viewState])

  const nextStepTitle = useMemo(() => {
    if (viewState === 'low-confidence') return 'Rest-First Recall Check'
    if (viewState === 'empty') return '2-Min Quick Baseline'
    return 'Visual Memory Clarity'
  }, [viewState])

  const nextStepLink = useMemo(() => {
    if (viewState === 'empty') return '/onboarding'
    return '/task/episodic_pattern_separation'
  }, [viewState])

  const chalkLegendItems = useMemo(() => {
    const getDimStat = (code: string, fallbackScore: number, fallbackBand: number) => {
      const dim = activeDimensions.find((d) => d.code === code)
      if (!dim) return { score: fallbackScore, band: fallbackBand }
      const est = estimates.find((e) => e.dimensionId === dim.id)
      if (!est || est.scorePct === null) return { score: fallbackScore, band: fallbackBand }
      const halfBand = Math.round((est.ciUpperPct - est.ciLowerPct) / 2)
      return { score: est.scorePct, band: halfBand }
    }

    return [
      { code: 'WM', glyph: '●', label: 'Working Memory', ...getDimStat('WM', 68, 5) },
      { code: 'IC', glyph: '■', label: 'Inhibition Control', ...getDimStat('IC', 75, 6) },
      { code: 'CF', glyph: '▲', label: 'Cognitive Flexibility', ...getDimStat('CF', 82, 7) },
      { code: 'AN', glyph: '◆', label: 'Attention Networks', ...getDimStat('AN', 89, 5) },
      { code: 'PS', glyph: '⬠', label: 'Processing Speed', ...getDimStat('PS', 74, 6) },
      { code: 'EP', glyph: '⬢', label: 'Pattern Separation', ...getDimStat('EP', 81, 16) },
      { code: 'VP', glyph: '★', label: 'Visual Perception', ...getDimStat('VP', 88, 5) },
    ]
  }, [activeDimensions, estimates])

  return (
    <div className="space-y-8 pb-12">
      {/* STATE: LOADING SKELETON */}
      {viewState === 'loading' && (
        <div
          role="status"
          aria-label="Loading dashboard telemetry"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          <Card className="lg:col-span-8 p-6 h-96 flex flex-col justify-between border-2 border-border-strong shadow-doodle">
            <div className="h-6 w-48 rounded bg-surface-raised animate-pulse" />
            <div className="h-56 w-56 mx-auto rounded-full border-4 border-border animate-spin" />
            <div className="h-4 w-64 mx-auto rounded bg-surface-raised animate-pulse" />
          </Card>
          <Card className="lg:col-span-4 p-6 h-96 flex flex-col justify-between border-2 border-border-strong shadow-doodle">
            <div className="h-6 w-36 rounded bg-surface-raised animate-pulse" />
            <div className="h-32 w-full rounded bg-surface-raised animate-pulse" />
            <div className="h-12 w-full rounded bg-surface-raised animate-pulse" />
          </Card>
        </div>
      )}

      {/* STATE: EMPTY (NEW LEARNER) */}
      {viewState === 'empty' && (
        <Card className="p-8 text-center space-y-4 max-w-2xl mx-auto border-2 border-border-strong shadow-doodle-lg">
          <div className="mx-auto w-24 h-24">
            <BrianMascot pose="explorer" size={88} halo={true} />
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">
            No Cognitive Sessions Logged Yet
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            SynapseTwin requires at least one 2-minute baseline session before it
            can construct your Personal Cognitive Twin. Your data remains
            strictly local under our non-biometric lock.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              to="/onboarding"
              className="tactile-btn bg-brand text-brand-ink px-6 py-3 text-sm font-bold no-underline inline-flex items-center gap-2 border-2 border-border-strong shadow-doodle"
            >
              <span>Start 2-Minute Baseline</span>
              <span aria-hidden="true">→</span>
            </Link>
            <Button
              variant="secondary"
              onClick={() => handleSelectViewState('calibrated')}
            >
              Load Demo Twin
            </Button>
          </div>
        </Card>
      )}

      {/* STATE: ERROR RECOVERY */}
      {viewState === 'error' && (
        <Card className="p-8 text-center space-y-4 max-w-xl mx-auto border-2 border-danger bg-danger-subtle shadow-doodle">
          <div className="mx-auto w-24 h-24">
            <BrianMascot pose="sleepy" size={80} halo={false} />
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">
            Temporary Inference Lag Detected
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            The cognitive twin synchronization service timed out. Cached
            deterministic values are displayed below. No local session data was
            lost.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => handleSelectViewState('calibrated')}
            >
              Retry Connection
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSelectViewState('calibrated')}
            >
              Use Deterministic Fallback
            </Button>
          </div>
        </Card>
      )}

      {/* STATE: EXTREME VALUES / STRESS TESTING */}
      {viewState === 'extreme-text' && (
        <Card className="p-6 space-y-2 border-2 border-border-strong bg-warning-subtle shadow-doodle">
          <h2 className="font-display text-lg font-bold text-ink">
            Stress Test: Extreme Score Extremes &amp; Long Strings
          </h2>
          <p className="font-mono text-xs text-ink">
            99.9% ± 0.1% · 142,850 Trials · Mean RT: 19,420 ms · Jitter: 0.4 ms
          </p>
          <p className="text-xs text-ink-muted">
            Verifies zero horizontal overflow at 375 px mobile and 200% browser zoom.
          </p>
        </Card>
      )}

      {/* =========================================================================
          CLASSROOM LECTURE SCENE: FLAT BLACKBOARD & TEACHER BRIAN STAGE
          ========================================================================= */}
      {(viewState === 'calibrated' ||
        viewState === 'low-confidence' ||
        viewState === 'partial') && (
        <>
          <section
            aria-label="Classroom Cognitive Lecture Scene"
            className="flex flex-col xl:flex-row items-stretch gap-6"
          >
            {/* 1. THE FLAT BLACKBOARD */}
            <div className="flex-1 min-w-0 blackboard-frame p-5 sm:p-7 flex flex-col justify-between text-chalk-white relative overflow-hidden">
              {/* Faint Blackboard Doodles & Grid Lines */}
              <div
                className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-10"
                aria-hidden="true"
              >
                <div className="absolute top-3 right-10 font-mono text-sm text-chalk-white">
                  ∑(focus) · Δt ≈ 120s
                </div>
                <div className="absolute top-20 left-1/3 font-display text-lg text-chalk-yellow">
                  ✦ ★ ✦
                </div>
                <div className="absolute bottom-16 right-1/4 font-mono text-xs text-chalk-mint">
                  d-prime &gt; 2.4 · flow zone
                </div>
                <div className="absolute top-1/2 left-6 font-display text-2xl text-chalk-white">
                  {'{ cognitive balance }'}
                </div>
              </div>

              <div>
                {/* 1.1 BLACKBOARD LECTURE HEADER */}
                <div className="relative border-b-2 border-dashed border-chalk-border pb-5 mb-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-pill bg-chalkboard-surface border border-chalk-border text-xs font-mono font-bold text-chalk-yellow">
                        <span>✨</span>
                        <span>{viewState === 'low-confidence' ? 'Rest-First Pacing' : 'Classroom Lecture'}</span>
                      </span>
                      <span className="text-xs font-mono text-chalk-muted">Non-Clinical Twin</span>
                    </div>
                    <div className="font-mono text-xs text-chalk-muted">
                      Period 1 · Daily Mind Calibration
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h1
                        id="dashboard-hero-heading"
                        className="font-display text-2xl sm:text-3xl font-extrabold text-chalk-white tracking-tight"
                      >
                        Good morning, {personaDisplayName}!
                      </h1>
                      <p className="text-sm text-chalk-muted leading-relaxed max-w-2xl m-0 font-sans">
                        {heroInsightSentence} {emilyConfig.brianAdvice}
                      </p>
                    </div>

                    {/* Primary CTA Button on Board */}
                    <div className="shrink-0 flex flex-col items-start md:items-end gap-1.5">
                      <Link
                        to={nextStepLink}
                        className="tactile-btn bg-brand text-brand-ink px-6 py-3 font-display text-base font-bold border-2 border-chalk-yellow rounded-xl shadow-doodle hover:bg-brand-hover hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center gap-2 no-underline text-center"
                      >
                        <span>Start Today's 2-Min Flow</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                      <span className="text-xs font-mono text-chalk-muted">
                        {nextStepTitle} · 120s max · Zero failure penalty
                      </span>
                    </div>
                  </div>

                  {/* Gentle Breather Prompt if Frustrated */}
                  {currentEmotion === 'frustrated' && (
                    <div
                      role="status"
                      className="p-3 bg-chalkboard-surface border border-dashed border-chalk-yellow/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-start mt-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl shrink-0" aria-hidden="true">🍃</span>
                        <div>
                          <strong className="text-chalk-yellow font-bold block text-xs">Pacing Check-In</strong>
                          <span className="text-chalk-muted text-xs">Elevated cursor tension detected. Take a 60-second breather — no penalty for pausing.</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setManualEmotion('calm_flow')}
                        className="focus-ring px-3 py-1.5 rounded-md bg-chalkboard text-chalk-white border border-chalk-border text-xs font-bold cursor-pointer shrink-0"
                      >
                        Take 60s Breather
                      </button>
                    </div>
                  )}
                </div>

                {/* 1.2 CHALKBOARD MAIN GRID: 6-Skill Balance (Left) + Core Balance Insights (Right) */}
                <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch mb-6">
                  {/* Column A: 6-Skill Cognitive Balance Radar + Chalk Legend */}
                  <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                    <div className="chalk-card p-5 space-y-3">
                      <div className="flex items-center justify-between border-b border-dashed border-chalk-border/70 pb-3">
                        <div>
                          <h2 className="font-display text-xl font-bold text-chalk-white">
                            6-Skill Cognitive Balance
                          </h2>
                          <p className="text-xs text-chalk-muted font-sans">
                            Showing {activeDimensions.length} cognitive dimensions with 95% confidence bands (hatched = preliminary low-confidence range).
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-pill bg-chalkboard border border-chalk-border font-mono text-xs text-chalk-yellow font-bold">
                          95% CI Bands
                        </span>
                      </div>

                      {/* Scoped Chalkboard Uncertainty Radar */}
                      <div className="chalkboard-radar">
                        <UncertaintyRadar
                          dimensions={activeDimensions}
                          estimates={estimates}
                          title="6-Skill Cognitive Balance"
                        />
                      </div>

                      {/* Chalk Dimension Legend */}
                      <div className="p-3 rounded-lg border border-dashed border-chalk-border bg-chalkboard/80 font-mono text-xs space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-dashed border-chalk-border/60 text-chalk-yellow font-bold">
                          <span className="flex items-center gap-1.5">
                            <span className="text-sm">▨</span>
                            <span>Hatched = Confidence &lt; 60%</span>
                          </span>
                          <span className="text-chalk-muted font-sans text-xs">7 Dimensions</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          {chalkLegendItems.map((item) => (
                            <div
                              key={item.code}
                              className="flex items-center justify-between px-2 py-1 rounded bg-chalkboard-surface border border-chalk-border/60"
                            >
                              <span className="flex items-center gap-1 text-chalk-white font-bold">
                                <span className="text-chalk-yellow">{item.glyph}</span>
                                <span>{item.code}</span>
                              </span>
                              <span className="text-chalk-mint font-semibold">
                                {item.score}%±{item.band}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column B: Core Balance Insights (3 Pillars) + Weekly Calibration Goal */}
                  <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                    <div className="chalk-card p-5 flex flex-col justify-between h-full space-y-4">
                      <div className="flex items-center justify-between border-b border-dashed border-chalk-border/70 pb-3">
                        <div>
                          <h2 className="font-display text-xl font-bold text-chalk-white">
                            Core Balance Insights
                          </h2>
                          <p className="text-xs text-chalk-muted font-sans">
                            Three verified pillars calibrated from your recent micro-rounds.
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-pill bg-chalkboard border border-chalk-border font-mono text-xs text-chalk-yellow font-bold">
                          ◈ {activeDimensions.length} Skills
                        </span>
                      </div>

                      {/* The 3 Pillars */}
                      <div className="space-y-3">
                        {/* Pillar 1: Mental Stamina */}
                        <div className="p-3.5 rounded-xl bg-chalkboard border border-dashed border-chalk-border space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-bold text-chalk-yellow uppercase tracking-wider flex items-center gap-1.5">
                              <span>⚡</span>
                              <span>Mental Stamina</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-pill bg-success-subtle text-success border border-success/40 text-xs font-bold">
                              ● Steady Focus
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between pt-1">
                            <span className="font-display text-2xl font-bold text-chalk-white">88%</span>
                            <span className="font-mono text-xs text-chalk-mint">Low fatigue drift</span>
                          </div>
                          <p className="text-xs text-chalk-muted leading-relaxed m-0 pt-0.5 font-sans">
                            Maintains high processing speed across multi-round blocks without cognitive dip.
                          </p>
                        </div>

                        {/* Pillar 2: Memory Sharpness */}
                        <div className="p-3.5 rounded-xl bg-chalkboard border border-dashed border-chalk-border space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-bold text-chalk-yellow uppercase tracking-wider flex items-center gap-1.5">
                              <span>🧩</span>
                              <span>Memory Sharpness</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-pill bg-brand-subtle text-brand border border-brand/40 text-xs font-bold">
                              ● Clarity Range ±4%
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between pt-1">
                            <span className="font-display text-2xl font-bold text-chalk-white">81%</span>
                            <span className="font-mono text-xs text-chalk-mint">Visual Clarity Locked</span>
                          </div>
                          <p className="text-xs text-chalk-muted leading-relaxed m-0 pt-0.5 font-sans">
                            Distinguishes subtle geometric and visual changes from memory lures without false alarms.
                          </p>
                        </div>

                        {/* Pillar 3: Focus Consistency */}
                        <div className="p-3.5 rounded-xl bg-chalkboard border border-dashed border-chalk-border space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-bold text-chalk-yellow uppercase tracking-wider flex items-center gap-1.5">
                              <span>🎯</span>
                              <span>Focus Consistency</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-pill bg-warning-subtle text-warning border border-warning/40 text-xs font-bold">
                              ★ Flow Zone
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between pt-1">
                            <span className="font-display text-2xl font-bold text-chalk-white">94%</span>
                            <span className="font-mono text-xs text-chalk-mint">38 ms Jitter</span>
                          </div>
                          <p className="text-xs text-chalk-muted leading-relaxed m-0 pt-0.5 font-sans">
                            Pointer rhythm and response tempos are tightly clustered within your natural flow zone.
                          </p>
                        </div>
                      </div>

                      {/* Weekly Calibration Goal */}
                      <div className="p-3 rounded-xl bg-chalkboard border border-dashed border-chalk-border space-y-2">
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="font-bold text-chalk-white flex items-center gap-1">
                            <span className="text-chalk-yellow">🚩</span>
                            <span>Weekly Calibration Goal</span>
                          </span>
                          <span className="font-bold text-chalk-yellow bg-chalkboard-surface px-2 py-0.5 rounded border border-chalk-border">
                            4 / 6 Flows
                          </span>
                        </div>
                        <div className="w-full h-3 bg-chalkboard-surface rounded-pill border border-chalk-border overflow-hidden p-0.5">
                          <div
                            className="h-full bg-brand rounded-pill transition-all duration-500"
                            style={{ width: '66.6%' }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-chalk-muted font-mono text-xs">
                          <span>4 of 6 weekly flows complete</span>
                          <span className="text-chalk-yellow font-semibold">~2 left to reach ±6% clarity</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1.3 WEEKLY CONTINUITY & RHYTHM (Zero-Guilt Streak Strip) */}
                <div className="chalk-card p-5 mb-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dashed border-chalk-border/70 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-chalk-yellow text-xl" aria-hidden="true">🔄</span>
                      <h2 className="font-display text-lg font-bold text-chalk-white">
                        Weekly Continuity &amp; Rhythm
                      </h2>
                      <span className="font-mono text-xs bg-chalkboard px-2.5 py-0.5 rounded-pill border border-chalk-border text-chalk-yellow">
                        Zero-Guilt Streak
                      </span>
                    </div>
                    <div className="font-mono text-xs text-chalk-muted">
                      Consistency is about rhythm, not robotic streaks.
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-stretch">
                    {/* Mon */}
                    <div className="p-3 rounded-xl bg-chalkboard border border-dashed border-chalk-border flex flex-col items-center text-center justify-between min-h-[105px]">
                      <span className="font-mono text-xs uppercase font-bold text-chalk-muted">Mon</span>
                      <div className="w-8 h-8 rounded-pill bg-success border border-chalk-border flex items-center justify-center text-chalk-white font-bold text-sm shadow-xs">
                        ✓
                      </div>
                      <span className="font-mono text-xs font-semibold text-chalk-mint">Focused · 4m</span>
                    </div>

                    {/* Tue */}
                    <div className="p-3 rounded-xl bg-chalkboard border border-dashed border-chalk-border flex flex-col items-center text-center justify-between min-h-[105px]">
                      <span className="font-mono text-xs uppercase font-bold text-chalk-muted">Tue</span>
                      <div className="w-8 h-8 rounded-pill bg-success border border-chalk-border flex items-center justify-center text-chalk-white font-bold text-sm shadow-xs">
                        ✓
                      </div>
                      <span className="font-mono text-xs font-semibold text-chalk-mint">Speed · 3m</span>
                    </div>

                    {/* Wed (TODAY) */}
                    <div className="col-span-2 sm:col-span-2 lg:col-span-2 p-3 sm:px-4 rounded-xl bg-chalkboard-surface border-2 border-chalk-yellow flex flex-col sm:flex-row items-center justify-between gap-3 relative shadow-doodle-sm">
                      <div className="absolute -top-2.5 right-4 bg-brand text-brand-ink px-2 py-0.5 rounded-pill text-xs font-mono font-bold border border-chalkboard-frame">
                        TODAY
                      </div>
                      <div className="flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-pill bg-chalkboard border border-chalk-border flex items-center justify-center text-chalk-yellow text-xl shrink-0">
                          🌙
                        </div>
                        <div>
                          <div className="font-mono text-xs sm:text-sm font-bold text-chalk-white">
                            Wed · Scheduled Recovery Day
                          </div>
                          <div className="font-mono text-xs text-chalk-muted font-sans">
                            Active memory consolidation — streak protected
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 bg-chalkboard rounded-pill border border-chalk-border font-mono text-xs font-bold text-chalk-mint shadow-xs">
                        <span>🛡️</span>
                        <span>Protected</span>
                      </div>
                    </div>

                    {/* Thu */}
                    <div className="p-3 rounded-xl bg-chalkboard border border-dashed border-chalk-border/50 flex flex-col items-center text-center justify-between min-h-[105px]">
                      <span className="font-mono text-xs uppercase font-bold text-chalk-muted">Thu</span>
                      <div className="w-8 h-8 rounded-pill bg-chalkboard-surface border border-chalk-border flex items-center justify-center text-chalk-muted text-xs">
                        ⏱
                      </div>
                      <span className="font-mono text-xs text-chalk-muted">Flexibility</span>
                    </div>

                    {/* Fri */}
                    <div className="p-3 rounded-xl bg-chalkboard border border-dashed border-chalk-border/50 flex flex-col items-center text-center justify-between min-h-[105px]">
                      <span className="font-mono text-xs uppercase font-bold text-chalk-muted">Fri</span>
                      <div className="w-8 h-8 rounded-pill bg-chalkboard-surface border border-chalk-border flex items-center justify-center text-chalk-muted text-xs">
                        ⏱
                      </div>
                      <span className="font-mono text-xs text-chalk-muted">Recall</span>
                    </div>

                    {/* Sat-Sun */}
                    <div className="p-3 rounded-xl bg-chalkboard border border-dashed border-chalk-border/50 flex flex-col items-center text-center justify-between min-h-[105px]">
                      <span className="font-mono text-xs uppercase font-bold text-chalk-muted">Sat-Sun</span>
                      <div className="w-8 h-8 rounded-pill bg-chalkboard-surface border border-chalk-border flex items-center justify-center text-chalk-muted text-xs">
                        ☀️
                      </div>
                      <span className="font-mono text-xs text-chalk-muted">Open Play</span>
                    </div>
                  </div>
                </div>

                {/* 1.4 DAILY SCIENCE BITE */}
                <div className="chalk-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-chalk-yellow text-xl" aria-hidden="true">📖</span>
                    <span className="text-xs sm:text-sm text-chalk-white leading-snug font-sans">
                      <strong>Daily Science Bite:</strong> Sleep consolidation strengthens pattern separation without active practice. Enjoy your rest day!
                    </span>
                  </div>
                  <Link
                    to="/methodology"
                    className="shrink-0 font-mono text-xs text-chalk-yellow hover:text-chalk-white underline font-bold flex items-center gap-1"
                  >
                    <span>Read 1-min synaptic digest</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>

              {/* 1.5 FLAT CHALK TRAY LEDGE (Bottom of Blackboard Frame) */}
              <div className="w-full -mx-5 -mb-5 sm:-mx-7 sm:-mb-7 mt-2 pt-2.5 pb-3 px-6 bg-chalkboard-tray border-t-2 border-chalkboard-frame flex items-center justify-between text-xs text-chalk-muted font-mono">
                <div className="flex items-center gap-3">
                  {/* Chalk sticks */}
                  <div className="flex items-center gap-1.5" title="Classroom chalk sticks">
                    <span className="w-5 h-2 rounded-xs bg-chalk-white inline-block shadow-xs" />
                    <span className="w-5 h-2 rounded-xs bg-chalk-yellow inline-block shadow-xs" />
                    <span className="w-5 h-2 rounded-xs bg-chalk-mint inline-block shadow-xs" />
                  </div>
                  {/* Felt eraser */}
                  <div className="flex items-center gap-1 border border-black/40 px-2 py-0.5 rounded-xs bg-chalkboard-frame text-xs text-chalk-muted">
                    <span>🧹</span>
                    <span>Felt Eraser</span>
                  </div>
                </div>
                <span className="text-xs opacity-80">Flat Chalkboard · Classroom Lecture</span>
              </div>
            </div>

            {/* =========================================================================
                2. TEACHER BRIAN PRESENTATION SLOT (Right side of blackboard)
                Dedicated empty space for user to insert Brian picture:
                - Casual teacher outfit (sweater or lab coat, glasses)
                - Holding chalk or pointer stick in hand pointing at the charts
                ========================================================================= */}
            <aside
              id="teacher-brian-slot"
              data-testid="teacher-brian-slot"
              aria-label="Teacher Brian Presentation Space"
              className="w-full xl:w-80 shrink-0 blackboard-frame p-5 flex flex-col justify-between items-center text-center relative min-h-[520px]"
            >
              {/* Top Badge */}
              <div className="w-full flex items-center justify-between border-b border-dashed border-chalk-border/70 pb-2.5">
                <span className="font-display text-xs font-bold text-chalk-yellow flex items-center gap-1.5">
                  <span>🧑‍🏫</span>
                  <span>Class Instructor</span>
                </span>
                <span className="font-mono text-xs text-chalk-muted">Classroom Stage</span>
              </div>

              {/* Picture Insertion Container */}
              <div className="flex-1 w-full flex flex-col items-center justify-center p-4 relative my-4 rounded-xl border-2 border-dashed border-chalk-yellow/40 bg-chalkboard-surface/40 overflow-hidden">
                {/* Visual placeholder guideline */}
                <div className="space-y-3 pointer-events-none">
                  <div className="w-20 h-20 mx-auto rounded-full border-2 border-dashed border-chalk-yellow/70 flex items-center justify-center text-3xl bg-chalkboard/50">
                    🪄
                  </div>
                  <div className="space-y-1 px-2">
                    <div className="font-display text-sm font-bold text-chalk-yellow">
                      Insert Brian Picture Here
                    </div>
                    <p className="font-sans text-xs text-chalk-muted leading-relaxed">
                      Friendly Axolotl teacher in casual sweater or lab coat holding chalk or pointer stick toward the charts.
                    </p>
                  </div>
                </div>

                {/* Dedicated <img> element ready for user image source */}
                <img
                  id="teacher-brian-img"
                  src=""
                  alt="Teacher Brian explaining cognitive balance charts"
                  className="hidden max-h-[420px] w-auto object-contain mx-auto transition-transform"
                />

                {/* Pointer stick directional arrow indicating charts */}
                <div
                  className="hidden xl:flex absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-chalk-yellow text-chalkboard font-bold items-center justify-center text-xs shadow-xs"
                  title="Teacher Brian points toward the blackboard"
                  aria-hidden="true"
                >
                  ←
                </div>
              </div>

              {/* Classroom Speech / Lecture Bubble */}
              <div className="w-full p-3 rounded-lg bg-chalkboard-surface border border-dashed border-chalk-border text-left space-y-1">
                <div className="font-display text-xs font-bold text-chalk-white flex items-center gap-1">
                  <span>💡</span>
                  <span>Today's Lesson Note:</span>
                </div>
                <p className="font-sans text-xs text-chalk-muted leading-relaxed m-0">
                  "Notice how your working memory and flow jitter stay clustered? That's your brain in steady rhythm!"
                </p>
              </div>
            </aside>
          </section>

          {/* 5. EXPANDABLE DETAILS ACCORDION: Trajectory, Heatmap, Goals & Persona Switcher */}
          <details data-technical-drawer className="group rounded-2xl border-2 border-border-strong bg-surface p-6 shadow-doodle transition-all"
          >
            <summary className="focus-ring cursor-pointer flex items-center justify-between font-display text-base font-bold text-ink select-none hover:text-brand transition-colors">
              <span className="flex items-center gap-2">
                <span className="transition-transform group-open:rotate-90 inline-block text-ink-muted">
                  ▸
                </span>
                <span>Explore How This Is Calculated (Trajectory, Heatmap, Telemetry — {activeDimensions.length} Dimensions)</span>
              </span>
              <Badge tone="neutral" glyph="◈">
                Deep Telemetry
              </Badge>
            </summary>

            <div className="mt-6 space-y-8 pt-6 border-t-2 border-dashed border-border-strong/30">
              {/* Profile Snapshot Switcher Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b-2 border-dashed border-border-strong/30">
                <span className="text-xs font-semibold text-ink-muted">
                  Demonstration Profile:
                </span>
                <div
                  role="group"
                  aria-label="Dashboard persona and state switcher"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {(
                    [
                      { id: 'calibrated', label: 'Calibrated Twin (Youssef · 84%)' },
                      {
                        id: 'low-confidence',
                        label: 'Low-Conf Hatched (Salma · 54%)',
                      },
                      { id: 'partial', label: 'Partial (1 Missing Dim)' },
                      { id: 'empty', label: 'Empty (New Learner)' },
                      { id: 'loading', label: 'Loading Skeleton' },
                      { id: 'error', label: 'Error Recovery' },
                      { id: 'extreme-text', label: 'Extreme Values' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      aria-pressed={viewState === tab.id}
                      onClick={() => handleSelectViewState(tab.id)}
                      className={`focus-ring min-h-10 px-3 py-1 rounded-pill border-2 border-border-strong text-xs font-bold cursor-pointer transition-colors shadow-doodle-sm ${
                        viewState === tab.id
                          ? 'bg-brand text-brand-ink'
                          : 'bg-surface-raised text-ink hover:bg-brand-subtle'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trajectory Fan Chart */}
              <section aria-label="Trajectory Fan Chart" className="space-y-3">
                <ProjectionFanChart
                  dimensions={activeDimensions}
                  persona={effectivePersona}
                />
              </section>

              {/* Why This Coaching Explainability Trail */}
              <section aria-label="Why This Trail" className="space-y-3">
                <WhyThisPanel
                  trail={SAMPLE_WHY_THIS_TRAIL}
                  title="Today's Priority AI Coach Recommendation (5-Part Reasoning Trail)"
                  showSummaryUpfront={true}
                  defaultExpanded={false}
                />
              </section>

              {/* Session Fatigue Heatmap & AI Collaboration Score */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-7">
                  <FatigueHeatmap persona={effectivePersona} />
                </div>

                <Card className="lg:col-span-5 p-5 flex flex-col justify-between gap-4 border-2 border-border-strong shadow-doodle">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-dashed border-border-strong/30 pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-lg font-bold text-ink">
                            Co-Pilot Synergy with Brian (0–100)
                          </h3>
                          <Badge tone="reward" glyph="★">
                            {SAMPLE_COLLABORATION_SCORE.totalScore} ± 4 / 100
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-muted mt-0.5">
                          Epistemic synergy index across human pace &amp; AI co-adaptation.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-ink-muted">Pacing Alignment</span>
                        <span className="font-bold text-ink">88 / 100</span>
                      </div>
                      <div className="w-full h-2 rounded-pill bg-surface-raised border border-border-strong overflow-hidden">
                        <div className="h-full bg-brand rounded-pill" style={{ width: '88%' }} />
                      </div>

                      <div className="flex justify-between text-xs font-mono pt-1">
                        <span className="text-ink-muted">Adaptation Feedback</span>
                        <span className="font-bold text-ink">79 / 100</span>
                      </div>
                      <div className="w-full h-2 rounded-pill bg-surface-raised border border-border-strong overflow-hidden">
                        <div className="h-full bg-success rounded-pill" style={{ width: '79%' }} />
                      </div>

                      <div className="flex justify-between text-xs font-mono pt-1">
                        <span className="text-ink-muted">Cognitive Synergy</span>
                        <span className="font-bold text-ink">84 / 100</span>
                      </div>
                      <div className="w-full h-2 rounded-pill bg-surface-raised border border-border-strong overflow-hidden">
                        <div className="h-full bg-reward rounded-pill" style={{ width: '84%' }} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t-2 border-dashed border-border-strong/30 flex items-center justify-between">
                    <span className="text-xs font-mono text-ink-muted">
                      Formula: 0.40P + 0.35A + 0.25S
                    </span>
                    <Link
                      to="/collaboration"
                      className="font-mono text-xs font-bold text-brand hover:underline"
                    >
                      Deep Breakdown →
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  )
}
