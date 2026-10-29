import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDimensionsByPreset } from '../config/dimensions'
import { buildEstimatesForDimensions } from '../services/mocks/fixtures'
import { useAppStore, type PersonaId } from '../state/useAppStore'
import { UncertaintyRadar } from '../components/features/radar/UncertaintyRadar'
import { BrianMascot } from '../components/features/brand/BrianMascot'
import teacherBrianImg from '../assets/mascot/Teacher-Brian.png'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { SlideDeck, Slide } from '../components/layout/SlideDeck'
import { useEmilyStore } from '../state/useEmilyStore'

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

  const nextStepLink = useMemo(() => {
    if (viewState === 'empty') return '/onboarding'
    return '/task/episodic_pattern_separation'
  }, [viewState])

  // =========================================================================
  // 🏫 1. ENTIRE CLASSROOM BLOCK (PODIUM / BRIAN / BOARD TOGETHER) POSITION
  // Move Teacher Brian, the Classroom Board, and the Wooden Podium ALL TOGETHER:
  // - blockMoveDown: positive number moves DOWN (in px), negative moves UP (e.g. 0, 40, 80, 120, 200)
  // - blockMoveX: positive moves RIGHT (in px), negative moves LEFT (in px) (e.g. -50, 0, 50)
  // =========================================================================
  const blockMoveDown: number = 50 // Change this number to move the ENTIRE block (Podium/Brian/Board) UP or DOWN (in px)
  const blockMoveX: number = 0 // Change this number to move the ENTIRE block (Podium/Brian/Board) LEFT or RIGHT (in px)

  const stageStyle: React.CSSProperties = {
    marginTop: `${blockMoveDown}px`,
    transform: blockMoveX !== 0 ? `translateX(${blockMoveX}px)` : undefined,
  }

  // =========================================================================
  // 🧑‍🏫 2. TEACHER BRIAN MASCOT (INDIVIDUAL POSITION & SCALE)
  // Adjust Brian individually relative to the stage:
  // - teacherBrianScale: scale multiplier (default 3.1)
  // - teacherBrianMoveX: horizontal offset (in px, positive = right, negative = left)
  // - teacherBrianMoveY: vertical offset (in px, positive = down, negative = up)
  // =========================================================================
  const teacherBrianScale = 3.1
  const teacherBrianMoveX = 0
  const teacherBrianMoveY = 200

  const teacherBrianStyle: React.CSSProperties = {
    transform: `translate(${teacherBrianMoveX}px, ${teacherBrianMoveY}px) scale(${teacherBrianScale})`,
    transformOrigin: 'bottom center',
    zIndex: 20,
    position: 'relative',
  }

  // =========================================================================
  // 🪵 3. BRIAN'S WOODEN PODIUM (INDIVIDUAL POSITION & SIZE)
  // Adjust the wooden stage platform individually:
  // - podiumWithoutPadding: true extends edge-to-edge across horizontal distance without padding
  // - podiumWidth: custom width (e.g. 'calc(100% + 2rem)' or '100%' or '400px')
  // - podiumMoveY: vertical position (in px, 146px directly meets Brian's feet)
  // - podiumMoveX: horizontal position (in px, positive = right, negative = left)
  // - podiumScale: scale multiplier (e.g. 1.0, 1.1)
  // =========================================================================
  const podiumWithoutPadding: boolean = true // Set to true to span horizontal distance without container padding
  const podiumWidth: string = podiumWithoutPadding ? 'calc(100% + 2rem)' : '100%'
  const podiumMoveY: number = 146 // Change this number to move the podium up/down (in px)
  const podiumMoveX: number = 0 // Change this number to move the podium left/right (in px)
  const podiumScale: number = 1.0

  const podiumStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: podiumWithoutPadding ? '-1rem' : '0px',
    width: podiumWidth,
    transform: `translate(${podiumMoveX}px, ${podiumMoveY}px) scale(${podiumScale})`,
    transformOrigin: 'top center',
    zIndex: 10,
  }

  // =========================================================================
  // 📐 4. CLASSROOM BOARD MANUAL DIMENSIONS (SCALE & SIZE CONTROLS)
  // Adjust the board's dimensions individually:
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

  // =========================================================================
  // 🧭 5. COGNITIVE RADAR GRAPH CONTROLS (SIZE, POSITION & CARD OFFSETS - SLIDE 2)
  // Adjust these values to customize the radar graph on its dedicated slide:
  // - radarSize: coordinate diameter (e.g. 550, 600, 660, 720)
  // - radarMoveDown: positive number moves DOWN on Slide 2 (in px), e.g. 0, 20, 40, 60
  // - radarMoveX: positive moves RIGHT (in px), negative moves LEFT (in px)
  // - cardOffsetFromCenter: distance from the radar center to the description card (in px)
  //     (e.g. 340 closer, 360 default, 400 wider, 450 farther)
  // - cardOffsetY: vertical adjustment for description card (in px, positive = down, negative = up)
  // =========================================================================
  const radarSize = 660
  const radarMoveDown: number = 0 // Change this number to move the radar DOWN on Slide 2 (in px)
  const radarMoveX: number = 0 // Change this number to move the radar horizontally (in px)
  const cardOffsetFromCenter: number = 380 // Change this number to move description card closer/farther from center (in px)
  const cardOffsetY: number = 0 // Change this number to shift description card vertically (in px)

  const radarStyle: React.CSSProperties = {
    marginTop: `${radarMoveDown}px`,
    transform: radarMoveX !== 0 ? `translateX(${radarMoveX}px)` : undefined,
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
          ANIMATED CLASSROOM LECTURE STAGE & SLIDE DECK
          Split into 3 distinct slides with scroll-triggered animations:
          - Slide 1: Classroom Lecture Stage (Teacher Brian, Board & Wooden Podium)
          - Slide 2: Cognitive Radar Graph (Interactive Skill Map & Dimension Card)
          - Slide 3: Core Balance Insights (3 Pillar Metrics & Weekly Goal)
          ========================================================================= */}
      {(viewState === 'calibrated' ||
        viewState === 'low-confidence' ||
        viewState === 'partial') && (
          <SlideDeck>
            {/* =========================================================================
                SLIDE 1: CLASSROOM LECTURE STAGE
                ========================================================================= */}
            <Slide
              id="dashboard-slide-stage"
              title="Classroom Board"
              shortLabel="Board"
              icon="🏫"
            >
              <div
                className="flex flex-col lg:flex-row items-stretch lg:items-end gap-6 relative"
                style={stageStyle}
              >
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
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed border-border-strong/30 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl" aria-hidden="true">
                              🔥
                            </span>
                            <h1
                              id="dashboard-hero-heading"
                              className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink"
                            >
                              Welcome back, {personaDisplayName}! You're on a streak
                            </h1>
                          </div>

                          {viewState === 'low-confidence' && (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-pill bg-brand-subtle border border-border-strong text-xs font-mono font-bold text-ink shadow-xs">
                                <span>🌱</span>
                                <span>Rest-First Pacing</span>
                              </span>
                              <span className="text-xs font-mono text-ink-muted">
                                Non-Clinical Cognitive Space
                              </span>
                            </div>
                          )}
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

                      {/* Middle Section: Start Today's 2-Min Flow Primary CTA */}
                      <div className="my-auto py-4 flex items-center justify-center">
                        <Link
                          to={nextStepLink}
                          className="tactile-btn py-3 px-8 rounded-xl bg-brand text-brand-ink font-display text-base sm:text-lg font-bold border-2 border-border-strong shadow-doodle hover:shadow-doodle-lg no-underline inline-flex items-center gap-2 text-center transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                        >
                          <span>Start Today's 2-Min Flow</span>
                          <span aria-hidden="true">→</span>
                        </Link>
                      </div>

                      {/* DAILY TIP (Chalk/Marker Footnote on Board) */}
                      <div className="mt-auto pt-4 border-t border-dashed border-border-strong/30 flex items-center gap-2 text-xs sm:text-sm text-ink">
                        <span className="text-brand text-base shrink-0" aria-hidden="true">
                          📖
                        </span>
                        <span>
                          <strong>Daily Tip:</strong> Sleep consolidation strengthens pattern separation without active practice. Enjoy your rest day!
                        </span>
                      </div>
                    </div>
                  </section>
                </div>

                {/* 3. WOODEN LECTURE STAGE PLATFORM (HORIZONTAL ACROSS FULL DISTANCE WITHOUT PADDING) */}
                <div
                  id="brian-wooden-podium"
                  data-testid="brian-wooden-podium"
                  className="wooden-podium"
                  style={podiumStyle}
                  aria-hidden="true"
                >
                  {/* Top Tier: Standing platform */}
                  <div className="podium-top-tier" />

                  {/* Middle Tier: Main wooden riser with timber grooving */}
                  <div className="podium-mid-tier">
                    <div className="podium-planks-overlay" />
                  </div>

                  {/* Base Tier: Sturdy wooden foundation plinth */}
                  <div className="podium-base-tier" />
                </div>
              </div>

              {/* Frustrated De-Escalation Banner if detected */}
              {currentEmotion === 'frustrated' && (
                <div
                  role="status"
                  className="mt-6 p-3 bg-surface-raised border-2 border-border-strong rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-doodle-sm text-start"
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
            </Slide>

            {/* =========================================================================
                SLIDE 2: COGNITIVE RADAR GRAPH (INTERACTIVE SKILL MAP)
                ========================================================================= */}
            <Slide
              id="dashboard-slide-radar"
              title="Cognitive Radar"
              shortLabel="Radar"
              icon="🧭"
            >
              <div
                className="w-full min-w-0 py-2 flex flex-col items-center justify-center"
                style={radarStyle}
              >
                <UncertaintyRadar
                  dimensions={activeDimensions}
                  estimates={estimates}
                  title=""
                  bare={true}
                  interactive={true}
                  showSubtitle={false}
                  showTableToggle={false}
                  size={radarSize}
                  cardOffsetFromCenter={cardOffsetFromCenter}
                  cardOffsetY={cardOffsetY}
                />
              </div>
            </Slide>

            {/* =========================================================================
                SLIDE 3: CORE BALANCE INSIGHTS & WEEKLY GOAL
                ========================================================================= */}
            <Slide
              id="dashboard-slide-insights"
              title="Balance Insights"
              shortLabel="Insights"
              icon="📊"
            >
              <div className="w-full min-w-0 max-w-5xl mx-auto space-y-4">
                <Card className="p-5 sm:p-6 space-y-4 border-2 border-border-strong shadow-doodle">
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
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

                {/* Guidance footnote at end of slides */}
                <div className="pt-2 text-center">
                  <span className="font-mono text-xs text-ink-muted">
                    ✦ You've reached the end of today's slide overview · Scroll down for privacy &amp; system details
                  </span>
                </div>
              </div>
            </Slide>
          </SlideDeck>
        )}
    </div>
  )
}
