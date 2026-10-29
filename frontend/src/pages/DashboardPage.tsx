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
import { EmilyMoodPill } from '../components/common/EmilyMoodPill'

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

  const [selectedBattery, setSelectedBattery] = useState<'sharp' | 'steady' | 'winding'>('sharp')
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

  const assessedEstimates = useMemo(
    () => estimates.filter((e) => e.scorePct !== null),
    [estimates],
  )

  const overallConfidencePct = useMemo(() => {
    if (assessedEstimates.length === 0) return 0
    const avg =
      assessedEstimates.reduce((acc, item) => acc + item.confidence, 0) /
      assessedEstimates.length
    return Math.round(avg * 100)
  }, [assessedEstimates])

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

  const nextStepDescription = useMemo(() => {
    if (viewState === 'low-confidence') {
      return 'Gentle stimulus recall to narrow your hatched confidence bands without streak pressure.'
    }
    if (viewState === 'empty') {
      return 'Initial 3 micro-trials per dimension to establish your first clarity range.'
    }
    return 'Quick visual recall flow to lock in your Spatial Recall confidence range without mental fatigue.'
  }, [viewState])

  const nextStepLink = useMemo(() => {
    if (viewState === 'empty') return '/onboarding'
    return '/task/episodic_pattern_separation'
  }, [viewState])

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
            can construct your personalised epistemic twin. Your data remains
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
          TODAY (DASHBOARD) MAIN VIEWPORT (Matches Stitch Screen 4 Today Dashboard)
          ========================================================================= */}
      {(viewState === 'calibrated' ||
        viewState === 'low-confidence' ||
        viewState === 'partial') && (
        <>
          {/* 1. COMPANION GREETING BANNER WITH NOTEBOOK TAPE ACCENT */}
          <section className="relative bg-surface rounded-2xl border-2 border-border-strong shadow-doodle p-5 sm:p-6 transition-all hover:shadow-doodle-lg">
            {/* Hand-drawn tape accent */}
            <div
              className="absolute -top-3 left-8 sm:left-12 w-20 h-5 bg-brand-subtle border-2 border-border-strong -rotate-2 opacity-90 pointer-events-none shadow-xs"
              aria-hidden="true"
            />

            <div className="flex flex-col md:flex-row items-center md:items-start gap-5 sm:gap-6">
              {/* Mascot Hero Character with Confidence Halo Glow */}
              <div className="relative shrink-0 flex flex-col items-center">
                <BrianMascot
                  pose={viewState === 'low-confidence' ? 'explorer' : emilyConfig.brianPose}
                  size={120}
                  halo={true}
                  badge="ACTIVE"
                  badgeTone="tertiary"
                />
                <span className="font-mono text-xs text-ink-muted font-bold mt-2">
                  BRIAN v2.4
                </span>
              </div>

              {/* Speech Bubble Container with Tactical Beak */}
              <div className="flex-1 w-full flex flex-col justify-between gap-4">
                <div className="relative bg-surface-raised rounded-2xl border-2 border-border-strong p-4 sm:p-5 shadow-doodle">
                  {/* Left pointing beak for desktop */}
                  <div
                    className="hidden md:block absolute top-7 -left-3 w-0 h-0 border-t-[9px] border-t-transparent border-r-[12px] border-r-border-strong border-b-[9px] border-b-transparent"
                    aria-hidden="true"
                  />
                  <div
                    className="hidden md:block absolute top-7 -left-[9px] w-0 h-0 border-t-[7px] border-t-transparent border-r-[10px] border-r-surface-raised border-b-[7px] border-b-transparent z-10"
                    aria-hidden="true"
                  />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase tracking-wider text-brand font-bold">
                        Companion Note · 08:30 AM
                      </span>
                      <span className="w-1 h-1 rounded-pill bg-ink-muted" />
                      <span className="font-mono text-xs text-ink-muted">
                        Non-Clinical Twin
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 text-success font-mono text-xs bg-surface px-2.5 py-0.5 rounded-pill border border-border-strong">
                      <span className="text-xs">📈</span>
                      <span>Band Tightened ({overallConfidencePct}% Sync)</span>
                    </div>
                  </div>

                  <h1
                    id="dashboard-hero-heading"
                    className="font-display text-xl sm:text-2xl font-bold text-ink leading-snug"
                  >
                    Good morning, {personaDisplayName}! {heroInsightSentence} {emilyConfig.brianAdvice}
                  </h1>
                </div>

                {/* Counter-Regulatory Gentle De-Escalation Banner if Frustrated */}
                {currentEmotion === 'frustrated' && (
                  <div
                    role="status"
                    className="p-3 bg-surface-raised border-2 border-border-strong rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-doodle-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl shrink-0" aria-hidden="true">🍃</span>
                      <div>
                        <strong className="text-ink font-bold block text-xs">Pacing Check-In</strong>
                        <span className="text-ink-muted text-xs">Elevated cursor tension detected. Take a 60-second breather — no penalty for pausing.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManualEmotion('calm_flow')}
                      className="focus-ring px-3 py-1.5 rounded-md bg-surface text-ink border-2 border-border-strong text-xs font-bold shadow-doodle-sm cursor-pointer shrink-0"
                    >
                      Take 60s Breather
                    </button>
                  </div>
                )}

                {/* Quick 1-Tap Energy Check-In Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 sm:px-4 rounded-xl border-2 border-border-strong shadow-doodle-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-brand text-base" aria-hidden="true">⚡</span>
                    <span className="font-mono text-xs sm:text-sm text-ink font-bold">
                      Mental battery right now:
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap" id="battery-toggles">
                    <EmilyMoodPill />
                    {[
                      { id: 'sharp', icon: '⚡', label: 'Sharp' },
                      { id: 'steady', icon: '🌤️', label: 'Steady' },
                      { id: 'winding', icon: '🌙', label: 'Winding Down' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => setSelectedBattery(btn.id as typeof selectedBattery)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-border-strong font-mono text-xs font-bold transition-all cursor-pointer shadow-doodle-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-tactile-active ${
                          selectedBattery === btn.id
                            ? 'bg-brand text-brand-ink'
                            : 'bg-surface-raised text-ink hover:bg-brand-subtle'
                        }`}
                      >
                        <span>{btn.icon}</span>
                        <span>{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. CORE TWO-CARD HERO GRID: Cognitive Balance (Left) + Next Best Step (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Card A: Cognitive Balance Uncertainty Radar (7 cols on lg) */}
            <div className="lg:col-span-7 min-w-0">
              <UncertaintyRadar
                dimensions={activeDimensions}
                estimates={estimates}
                title="Cognitive Balance"
              />
            </div>

            {/* Card B: Today's Next Best Step & Active Goal (5 cols on lg) */}
            <div className="lg:col-span-5 min-w-0 flex flex-col justify-between">
              <Card className="p-6 flex flex-col justify-between h-full space-y-6 relative border-2 border-border-strong shadow-doodle">
                <div className="doodle-tape" />

                <div className="space-y-4">
                  {/* Top Eyebrow Badge */}
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-brand-subtle border-2 border-border-strong shadow-doodle-sm">
                      <span className="text-brand text-xs font-bold" aria-hidden="true">
                        {viewState === 'low-confidence' ? '◐' : '⚡'}
                      </span>
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-ink">
                        {viewState === 'low-confidence' ? 'Rest-First Pacing' : 'Next Best Step'}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-ink-muted pt-1">
                      {viewState === 'low-confidence'
                        ? 'Gentle recovery pacing recommended by BRIAN to consolidate wide confidence bands'
                        : 'Picked by BRIAN to sharpen your widest band (Spatial Recall)'}
                    </p>
                  </div>

                  {/* Central Task Presentation */}
                  <div className="p-4 rounded-xl bg-surface-raised border-2 border-border-strong shadow-doodle-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs uppercase tracking-wider text-brand font-bold">
                          Domain Focus: Spatial
                        </span>
                        <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink mt-0.5">
                          {nextStepTitle}
                        </h2>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-surface border-2 border-border-strong flex items-center justify-center text-brand text-lg shadow-doodle-sm shrink-0">
                        🧩
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                      {nextStepDescription}
                    </p>

                    {/* Micro Spec Pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
                      <span className="px-2 py-0.5 rounded bg-surface border border-border-strong text-ink font-semibold">
                        ⏱️ 120s max
                      </span>
                      <span className="px-2 py-0.5 rounded bg-surface border border-border-strong text-ink font-semibold">
                        🎯 8 decisions
                      </span>
                      <span className="px-2 py-0.5 rounded bg-surface border border-border-strong text-success font-bold">
                        Zero Failure Penalty
                      </span>
                    </div>

                    {/* Big Action Button */}
                    <div className="pt-2">
                      <Link
                        to={nextStepLink}
                        className="w-full py-3.5 px-4 rounded-xl bg-brand text-brand-ink font-display text-lg font-bold border-2 border-border-strong shadow-doodle hover:shadow-doodle-lg hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-tactile-active transition-all flex items-center justify-center gap-2 group no-underline text-center"
                      >
                        <span>Start Today's 2-Min Flow</span>
                        <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </div>

                  {/* Active Goal Progress Section */}
                  <div className="space-y-2 pt-1 border-t-2 border-dashed border-border-strong/30">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-ink flex items-center gap-1.5">
                        <span className="text-brand">🚩</span>
                        Weekly Calibration Goal
                      </span>
                      <span className="font-mono text-xs font-bold text-ink bg-surface-raised px-2 py-0.5 rounded border border-border-strong">
                        4 / 6 Flows
                      </span>
                    </div>

                    {/* Tactile Hand-drawn progress bar with tick markers */}
                    <div className="relative w-full h-4 bg-surface-raised rounded-pill border-2 border-border-strong overflow-hidden p-0.5">
                      <div
                        className="h-full bg-brand rounded-pill border-r-2 border-border-strong transition-all duration-500"
                        style={{ width: '66.6%' }}
                      />
                      <div className="absolute inset-0 flex justify-between px-3 pointer-events-none opacity-20">
                        <span className="w-0.5 h-full bg-border-strong" />
                        <span className="w-0.5 h-full bg-border-strong" />
                        <span className="w-0.5 h-full bg-border-strong" />
                        <span className="w-0.5 h-full bg-border-strong" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-ink-muted font-mono text-xs">
                      <span>4 of 6 weekly flows complete</span>
                      <span className="text-ink font-semibold">~2 left to reach ±6% clarity</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* 3. WEEKLY CONTINUITY & RHYTHM STRIP (Zero-Guilt Streak Ribbon) */}
          <section className="w-full bg-surface rounded-2xl border-2 border-border-strong shadow-doodle p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-brand text-xl" aria-hidden="true">🔄</span>
                <h2 className="font-display text-xl font-bold text-ink">
                  Weekly Continuity &amp; Rhythm
                </h2>
                <span className="font-mono text-xs bg-surface-raised px-2.5 py-0.5 rounded-pill border border-border-strong text-ink-muted">
                  Zero-Guilt Streak
                </span>
              </div>
              <div className="font-mono text-xs text-ink-muted">
                Consistency is about rhythm, not robotic streaks.
              </div>
            </div>

            {/* Seven-Day Ribbon Layout */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-stretch">
              {/* MON: Complete */}
              <div className="p-3 rounded-xl bg-surface-raised border-2 border-border-strong shadow-doodle-sm flex flex-col items-center text-center justify-between min-h-[105px]">
                <span className="font-mono text-xs uppercase font-bold text-ink-muted">Mon</span>
                <div className="w-8 h-8 rounded-pill bg-success border-2 border-border-strong flex items-center justify-center text-canvas font-bold shadow-xs">
                  ✓
                </div>
                <span className="font-mono text-xs font-semibold text-success">Focused · 4m</span>
              </div>

              {/* TUE: Complete */}
              <div className="p-3 rounded-xl bg-surface-raised border-2 border-border-strong shadow-doodle-sm flex flex-col items-center text-center justify-between min-h-[105px]">
                <span className="font-mono text-xs uppercase font-bold text-ink-muted">Tue</span>
                <div className="w-8 h-8 rounded-pill bg-success border-2 border-border-strong flex items-center justify-center text-canvas font-bold shadow-xs">
                  ✓
                </div>
                <span className="font-mono text-xs font-semibold text-success">Speed · 3m</span>
              </div>

              {/* WED: TODAY - Golden Crescent Moon Pill (Scheduled Recovery Day) */}
              <div className="col-span-2 sm:col-span-2 lg:col-span-2 p-3 sm:px-4 rounded-xl bg-reward-subtle border-2 border-border-strong shadow-doodle flex flex-col sm:flex-row items-center justify-between gap-3 relative">
                <div className="absolute -top-2.5 right-4 bg-brand text-brand-ink px-2 py-0.5 rounded-pill text-xs font-mono font-bold border border-border-strong shadow-xs">
                  TODAY
                </div>
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-pill bg-reward/40 border-2 border-border-strong flex items-center justify-center text-ink text-xl shadow-xs shrink-0">
                    🌙
                  </div>
                  <div>
                    <div className="font-mono text-xs sm:text-sm font-bold text-ink">
                      Wed · Scheduled Recovery Day
                    </div>
                    <div className="font-mono text-xs text-ink-muted">
                      Active memory consolidation — streak protected
                    </div>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 bg-surface rounded-pill border border-border-strong font-mono text-xs font-bold text-success shadow-xs">
                  <span>🛡️</span>
                  <span>Protected</span>
                </div>
              </div>

              {/* THU: Upcoming */}
              <div className="p-3 rounded-xl bg-surface border-2 border-dashed border-border-strong/50 flex flex-col items-center text-center justify-between min-h-[105px]">
                <span className="font-mono text-xs uppercase font-bold text-ink-muted">Thu</span>
                <div className="w-8 h-8 rounded-pill bg-surface-raised border border-border-strong/40 flex items-center justify-center text-ink-muted text-xs">
                  ⏱
                </div>
                <span className="font-mono text-xs text-ink-muted">Flexibility</span>
              </div>

              {/* FRI: Upcoming */}
              <div className="p-3 rounded-xl bg-surface border-2 border-dashed border-border-strong/50 flex flex-col items-center text-center justify-between min-h-[105px]">
                <span className="font-mono text-xs uppercase font-bold text-ink-muted">Fri</span>
                <div className="w-8 h-8 rounded-pill bg-surface-raised border border-border-strong/40 flex items-center justify-center text-ink-muted text-xs">
                  ⏱
                </div>
                <span className="font-mono text-xs text-ink-muted">Recall</span>
              </div>

              {/* SAT/SUN: Open Play */}
              <div className="p-3 rounded-xl bg-surface border-2 border-dashed border-border-strong/50 flex flex-col items-center text-center justify-between min-h-[105px]">
                <span className="font-mono text-xs uppercase font-bold text-ink-muted">Sat-Sun</span>
                <div className="w-8 h-8 rounded-pill bg-surface-raised border border-border-strong/40 flex items-center justify-center text-ink-muted text-xs">
                  ☀️
                </div>
                <span className="font-mono text-xs text-ink-muted">Open Play</span>
              </div>
            </div>
          </section>

          {/* 4. DAILY SCIENCE BITE & NON-CLINICAL REASSURANCE NOTE */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-surface-raised border-2 border-border-strong shadow-doodle-sm">
            <div className="flex items-center gap-3">
              <span className="text-brand text-xl" aria-hidden="true">📖</span>
              <span className="text-xs sm:text-sm text-ink leading-snug">
                <strong>Daily Science Bite:</strong> Sleep consolidation strengthens pattern separation without active practice. Enjoy your rest day!
              </span>
            </div>
            <Link
              to="/methodology"
              className="shrink-0 font-mono text-xs text-brand hover:text-ink underline font-bold flex items-center gap-1"
            >
              <span>Read 1-min synaptic digest</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {/* 5. EXPANDABLE DETAILS ACCORDION: Trajectory, Heatmap, Goals & Persona Switcher */}
          <details className="group rounded-2xl border-2 border-border-strong bg-surface p-6 shadow-doodle transition-all"
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
                            0–100 AI Collaboration Score
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
