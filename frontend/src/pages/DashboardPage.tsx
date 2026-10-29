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
import teacherBrianImg from '../assets/mascot/Teacher-Brian.png'
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

const WEEK_DAYS = [
  { day: 'Mon', completed: true, isRest: false, isToday: false },
  { day: 'Tue', completed: true, isRest: false, isToday: false },
  { day: 'Wed', completed: false, isRest: true, isToday: true },
  { day: 'Thu', completed: false, isRest: false, isToday: false },
  { day: 'Fri', completed: false, isRest: false, isToday: false },
  { day: 'Sat', completed: false, isRest: false, isToday: false },
  { day: 'Sun', completed: false, isRest: true, isToday: false },
] as const

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

  const teacherBrianScale = 3
  const teacherBrianMoveX = 0
  const teacherBrianMoveY = 150

  const teacherBrianStyle: React.CSSProperties = {
    transform: `translate(${teacherBrianMoveX}px, ${teacherBrianMoveY}px) scale(${teacherBrianScale})`,
    transformOrigin: 'bottom center',
    zIndex: 20,
    position: 'relative',
  }

  // =========================================================================
  // 📐 CLASSROOM BOARD MANUAL DIMENSIONS (SCALE & SIZE CONTROLS)
  // Adjust these values to change the board's dimensions:
  // - boardWidth: '100%' (or e.g. '800px', '900px', '1000px')
  // - boardMaxWidth: '100%' (e.g. '950px', '1200px')
  // - boardMinHeight: 'auto' (or e.g. '300px', '380px', '450px' to make taller)
  // =========================================================================
  const boardWidth = '100%'
  const boardMaxWidth = '1200px'
  const boardMinHeight = '500px'

  const boardStyle: React.CSSProperties = {
    width: boardWidth,
    maxWidth: boardMaxWidth,
    minHeight: boardMinHeight,
  }

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
          ANIMATED CLASSROOM LECTURE STAGE
          Composition:
          - Left: Reserved empty space for Teacher Brian image (#brian-teacher-slot)
          - Right: Flat Classroom Board with wooden frame, marker/eraser tray & all metrics
          ========================================================================= */}
      {(viewState === 'calibrated' ||
        viewState === 'low-confidence' ||
        viewState === 'partial') && (
          <>
            <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-6 relative">
              {/* 1. TEACHER BRIAN THE AXOLOTL (FRONT PLANE) */}
              <div
                id="brian-teacher-slot"
                data-testid="brian-teacher-slot"
                className="flex w-64 sm:w-72 lg:w-80 shrink-0 flex-col items-center justify-end relative z-20 self-center lg:self-end min-h-[350px] lg:min-h-[500px] pointer-events-none"
                aria-label="Teacher Brian mascot illustration"
              >
                <img
                  src={teacherBrianImg}
                  alt="Teacher Brian presenting the classroom performance board"
                  style={teacherBrianStyle}
                  className="w-full h-auto select-none pointer-events-none drop-shadow-md relative z-20"
                />
              </div>

              {/* 2. THE FLAT CLASSROOM BOARD */}
              <div className="flex-1 min-w-0 relative z-10">
                <section
                  id="classroom-board"
                  aria-label="Classroom Performance Board"
                  className="board-wood-frame"
                  style={boardStyle}
                >
                  <div className="board-canvas p-5 sm:p-7 flex-1 flex flex-col justify-between">
                    {/* WEEKLY CONTINUITY & RHYTHM (Drawn directly on Classroom Board) */}
                    <div className="space-y-4">
                      {/* Minimalist Board Header: Greeting & Streak */}
                      <div className="flex items-center gap-2 border-b-2 border-dashed border-border-strong/30 pb-3">
                        <span className="text-xl" aria-hidden="true">
                          🔥
                        </span>
                        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink">
                          Welcome back, {personaDisplayName}! You're on a streak
                        </h2>
                      </div>

                      {/* Seven-Day Minimalist Hand-Drawn Strip */}
                      <div className="grid grid-cols-7 gap-2 sm:gap-3 items-stretch py-1">
                        {WEEK_DAYS.map((item) => (
                          <div
                            key={item.day}
                            className={`p-2.5 sm:p-3 rounded-xl flex flex-col items-center justify-between text-center min-h-24 transition-colors ${item.isToday
                              ? 'border-2 border-dashed border-brand/80 bg-brand/10'
                              : 'border border-dashed border-border-strong/30 bg-surface/20'
                              }`}
                          >
                            {/* Hand-drawn Day Name */}
                            <span
                              className={`font-display text-sm sm:text-base font-bold tracking-wide ${item.isToday ? 'text-brand' : 'text-ink'
                                }`}
                            >
                              {item.day}
                            </span>

                            {/* Status: Green Check on completed days or Moon on rest days */}
                            <div className="my-auto flex items-center justify-center">
                              {item.completed ? (
                                <span
                                  className="font-display text-2xl font-bold text-success leading-none select-none"
                                  aria-label={`${item.day}: Completed`}
                                >
                                  ✓
                                </span>
                              ) : item.isRest ? (
                                <span
                                  className="text-xl select-none"
                                  title="Rest Day"
                                  aria-label={`${item.day}: Rest Day`}
                                >
                                  🌙
                                </span>
                              ) : (
                                <span
                                  className="w-4 h-4 rounded-full border border-dashed border-border-strong/40 inline-block opacity-40"
                                  aria-label={`${item.day}: Upcoming`}
                                />
                              )}
                            </div>

                            {/* Minimal Indicator (Today / Rest) */}
                            <span className="font-mono text-xs text-ink-muted">
                              {item.isToday ? (
                                <span className="text-brand font-bold">Today</span>
                              ) : item.isRest ? (
                                <span>Rest</span>
                              ) : null}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* DAILY SCIENCE BITE (Chalk/Marker Footnote on Board) */}
                    <div className="mt-auto pt-4 border-t border-dashed border-border-strong/30 flex items-center gap-2 text-xs sm:text-sm text-ink">
                      <span className="text-brand text-base shrink-0" aria-hidden="true">
                        📖
                      </span>
                      <span>
                        <strong>Daily Science Bite:</strong> Sleep consolidation strengthens pattern separation without active practice. Enjoy your rest day!
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* =========================================================================
                UNDER THE BOARD: HERO GREETING & PRIMARY CTA
                ========================================================================= */}
            <Card className="p-6 border-2 border-border-strong bg-surface shadow-doodle space-y-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  {viewState === 'low-confidence' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-pill bg-brand-subtle border border-border-strong text-xs font-mono font-bold text-ink shadow-xs">
                        <span>🌱</span>
                        <span>Rest-First Pacing</span>
                      </span>
                      <span className="text-xs font-mono text-ink-muted">
                        Non-Clinical Cognitive Space
                      </span>
                    </div>
                  )}

                  <h1
                    id="dashboard-hero-heading"
                    className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight"
                  >
                    Good morning, {personaDisplayName}!
                  </h1>

                  <p className="text-sm sm:text-base text-ink-muted leading-relaxed max-w-2xl m-0">
                    {heroInsightSentence} {emilyConfig.brianAdvice}
                  </p>
                </div>

                {/* Primary CTA Button */}
                <div className="flex flex-col items-center sm:items-end gap-1 shrink-0">
                  <Link
                    to={nextStepLink}
                    className="tactile-btn py-3 px-6 rounded-xl bg-brand text-brand-ink font-display text-base font-bold border-2 border-border-strong shadow-doodle hover:shadow-doodle-lg no-underline flex items-center justify-center gap-2 text-center"
                  >
                    <span>Start Today's 2-Min Flow</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                  <div className="text-xs font-mono text-ink-muted flex items-center gap-1.5 pt-0.5">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
                    <span>{nextStepTitle} · 120s max</span>
                  </div>
                </div>
              </div>

              {/* Frustrated De-Escalation Banner if detected */}
              {currentEmotion === 'frustrated' && (
                <div
                  role="status"
                  className="p-3 bg-surface-raised border-2 border-border-strong rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-doodle-sm text-start"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl shrink-0" aria-hidden="true">
                      🍃
                    </span>
                    <div>
                      <strong className="text-ink font-bold block text-xs">
                        Pacing Check-In
                      </strong>
                      <span className="text-ink-muted text-xs">
                        Elevated cursor tension detected. Take a 60-second
                        breather — no penalty for pausing.
                      </span>
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
            </Card>

            {/* =========================================================================
                UNDER THE BOARD: 6-SKILL COGNITIVE BALANCE & CORE BALANCE INSIGHTS
                ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Wing (7 cols on lg): 6-Skill Cognitive Balance Radar */}
              <div className="lg:col-span-7 min-w-0">
                <UncertaintyRadar
                  dimensions={activeDimensions}
                  estimates={estimates}
                  title="6-Skill Cognitive Balance"
                  showSubtitle={false}
                  showTableToggle={false}
                />
              </div>

              {/* Right Wing (5 cols on lg): Core Balance Insights & Weekly Goal */}
              <div className="lg:col-span-5 min-w-0 flex flex-col justify-between">
                <Card className="p-5 flex flex-col justify-between h-full space-y-4 border-2 border-border-strong shadow-doodle">
                  <div className="flex items-center justify-between border-b-2 border-border pb-3">
                    <div>
                      <h2 className="font-display text-lg font-bold text-ink">
                        Core Balance Insights
                      </h2>
                      <p className="text-xs text-ink-muted">
                        Three verified pillars calibrated from your recent micro-rounds.
                      </p>
                    </div>
                    <Badge tone="brand" glyph="◈">
                      {activeDimensions.length} Skills
                    </Badge>
                  </div>

                  {/* 3 Key Metric Cards */}
                  <div className="space-y-3">
                    {/* Card 1: Mental Stamina */}
                    <div className="p-3.5 rounded-xl bg-surface-raised border-2 border-border-strong shadow-doodle-sm space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                          <span className="text-brand">⚡</span>
                          <span>Mental Stamina</span>
                        </span>
                        <Badge tone="success" glyph="●">
                          Steady Focus
                        </Badge>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <span className="font-display text-2xl font-black text-ink">
                          88%
                        </span>
                        <span className="font-mono text-xs text-ink-muted">
                          Low fatigue drift
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted leading-relaxed m-0 pt-0.5">
                        Maintains high processing speed across multi-round blocks without cognitive dip.
                      </p>
                    </div>

                    {/* Card 2: Memory Sharpness */}
                    <div className="p-3.5 rounded-xl bg-surface-raised border-2 border-border-strong shadow-doodle-sm space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                          <span className="text-brand">🧩</span>
                          <span>Memory Sharpness</span>
                        </span>
                        <Badge tone="brand" glyph="●">
                          Clarity Range ±4%
                        </Badge>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <span className="font-display text-2xl font-black text-ink">
                          {(estimates.find(
                            (e) =>
                              e.dimensionId ===
                              'episodic_pattern_separation',
                          )?.scorePct ?? 81)}
                          %
                        </span>
                        <span className="font-mono text-xs text-ink-muted">
                          Visual Clarity Locked
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted leading-relaxed m-0 pt-0.5">
                        Distinguishes subtle geometric and visual changes from memory lures without false alarms.
                      </p>
                    </div>

                    {/* Card 3: Focus Consistency */}
                    <div className="p-3.5 rounded-xl bg-surface-raised border-2 border-border-strong shadow-doodle-sm space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                          <span className="text-brand">🎯</span>
                          <span>Focus Consistency</span>
                        </span>
                        <Badge tone="reward" glyph="★">
                          Flow Zone
                        </Badge>
                      </div>
                      <div className="flex items-baseline justify-between pt-1">
                        <span className="font-display text-2xl font-black text-ink">
                          94%
                        </span>
                        <span className="font-mono text-xs text-ink-muted">
                          38 ms Jitter
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted leading-relaxed m-0 pt-0.5">
                        Pointer rhythm and response tempos are tightly clustered within your natural flow zone.
                      </p>
                    </div>
                  </div>

                  {/* Active Goal Progress Strip */}
                  <div className="space-y-2 pt-2 border-t-2 border-dashed border-border-strong/30">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-bold text-ink flex items-center gap-1">
                        <span className="text-brand">🚩</span>
                        <span>Weekly Calibration Goal</span>
                      </span>
                      <span className="font-bold text-ink bg-surface-raised px-2 py-0.5 rounded border border-border-strong">
                        4 / 6 Flows
                      </span>
                    </div>
                    <div className="relative w-full h-3 bg-surface-raised rounded-pill border-2 border-border-strong overflow-hidden p-0.5">
                      <div
                        className="h-full bg-brand rounded-pill border-r border-border-strong transition-all duration-500"
                        style={{ width: '66.6%' }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-ink-muted font-mono text-xs">
                      <span>4 of 6 weekly flows complete</span>
                      <span className="text-ink font-semibold">
                        ~2 left to reach ±6% clarity
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* 3. EXPANDABLE DETAILS ACCORDION: Trajectory, Heatmap, Goals & Persona Switcher */}
            <details
              data-technical-drawer
              className="group rounded-2xl border-2 border-border-strong bg-surface p-6 shadow-doodle transition-all mt-6"
            >
              <summary className="focus-ring cursor-pointer flex items-center justify-between font-display text-base font-bold text-ink select-none hover:text-brand transition-colors">
                <span className="flex items-center gap-2">
                  <span className="transition-transform group-open:rotate-90 inline-block text-ink-muted">
                    ▸
                  </span>
                  <span>
                    Explore How This Is Calculated (Trajectory, Heatmap, Telemetry —{' '}
                    {activeDimensions.length} Dimensions)
                  </span>
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
                        className={`focus-ring min-h-10 px-3 py-1 rounded-pill border-2 border-border-strong text-xs font-bold cursor-pointer transition-colors shadow-doodle-sm ${viewState === tab.id
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
                          <div
                            className="h-full bg-brand rounded-pill"
                            style={{ width: '88%' }}
                          />
                        </div>

                        <div className="flex justify-between text-xs font-mono pt-1">
                          <span className="text-ink-muted">
                            Adaptation Feedback
                          </span>
                          <span className="font-bold text-ink">79 / 100</span>
                        </div>
                        <div className="w-full h-2 rounded-pill bg-surface-raised border border-border-strong overflow-hidden">
                          <div
                            className="h-full bg-success rounded-pill"
                            style={{ width: '79%' }}
                          />
                        </div>

                        <div className="flex justify-between text-xs font-mono pt-1">
                          <span className="text-ink-muted">Cognitive Synergy</span>
                          <span className="font-bold text-ink">84 / 100</span>
                        </div>
                        <div className="w-full h-2 rounded-pill bg-surface-raised border border-border-strong overflow-hidden">
                          <div
                            className="h-full bg-reward rounded-pill"
                            style={{ width: '84%' }}
                          />
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
