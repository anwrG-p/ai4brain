import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mascot } from '../components/features/brand/Mascot'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'
import { getDimensionsByPreset } from '../config/dimensions'
import type { DimensionConfig, WhyThisTrail } from '../types'
import { buildEstimatesForDimensions } from '../services/mocks/fixtures'
import { type PersonaId, useAppStore } from '../state/useAppStore'

type PlanPreviewState =
  | 'active-plan'
  | 'rest-pacing-engaged'
  | 'loading'
  | 'empty'
  | 'error'
  | 'extreme-text'

type DayKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

interface DayPlan {
  dayKey: DayKey
  dayName: string
  status: 'target' | 'maintenance' | 'rest'
  circadianWindow: string
  focusLabel: string
  targetDimCodes: string[]
}

interface PrescribedBlock {
  id: string
  dimension: DimensionConfig
  taskName: string
  staircaseLevel: number
  durationSeconds: number
  circadianSlot: string
  informationGainDeltaC: string
  rationale: string
}

const PERSONA_OPTIONS: { id: PersonaId; label: string }[] = [
  { id: 'steady-improver', label: 'Youssef (Balanced)' },
  { id: 'new-user', label: 'Salma (First Session)' },
  { id: 'noisy-low-confidence', label: 'Rami (High Fatigue)' },
  { id: 'edge-missing-dim', label: 'Partial (Missing Dim)' },
  { id: 'edge-10-dimensions', label: '10-Dim Stress' },
]

const DAYS_SCHEDULE: readonly DayPlan[] = [
  {
    dayKey: 'Mon',
    dayName: 'Monday',
    status: 'target',
    circadianWindow: 'Morning Peak (09:00–11:00)',
    focusLabel: 'Epistemic Calibration & Working Memory',
    targetDimCodes: ['WM', 'EP'],
  },
  {
    dayKey: 'Tue',
    dayName: 'Tuesday',
    status: 'maintenance',
    circadianWindow: 'Mid-Morning (10:00–11:30)',
    focusLabel: 'Inhibition & Conflict Suppression',
    targetDimCodes: ['IC', 'CF'],
  },
  {
    dayKey: 'Wed',
    dayName: 'Wednesday',
    status: 'rest',
    circadianWindow: 'Recovery Window · Screen-Free',
    focusLabel: 'Proactive Neural Consolidation',
    targetDimCodes: [],
  },
  {
    dayKey: 'Thu',
    dayName: 'Thursday',
    status: 'target',
    circadianWindow: 'Morning Peak (09:30–11:30)',
    focusLabel: 'Working Memory Load & Attention',
    targetDimCodes: ['WM', 'AN'],
  },
  {
    dayKey: 'Fri',
    dayName: 'Friday',
    status: 'target',
    circadianWindow: 'Morning (09:00–10:30)',
    focusLabel: 'Relational Planning & Perceptual Speed',
    targetDimCodes: ['PS', 'VP'],
  },
  {
    dayKey: 'Sat',
    dayName: 'Saturday',
    status: 'rest',
    circadianWindow: 'Active Rest & Circadian Reset',
    focusLabel: 'Proactive Recovery & Sleep Protection',
    targetDimCodes: [],
  },
  {
    dayKey: 'Sun',
    dayName: 'Sunday',
    status: 'maintenance',
    circadianWindow: 'Late Morning (11:00–12:00)',
    focusLabel: 'Light Weekly Hysteresis Check',
    targetDimCodes: ['WM'],
  },
]

const STAIRCASE_LEVEL_SPECS: Record<
  number,
  {
    title: string
    difficultyLabel: string
    targetAccuracy: string
    jitterTolerance: string
    parameterScaling: string
  }
> = {
  1: {
    title: 'Level 1 · Baseline Anchor',
    difficultyLabel: 'Low Load / Broad Windows',
    targetAccuracy: '75%–80%',
    jitterTolerance: '< 160 ms',
    parameterScaling: '2-Back stimuli, 1200 ms presentation, zero lures.',
  },
  2: {
    title: 'Level 2 · Early Calibration',
    difficultyLabel: 'Moderate Load / Standard Windows',
    targetAccuracy: '80%–85%',
    jitterTolerance: '< 140 ms',
    parameterScaling: '2-Back stimuli, 950 ms presentation, 15% orthogonal lures.',
  },
  3: {
    title: 'Level 3 · Maintenance Equilibrium',
    difficultyLabel: 'Standard Load / Balanced Stress',
    targetAccuracy: '82%–88%',
    jitterTolerance: '< 120 ms',
    parameterScaling: '3-Back switch trials, 800 ms presentation, 25% similar lures.',
  },
  4: {
    title: 'Level 4 · Focused Overload',
    difficultyLabel: 'High Load / Fast Set-Shifting',
    targetAccuracy: '85%–90%',
    jitterTolerance: '< 100 ms',
    parameterScaling: '3-Back spatial+symbol, 650 ms presentation, 35% high-salience lures.',
  },
  5: {
    title: 'Level 5 · Peak Attentional Stretch',
    difficultyLabel: 'Extreme Load / Rapid Conflict',
    targetAccuracy: '88%–94%',
    jitterTolerance: '< 80 ms',
    parameterScaling: 'Dual-stream 3-Back, 500 ms presentation, 45% fine-grained lures.',
  },
}

export function PlanPage() {
  const dimensionPreset = useAppStore((s) => s.dimensionPreset)
  const setDimensionPreset = useAppStore((s) => s.setDimensionPreset)
  const activePersona = useAppStore((s) => s.activePersona)
  const setActivePersona = useAppStore((s) => s.setActivePersona)
  const simulateLlmDown = useAppStore((s) => s.simulateLlmDown)
  const setSimulateLlmDown = useAppStore((s) => s.setSimulateLlmDown)
  const showMascot = useAppStore((s) => s.showMascot)

  const activeDimensions = useMemo(
    () => getDimensionsByPreset(dimensionPreset),
    [dimensionPreset],
  )

  const [previewState, setPreviewState] =
    useState<PlanPreviewState>('active-plan')
  const [selectedDayKey, setSelectedDayKey] = useState<DayKey>('Thu')
  const [simulatorLevel, setSimulatorLevel] = useState<number>(4)
  const [showDeltaCTable, setShowDeltaCTable] = useState<boolean>(false)

  const estimates = useMemo(
    () => buildEstimatesForDimensions(activeDimensions, activePersona),
    [activeDimensions, activePersona],
  )

  const selectedDay = useMemo(
    () => DAYS_SCHEDULE.find((d) => d.dayKey === selectedDayKey) ?? DAYS_SCHEDULE[3]!,
    [selectedDayKey],
  )

  // Map active day to prescribed micro-blocks based on registered dimensions
  const dailyBlocks = useMemo<PrescribedBlock[]>(() => {
    if (selectedDay.status === 'rest') return []

    const blocks: PrescribedBlock[] = []
    const dimA =
      activeDimensions.find((d) => selectedDay.targetDimCodes.includes(d.code)) ??
      activeDimensions[0]!
    const dimB =
      activeDimensions.find(
        (d) => d.id !== dimA.id && selectedDay.targetDimCodes.includes(d.code),
      ) ??
      activeDimensions[1] ??
      activeDimensions[0]!

    blocks.push({
      id: `block-${selectedDay.dayKey}-1`,
      dimension: dimA,
      taskName: dimA.taskName,
      staircaseLevel: previewState === 'rest-pacing-engaged' ? 2 : 4,
      durationSeconds: 90,
      circadianSlot: 'Morning Peak (09:30)',
      informationGainDeltaC: '+14.2% Information Gain',
      rationale:
        'Narrowing 95% Bayesian credible interval and stabilizing latency variance during optimal circadian alertness.',
    })

    if (dimB && dimB.id !== dimA.id) {
      blocks.push({
        id: `block-${selectedDay.dayKey}-2`,
        dimension: dimB,
        taskName: dimB.taskName,
        staircaseLevel: previewState === 'rest-pacing-engaged' ? 2 : 3,
        durationSeconds: 90,
        circadianSlot: 'Mid-Morning Maintenance (11:00)',
        informationGainDeltaC: '+9.4% Information Gain',
        rationale:
          'Reinforcing task set-switching and preventing rule carryover fatigue.',
      })
    }

    return blocks
  }, [selectedDay, activeDimensions, previewState])

  // Derive SAT-JEPA delta_c allocation table across active dimensions
  const deltaCAllocations = useMemo(() => {
    return activeDimensions.map((dim) => {
      const est = estimates.find((e) => e.dimensionId === dim.id)
      const conf = Math.round((est?.confidence ?? 0.8) * 100)
      const isHatched = conf < 60
      const priorityWeight = isHatched ? 'High (Calibration Priority)' : 'Standard (Maintenance)'
      const deltaCNeed = isHatched ? '+16.4%' : `+${(4 + (dim.slotIndex % 5) * 1.5).toFixed(1)}%`
      const suggestedWeeklyBlocks = isHatched ? 3 : dim.slotIndex <= 3 ? 2 : 1
      const suggestedLevel = isHatched ? 2 : 3 + (dim.slotIndex % 2)

      return {
        dim,
        scorePct: est?.scorePct ?? 74,
        confidencePct: conf,
        isHatched,
        priorityWeight,
        deltaCNeed,
        suggestedWeeklyBlocks,
        suggestedLevel,
      }
    })
  }, [activeDimensions, estimates])

  const whyThisTrail = useMemo<WhyThisTrail>(
    () => ({
      id: 'why-plan-adaptive-curriculum',
      observedData: [
        `Weekly schedule derives from ${activeDimensions.length} active cognitive dimensions and your 14-session historical trajectory.`,
        'Fatigue heatmap identifies your optimal alertness peak between 09:00 and 11:30 on weekdays.',
        'Episodic Pattern Separation shows preliminary confidence (48%, ±16% CI) requiring prioritized calibration micro-blocks.',
      ],
      inference:
        'SAT-JEPA differential vector (Δc) allocates 4 weekly micro-blocks to high-entropy axes and schedules 2 proactive recovery days (Wed/Sat) to prevent fatigue jitter accumulation.',
      recommendation:
        'Complete today’s 90-second morning block at Staircase Level 4. If hesitation jitter exceeds 110 ms, the system auto-engages Rest-First Pacing without penalizing your streak.',
      confidence: 0.88,
      sourceModule: simulateLlmDown
        ? 'deterministic_fallback'
        : 'sat_jepa_delta_c',
      counterfactual:
        'If your sleep debt rises above 90 minutes or response-time variance doubles, Wednesday will convert to a full screen-free recovery protocol.',
    }),
    [activeDimensions.length, simulateLlmDown],
  )

  return (
    <div className="space-y-6">
      {/* HEADER & META CONTROL BAR */}
      <Card
        as="section"
        aria-labelledby="plan-heading"
        className="p-6 space-y-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand" glyph="★">
                Layer B Adaptive Curriculum
              </Badge>
              <Badge
                tone={previewState === 'rest-pacing-engaged' ? 'warning' : 'success'}
                glyph={previewState === 'rest-pacing-engaged' ? '☾' : '●'}
              >
                {previewState === 'rest-pacing-engaged'
                  ? 'Rest-First Pacing Engaged (Fatigue Guard Active)'
                  : 'Active Plan · Week 07'}
              </Badge>
              <Badge tone="info" glyph="◈">
                SAT-JEPA Δc Derivation
              </Badge>
            </div>

            <h1
              id="plan-heading"
              className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink"
            >
              Adaptive Training Plan &amp; Staircase Curriculum
            </h1>
            <DoodleSquiggle className="max-w-xs mt-1" />

            <p className="text-base text-ink-muted">
              Personalized, non-clinical training schedule calibrated to your
              SAT-JEPA profile vectors and natural focus rhythms. Every block is
              a focused 90-second calibration trial with proactive rest.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/task/working_memory"
              className="tactile-btn bg-brand text-brand-ink px-4 py-2.5 text-sm font-semibold no-underline inline-flex items-center"
            >
              Launch Today&apos;s Focus Block (90s) →
            </Link>
            <Link
              to="/coach"
              className="tactile-btn bg-surface text-ink hover:bg-surface-raised px-3.5 py-2.5 text-sm font-semibold no-underline inline-flex items-center"
            >
              Ask AI Coach →
            </Link>
          </div>
        </div>

        {/* Profile & Preview State Switcher Toolbar */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Profile selector"
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="font-mono-tabular text-xs font-semibold uppercase text-ink-muted me-1">
              Learner Profile:
            </span>
            {PERSONA_OPTIONS.map((p) => {
              const isSelected = activePersona === p.id
              return (
                <Button
                  key={p.id}
                  size="sm"
                  variant={isSelected ? 'primary' : 'secondary'}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setActivePersona(p.id)
                    if (p.id === 'edge-10-dimensions') {
                      setDimensionPreset('10')
                    }
                  }}
                >
                  {p.label}
                </Button>
              )
            })}
          </div>

          <div
            role="group"
            aria-label="Plan preview state switcher"
            className="flex flex-wrap items-center gap-1.5"
          >
            {(
              [
                { id: 'active-plan', label: '1 · Active Plan' },
                { id: 'rest-pacing-engaged', label: '2 · ☾ Rest-First Pacing' },
                { id: 'loading', label: 'Loading' },
                { id: 'empty', label: 'Empty' },
                { id: 'error', label: 'Error' },
                { id: 'extreme-text', label: 'Extreme' },
              ] as const
            ).map((st) => (
              <Button
                key={st.id}
                size="sm"
                variant={previewState === st.id ? 'reward' : 'secondary'}
                aria-pressed={previewState === st.id}
                onClick={() => {
                  setPreviewState(st.id)
                  if (st.id === 'rest-pacing-engaged') {
                    setSelectedDayKey('Wed')
                    setSimulateLlmDown(false)
                  } else if (st.id === 'active-plan') {
                    setSelectedDayKey('Thu')
                  }
                }}
              >
                {st.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* COMPANION STATUS CARD */}
      {showMascot && (
        <Mascot
          state={
            previewState === 'rest-pacing-engaged' || selectedDay.status === 'rest'
              ? 'rest'
              : 'thinking'
          }
          size="md"
          title={
            previewState === 'rest-pacing-engaged' || selectedDay.status === 'rest'
              ? 'Synapse Companion · Proactive Rest & Recovery Engaged'
              : 'Synapse Companion · Adaptive Curriculum Calibrated'
          }
          badgeLabel={`Week 07 · Target Focus: ${selectedDay.focusLabel}`}
          message={
            previewState === 'rest-pacing-engaged' || selectedDay.status === 'rest'
              ? '“Rest days consolidate synaptic adaptations. Proactive pauses protect your confidence bands from measurement fatigue.”'
              : '“Your morning peak window is open. Completing one 90-second micro-block today stabilizes your Working Memory hysteresis.”'
          }
        />
      )}

      {/* STATE: LOADING SKELETON */}
      {previewState === 'loading' && (
        <Card
          role="status"
          aria-label="Synthesizing weekly adaptive curriculum"
          className="p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold text-ink">
              Computing SAT-JEPA Differential Vectors (Δc) &amp; Circadian
              Matching…
            </span>
            <Badge tone="info" glyph="◌">
              Synthesizing Plan
            </Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 h-72 rounded-md border-2 border-border bg-surface-raised" />
            <div className="lg:col-span-5 h-72 rounded-md border-2 border-border bg-surface-raised" />
          </div>
        </Card>
      )}

      {/* STATE: EMPTY COLD-START */}
      {previewState === 'empty' && (
        <Card className="p-6 space-y-4">
          <Badge tone="info" glyph="◌">
            Cold-Start Profile · No Baseline Telemetry
          </Badge>
          <h2 className="font-display text-2xl font-bold text-ink">
            Generate Your First Adaptive Training Schedule
          </h2>
          <p className="text-sm text-ink-muted max-w-2xl">
            Complete a 2-minute baseline intake assessment to let SynapseTwin
            derive your personalized weekly micro-block schedule.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/onboarding"
              className="tactile-btn bg-brand text-brand-ink px-4 py-2.5 text-sm font-semibold no-underline"
            >
              Start 2-Minute Intake →
            </Link>
            <Button
              variant="secondary"
              onClick={() => setPreviewState('active-plan')}
            >
              Restore Seeded Week 07 Curriculum
            </Button>
          </div>
        </Card>
      )}

      {/* STATE: ERROR RECOVERY */}
      {previewState === 'error' && (
        <Card
          role="alert"
          className="p-6 border-2 border-danger bg-danger-subtle space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-ink">
              ✕ Remote Curriculum Optimization Offline
            </h2>
            <Badge tone="info" glyph="⚙">
              Switched to Deterministic Rule-Engine Schedule
            </Badge>
          </div>
          <p className="text-sm text-ink">
            SynapseTwin failed over to the deterministic SAT-JEPA rule engine.
            Your weekly schedule, staircase parameters, and rest days are 100%
            available offline.
          </p>
          <Button
            variant="primary"
            onClick={() => setPreviewState('active-plan')}
          >
            Continue with Deterministic Curriculum →
          </Button>
        </Card>
      )}

      {/* STATE: EXTREME-TEXT STRESS TEST */}
      {previewState === 'extreme-text' && (
        <Card className="p-6 space-y-2 min-w-0">
          <Badge tone="info" glyph="◈">
            Multi-Clause Curriculum &amp; 10-Dimension Staircase Stress Test
          </Badge>
          <h2 className="font-display text-xl font-bold text-ink break-words">
            Orthogonal Lure Discrimination &amp; High-Salience Set-Shifting
            Curriculum Under Circadian Drift Calibration
          </h2>
          <p className="font-mono-tabular text-xs font-bold text-ink break-words">
            Optimization ID: OPT-SAT-JEPA-WEEK07 · Δc Allocation Balance: 100% ·
            Rest-First Guard: Active (Wed/Sat)
          </p>
        </Card>
      )}

      {/* MAIN 7:5 GRID */}
      {(previewState === 'active-plan' ||
        previewState === 'rest-pacing-engaged' ||
        previewState === 'extreme-text') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT 7 COLUMNS: Weekly Ribbon & Prescribed Daily Micro-Blocks */}
          <div className="lg:col-span-7 min-w-0 flex flex-col justify-between gap-6">
            {/* Card L1: 7-Day Weekly Ribbon Selector */}
            <Card
              as="section"
              aria-labelledby="weekly-ribbon-heading"
              className="p-5 space-y-4 min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2
                    id="weekly-ribbon-heading"
                    className="font-display text-lg font-bold text-ink"
                  >
                    Weekly Schedule Matrix (Week 07)
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Click any day to inspect its prescribed micro-blocks or
                    recovery plan.
                  </p>
                </div>
                <Badge tone="brand" glyph="●">
                  Circadian Matched
                </Badge>
              </div>

              {/* 7-Day Pill Ribbon */}
              <div
                role="group"
                aria-label="Weekly training schedule day selector"
                className="grid grid-cols-2 sm:grid-cols-7 gap-2"
              >
                {DAYS_SCHEDULE.map((day) => {
                  const isSelected = day.dayKey === selectedDayKey
                  const isRest = day.status === 'rest'
                  const isTarget = day.status === 'target'

                  return (
                    <button
                      key={day.dayKey}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedDayKey(day.dayKey)}
                      className={`focus-ring min-h-14 p-2 rounded-md border-2 text-start flex flex-col justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-border-strong bg-brand-subtle'
                          : isRest
                            ? 'border-border bg-surface-raised hover:bg-canvas'
                            : 'border-border bg-canvas hover:bg-surface-raised'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-display text-xs font-bold text-ink">
                          {day.dayKey}
                        </span>
                        <span
                          aria-hidden="true"
                          className="font-mono-tabular text-xs font-semibold"
                        >
                          {isRest ? '☾' : isTarget ? '●' : '◐'}
                        </span>
                      </div>
                      <span className="text-xs font-mono-tabular text-ink-muted truncate w-full">
                        {isRest ? 'Rest' : day.targetDimCodes.join('+')}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Day Summary Bar */}
              <div className="rounded-sm border border-border bg-canvas p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <strong className="text-ink">
                    {selectedDay.dayName} Focus:
                  </strong>{' '}
                  <span className="text-ink-muted">
                    {selectedDay.focusLabel}
                  </span>
                </div>
                <div className="font-mono-tabular text-ink font-semibold">
                  Window: {selectedDay.circadianWindow}
                </div>
              </div>
            </Card>

            {/* Card L2: Prescribed Daily Exercises OR Proactive Recovery Card */}
            <Card
              as="section"
              aria-labelledby="daily-prescriptions-heading"
              className="p-5 space-y-4 min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h2
                    id="daily-prescriptions-heading"
                    className="font-display text-lg font-bold text-ink"
                  >
                    {selectedDay.dayName} Prescriptions
                  </h2>
                  <p className="text-xs text-ink-muted">
                    {selectedDay.status === 'rest'
                      ? 'Proactive screen-free rest day — Zero-guilt recovery.'
                      : `2 adaptive micro-blocks (${dailyBlocks.reduce(
                          (acc, b) => acc + b.durationSeconds,
                          0,
                        )}s total duration).`}
                  </p>
                </div>
                <Badge
                  tone={selectedDay.status === 'rest' ? 'warning' : 'success'}
                  glyph={selectedDay.status === 'rest' ? '☾' : '✓'}
                >
                  {selectedDay.status === 'rest'
                    ? 'Proactive Recovery'
                    : 'Target Calibration Active'}
                </Badge>
              </div>

              {/* Rest Day Card View */}
              {selectedDay.status === 'rest' ? (
                <div className="rounded-md border-2 border-border-strong bg-warning-subtle p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-ink">
                      ☾ Scheduled Recovery &amp; Memory Consolidation Day
                    </h3>
                    <Badge tone="warning" glyph="✓">
                      Streak Protected (Zero Penalty)
                    </Badge>
                  </div>
                  <p className="text-sm text-ink leading-relaxed">
                    SynapseTwin protects your measurement accuracy by preventing
                    fatigue contamination. Resting today allows recent task
                    strategies to consolidate without motor fatigue or
                    hesitation jitter.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                    <div className="rounded-sm border border-border bg-canvas p-2.5">
                      <strong className="text-ink block">
                        Screen-Free Recovery
                      </strong>
                      <span className="text-ink-muted">
                        Eyes-off-screen break protects perceptual speed.
                      </span>
                    </div>
                    <div className="rounded-sm border border-border bg-canvas p-2.5">
                      <strong className="text-ink block">Sleep Hygiene</strong>
                      <span className="text-ink-muted">
                        Adequate REM sleep restores Working Memory anchors.
                      </span>
                    </div>
                    <div className="rounded-sm border border-border bg-canvas p-2.5">
                      <strong className="text-ink block">
                        Zero Broken Streaks
                      </strong>
                      <span className="text-ink-muted">
                        Planned rest is celebrated, never penalized.
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 flex flex-wrap items-center gap-2.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedDayKey('Thu')}
                    >
                      View Thursday&apos;s Training Blocks →
                    </Button>
                    <Link
                      to="/coach"
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Ask Coach About Rest Pacing →
                    </Link>
                  </div>
                </div>
              ) : (
                /* Active Exercise Cards */
                <div className="space-y-3.5">
                  {dailyBlocks.map((block, idx) => (
                    <div
                      key={block.id}
                      className="rounded-md border-2 border-border bg-canvas p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="brand" glyph={block.dimension.markerGlyph}>
                              {block.dimension.code} · {block.dimension.name}
                            </Badge>
                            <Badge tone="info" glyph="◈">
                              Staircase Level {block.staircaseLevel}
                            </Badge>
                            <span className="font-mono-tabular text-xs font-bold text-ink">
                              Duration: {block.durationSeconds}s
                            </span>
                          </div>
                          <h3 className="font-display text-base font-bold text-ink">
                            Block 0{idx + 1}: {block.taskName}
                          </h3>
                        </div>

                        <Badge tone="success" glyph="↑">
                          {block.informationGainDeltaC}
                        </Badge>
                      </div>

                      <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                        {block.rationale}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                        <span className="font-mono-tabular text-xs text-ink-muted">
                          Recommended Window: {block.circadianSlot}
                        </span>

                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/task/${block.dimension.id}`}
                            className="tactile-btn bg-brand text-brand-ink px-3.5 py-2 text-xs font-semibold no-underline inline-flex items-center"
                          >
                            Launch {block.dimension.code} Block →
                          </Link>
                          <Link
                            to={`/dimensions/${block.dimension.id}`}
                            className="tactile-btn bg-surface text-ink hover:bg-surface-raised px-3 py-2 text-xs font-semibold no-underline inline-flex items-center"
                          >
                            Inspect Dimension →
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT 5 COLUMNS: SAT-JEPA Delta-c Allocation + Staircase Simulator + WhyThis */}
          <div className="lg:col-span-5 min-w-0 flex flex-col justify-between gap-6">
            {/* Card R1: SAT-JEPA Delta-c Allocation Matrix */}
            <Card
              as="section"
              aria-labelledby="delta-c-allocation-heading"
              className="p-5 space-y-3.5 min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2
                    id="delta-c-allocation-heading"
                    className="font-display text-base font-bold text-ink"
                  >
                    SAT-JEPA Δc Allocation Matrix ({activeDimensions.length} Axes)
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Session volume allocated to highest information-gain axes.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-pressed={showDeltaCTable}
                  onClick={() => setShowDeltaCTable((prev) => !prev)}
                >
                  {showDeltaCTable ? 'Compact View' : 'Table View'}
                </Button>
              </div>

              <div
                tabIndex={0}
                role="region"
                aria-label="SAT-JEPA delta c allocation table scrollable container"
                className="focus-ring overflow-x-auto max-h-64"
              >
                <table
                  aria-label="SAT-JEPA delta-c weekly allocation breakdown"
                  className="w-full text-start border-collapse text-xs font-mono-tabular"
                >
                  <thead>
                    <tr className="border-b-2 border-border-strong text-ink-muted uppercase">
                      <th scope="col" className="py-2 pe-2 text-start">
                        Dimension
                      </th>
                      <th scope="col" className="py-2 px-2 text-start">
                        Δc Need
                      </th>
                      <th scope="col" className="py-2 px-2 text-start">
                        Level
                      </th>
                      <th scope="col" className="py-2 ps-2 text-start">
                        Weekly Blocks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-border">
                    {deltaCAllocations.map((row) => (
                      <tr key={row.dim.id}>
                        <th
                          scope="row"
                          className="py-2 pe-2 font-bold text-ink text-start"
                        >
                          <span aria-hidden="true" className="me-1">
                            {row.dim.markerGlyph}
                          </span>
                          {row.dim.code}
                          {row.isHatched && (
                            <span className="ms-1 text-warning font-normal">
                              ⚡
                            </span>
                          )}
                        </th>
                        <td className="py-2 px-2 text-ink">
                          {row.deltaCNeed}
                        </td>
                        <td className="py-2 px-2 text-ink">
                          Lvl {row.suggestedLevel}
                        </td>
                        <td className="py-2 ps-2">
                          <Badge
                            tone={row.isHatched ? 'warning' : 'brand'}
                            glyph={row.isHatched ? '⚡' : '●'}
                          >
                            {row.suggestedWeeklyBlocks} Blocks/Wk
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Card R2: Interactive Difficulty Staircase Simulator */}
            <Card
              as="section"
              aria-labelledby="staircase-simulator-heading"
              className="p-5 space-y-3 min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2
                    id="staircase-simulator-heading"
                    className="font-display text-base font-bold text-ink"
                  >
                    Adaptive Difficulty Staircase Simulator
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Auto-steps to maintain the optimal 85% challenge threshold.
                  </p>
                </div>
                <Badge tone="info" glyph="⚙">
                  QUEST+ Staircase
                </Badge>
              </div>

              {/* 1..5 Staircase Stepper */}
              <div
                role="group"
                aria-label="Select staircase difficulty level"
                className="flex flex-wrap items-center gap-1.5"
              >
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <Button
                    key={lvl}
                    size="sm"
                    variant={simulatorLevel === lvl ? 'primary' : 'secondary'}
                    aria-pressed={simulatorLevel === lvl}
                    onClick={() => setSimulatorLevel(lvl)}
                  >
                    Lvl {lvl}
                  </Button>
                ))}
              </div>

              {/* Dynamic Level Spec Card */}
              <div className="rounded-md border-2 border-border-strong bg-canvas p-3.5 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display font-bold text-ink">
                    {STAIRCASE_LEVEL_SPECS[simulatorLevel]?.title}
                  </span>
                  <Badge tone="brand" glyph="●">
                    {STAIRCASE_LEVEL_SPECS[simulatorLevel]?.difficultyLabel}
                  </Badge>
                </div>
                <p className="text-ink font-medium">
                  {STAIRCASE_LEVEL_SPECS[simulatorLevel]?.parameterScaling}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono-tabular text-ink-muted">
                  <div>
                    Target Acc:{' '}
                    <span className="text-ink font-bold">
                      {STAIRCASE_LEVEL_SPECS[simulatorLevel]?.targetAccuracy}
                    </span>
                  </div>
                  <div>
                    Jitter Cap:{' '}
                    <span className="text-ink font-bold">
                      {STAIRCASE_LEVEL_SPECS[simulatorLevel]?.jitterTolerance}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Card R3: Embedded Signature #3 <WhyThisPanel /> */}
            <WhyThisPanel
              trail={whyThisTrail}
              title="5-Part Reasoning Trail · Curriculum Synthesis"
              defaultExpanded
            />
          </div>
        </div>
      )}
    </div>
  )
}
export default PlanPage
