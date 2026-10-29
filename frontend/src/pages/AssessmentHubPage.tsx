import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getDimensionsByPreset } from '../config/dimensions'
import {
  buildEstimatesForDimensions,
  SAMPLE_WHY_THIS_TRAIL,
} from '../services/mocks/fixtures'
import { useAppStore, type PersonaId } from '../state/useAppStore'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { Mascot } from '../components/features/brand/Mascot'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'

type HubViewState =
  | 'calibrated'
  | 'low-confidence'
  | 'partial'
  | 'empty'
  | 'loading'
  | 'error'
  | 'extreme-text'

type SessionMode = 'priority-2min' | 'sweep-5min' | 'sandbox-untimed'
type QueueFilter = 'all' | 'priority-hatched' | 'solid-calibrated'

export default function AssessmentHubPage() {
  const navigate = useNavigate()
  const {
    dimensionPreset,
    activePersona,
    setActivePersona,
    showMascot,
    simulateOffline,
    consentPreferences,
  } = useAppStore()

  const initialViewState: HubViewState =
    activePersona === 'new-user'
      ? 'empty'
      : activePersona === 'noisy-low-confidence'
        ? 'low-confidence'
        : activePersona === 'edge-missing-dim'
          ? 'partial'
          : 'calibrated'

  const [viewState, setViewState] = useState<HubViewState>(initialViewState)
  const [sessionMode, setSessionMode] = useState<SessionMode>('priority-2min')
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all')
  const [showAsTable, setShowAsTable] = useState(false)
  const [showNextTaskJson, setShowNextTaskJson] = useState(false)

  const activeDimensions = useMemo(
    () => getDimensionsByPreset(dimensionPreset),
    [dimensionPreset],
  )

  const effectivePersona: PersonaId = useMemo(() => {
    if (viewState === 'low-confidence') return 'noisy-low-confidence'
    if (viewState === 'partial') return 'edge-missing-dim'
    if (viewState === 'empty') return 'new-user'
    return 'steady-improver'
  }, [viewState])

  const estimates = useMemo(
    () => buildEstimatesForDimensions(activeDimensions, effectivePersona),
    [activeDimensions, effectivePersona],
  )

  // Compute staircase levels & priority ranking for each dimension
  const rankedModules = useMemo(() => {
    const items = activeDimensions.map((dim) => {
      const est = estimates.find((e) => e.dimensionId === dim.id)
      const isUnassessed = !est || est.scorePct === null
      const isHatched = Boolean(est?.isLowConfidence)
      const score = est?.scorePct ?? 50
      const ciHalfWidth = est
        ? Math.round((est.ciUpperPct - est.ciLowerPct) / 2)
        : 18
      const confidencePct = isUnassessed
        ? 0
        : Math.round((est?.confidence ?? 0.45) * 100)

      const currentLevel = isUnassessed
        ? 1
        : score >= 85
          ? 4
          : score >= 72
            ? 3
            : 2
      const nextTargetLevel = isHatched
        ? currentLevel
        : Math.min(5, currentLevel + 1)

      const priorityScore = isUnassessed
        ? 1000
        : isHatched
          ? 500 + (100 - confidencePct)
          : 100 - confidencePct

      return {
        dim,
        est,
        isUnassessed,
        isHatched,
        ciHalfWidth,
        confidencePct,
        currentLevel,
        nextTargetLevel,
        priorityScore,
        estimatedSeconds: sessionMode === 'sweep-5min' ? 45 : 90,
        trialCount: sessionMode === 'sweep-5min' ? 6 : 12,
      }
    })

    return items.sort((a, b) => b.priorityScore - a.priorityScore)
  }, [activeDimensions, estimates, sessionMode])

  const topPriorityModule = rankedModules[0] ?? {
    dim: activeDimensions[0]!,
    est: estimates[0],
    isUnassessed: false,
    isHatched: true,
    ciHalfWidth: 16,
    confidencePct: 48,
    currentLevel: 2,
    nextTargetLevel: 3,
    priorityScore: 552,
    estimatedSeconds: 90,
    trialCount: 12,
  }

  const filteredModules = useMemo(() => {
    return rankedModules.filter((m) => {
      if (queueFilter === 'priority-hatched') {
        return m.isUnassessed || m.isHatched
      }
      if (queueFilter === 'solid-calibrated') {
        return !m.isUnassessed && !m.isHatched
      }
      return true
    })
  }, [rankedModules, queueFilter])

  const nextTaskContractPayload = useMemo(
    () => ({
      endpoint: 'GET /v1/tasks/next',
      sessionMode,
      nonBiometricLock: true,
      tabBlurAutoPause: true,
      inputLatencyNormalizedMs: consentPreferences.inputLatencyMs ?? 138,
      priorityDimensionId: topPriorityModule.dim.id,
      backendDimensionKey: topPriorityModule.dim.backendDimensionKey,
      taskSchema: topPriorityModule.dim.schemaTypes[0] ?? 'n_back',
      staircaseConfig: {
        currentLevel: topPriorityModule.currentLevel,
        nextTargetLevel: topPriorityModule.nextTargetLevel,
        targetAccuracy: 0.85,
        trialsPlanned: topPriorityModule.trialCount,
        estimatedSeconds: topPriorityModule.estimatedSeconds,
      },
      selectionReason: topPriorityModule.isUnassessed
        ? 'unassessed_dimension_initialization'
        : topPriorityModule.isHatched
          ? 'low_confidence_hatched_band_narrowing'
          : 'sat_jepa_delta_c_progression',
    }),
    [sessionMode, consentPreferences.inputLatencyMs, topPriorityModule],
  )

  const handleSelectViewState = (next: HubViewState) => {
    setViewState(next)
    if (next === 'calibrated') setActivePersona('steady-improver')
    else if (next === 'low-confidence')
      setActivePersona('noisy-low-confidence')
    else if (next === 'partial') setActivePersona('edge-missing-dim')
    else if (next === 'empty') setActivePersona('new-user')
  }

  return (
    <div className="space-y-8 min-w-0">
      {/* 1. ASSESSMENT HUB HEADER + SESSION MODE + STATE SWITCHER */}
      <Card
        as="section"
        aria-labelledby="assessment-hub-heading"
        className="p-6 space-y-5 min-w-0"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="reward" glyph="★">
                Layer A · Adaptive Psychometric Assessment Hub
              </Badge>
              <Badge tone="brand" glyph="●">
                QUEST+ 85% Staircase
              </Badge>
              <Badge tone="info" glyph="✓">
                Mandatory Non-Biometric Mode
              </Badge>
            </div>
            <h1
              id="assessment-hub-heading"
              className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight"
            >
              Calibrate your cognitive twin—2-minute adaptive micro-tasks with
              zero biometric tracking.
            </h1>
            <DoodleSquiggle className="max-w-xs mt-1" />
            <p className="text-base text-ink-muted">
              Every micro-block uses Bayesian QUEST+ and 85%-accuracy staircase
              scheduling to narrow your 95% confidence intervals (
              <code className="font-mono-tabular">±CI</code>) in under 120
              seconds—recording only reaction timing, error-burst recovery, and
              hesitation jitter.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="lg"
              onClick={() =>
                navigate(`/task/${topPriorityModule.dim.id}`)
              }
            >
              ▶ Start #1 Priority Block ({topPriorityModule.dim.code}) →
            </Button>
            <Link
              to="/dashboard"
              className="tactile-btn bg-surface text-ink hover:bg-surface-raised px-4 py-2.5 text-sm font-semibold no-underline inline-flex items-center"
            >
              ← Command Dashboard
            </Link>
          </div>
        </div>

        {/* Session Mode Selector */}
        <div
          role="group"
          aria-label="Assessment session mode selector"
          className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2"
        >
          {(
            [
              {
                id: 'priority-2min',
                title: '1 · Priority Calibration Queue (2 Min)',
                badge: 'Recommended',
                desc: 'Targets your lowest-confidence hatched or unassessed dimension first (12 adaptive trials).',
              },
              {
                id: 'sweep-5min',
                title: `2 · Full 360° Twin Sweep (5 Min)`,
                badge: `${activeDimensions.length} Dims`,
                desc: `Runs 6 rapid staircase trials across all ${activeDimensions.length} configured cognitive dimensions.`,
              },
              {
                id: 'sandbox-untimed',
                title: '3 · Free Practice & Task Sandbox',
                badge: '8 Task Schemas',
                desc: 'Explore N-Back, Stroop, UFOV, MST, Matrix, Relational, Tower & Rotation without timer pressure.',
              },
            ] as const
          ).map((mode) => {
            const active = sessionMode === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSessionMode(mode.id)}
                className={`focus-ring text-start rounded-md border-2 p-3.5 transition-colors cursor-pointer space-y-1.5 ${
                  active
                    ? 'border-ink bg-brand-subtle'
                    : 'border-border bg-surface hover:bg-surface-raised'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <strong className="font-display text-sm font-bold text-ink">
                    {mode.title}
                  </strong>
                  <Badge
                    tone={active ? 'brand' : 'neutral'}
                    glyph={active ? '●' : '◌'}
                  >
                    {mode.badge}
                  </Badge>
                </div>
                <p className="text-xs text-ink-muted">{mode.desc}</p>
              </button>
            )
          })}
        </div>

        {/* Persona & Edge-State Switcher Bar */}
        <div
          role="group"
          aria-label="Assessment hub persona and state switcher"
          className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                {
                  id: 'calibrated',
                  label: 'Calibrated Queue (Youssef · 1 Hatched)',
                },
                {
                  id: 'low-confidence',
                  label: 'Hatched Priority Queue (Salma · 4 Hatched)',
                },
                { id: 'partial', label: 'Partial (1 Unassessed Dim #1)' },
                { id: 'empty', label: 'Fresh Baseline (Nour · 0 Trials)' },
                { id: 'loading', label: 'Loading Skeleton' },
                { id: 'error', label: 'Error Recovery' },
                { id: 'extreme-text', label: 'Extreme Values' },
              ] as const
            ).map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={viewState === item.id ? 'primary' : 'secondary'}
                aria-pressed={viewState === item.id}
                onClick={() => handleSelectViewState(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <span className="font-mono-tabular text-xs text-ink-muted">
            Active Registry: {activeDimensions.length} Dimensions · Mode:{' '}
            {sessionMode}
          </span>
        </div>
      </Card>

      {/* STATE: LOADING SKELETON */}
      {viewState === 'loading' && (
        <Card
          role="status"
          aria-label="Loading assessment task queue"
          className="p-6 space-y-6"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold text-ink">
              Computing Bayesian QUEST+ Next-Task Priors (`/v1/tasks/next`)…
            </span>
            <Badge tone="info" glyph="◌">
              Loading Queue
            </Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 h-64 rounded-md border-2 border-border bg-surface-raised p-5 flex flex-col justify-between">
              <div className="h-6 w-56 rounded-sm bg-canvas" />
              <div className="h-28 w-full rounded-sm bg-canvas" />
              <div className="h-8 w-44 rounded-sm bg-canvas" />
            </div>
            <div className="lg:col-span-5 h-64 rounded-md border-2 border-border bg-surface-raised p-5 flex flex-col justify-between">
              <div className="h-6 w-48 rounded-sm bg-canvas" />
              <div className="h-32 w-full rounded-sm bg-canvas" />
              <div className="h-4 w-36 rounded-sm bg-canvas" />
            </div>
          </div>
        </Card>
      )}

      {/* STATE: ERROR RECOVERY */}
      {viewState === 'error' && (
        <Card
          role="alert"
          className="p-6 border-2 border-danger bg-danger-subtle space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-ink">
              ✕ Task Scheduler Timeout (`GET /v1/tasks/next`)
            </h2>
            <Badge tone="danger" glyph="!">
              Local Staircase Fallback Ready
            </Badge>
          </div>
          <p className="text-sm text-ink">
            The remote task scheduler did not respond within 1,500 ms. Click
            below to activate the deterministic client-side QUEST+ queue with
            zero data loss.
          </p>
          <Button
            variant="primary"
            onClick={() => handleSelectViewState('calibrated')}
          >
            Activate Client-Side QUEST+ Queue
          </Button>
        </Card>
      )}

      {/* STATE: EXTREME VALUES STRESS TEST */}
      {viewState === 'extreme-text' && (
        <Card className="p-6 space-y-3 min-w-0">
          <Badge tone="info" glyph="◈">
            High-Magnitude Staircase &amp; Long-Label Stress Test
          </Badge>
          <h2 className="font-display text-xl font-bold text-ink break-words">
            Dual-Stream Spatial-Symbolic N-Back Under High Interference &amp;
            Multi-Hop Relational Matrix Induction
          </h2>
          <p className="font-mono-tabular text-2xl font-bold text-ink">
            Staircase Lvl 19 · 99.9% ± 0.1% · 142,850 Trials · Target RT: 215 ms
          </p>
        </Card>
      )}

      {/* MAIN ASSESSMENT HUB GRID (Calibrated, Low-Confidence, Partial, Empty) */}
      {(viewState === 'calibrated' ||
        viewState === 'low-confidence' ||
        viewState === 'partial' ||
        viewState === 'empty') && (
        <>
          <section
            aria-labelledby="priority-queue-heading"
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
          >
            <h2 id="priority-queue-heading" className="sr-only">
              Recommended Priority Calibration Block and Psychometric Engine
              Safeguards
            </h2>

            {/* Left 7 Columns: #1 Priority Task Card + Mascot Guide + WhyThisPanel */}
            <div className="lg:col-span-7 min-w-0 flex flex-col justify-between gap-4">
              <Card className="p-6 space-y-5 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="reward" glyph="★">
                    #1 Priority Calibration Block · Recommended Next
                  </Badge>
                  <Badge
                    tone={
                      topPriorityModule.isUnassessed
                        ? 'warning'
                        : topPriorityModule.isHatched
                          ? 'low-confidence'
                          : 'brand'
                    }
                    glyph={
                      topPriorityModule.isUnassessed
                        ? '◌'
                        : topPriorityModule.isHatched
                          ? '▨'
                          : '●'
                    }
                  >
                    {topPriorityModule.isUnassessed
                      ? 'Unassessed (0 Trials)'
                      : topPriorityModule.isHatched
                        ? `▨ Hatched (${topPriorityModule.confidencePct}% Conf)`
                        : `Solid (${topPriorityModule.confidencePct}% Conf)`}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 font-mono-tabular text-xs text-ink-muted">
                    <span>
                      {topPriorityModule.dim.markerGlyph}{' '}
                      {topPriorityModule.dim.code} · Slot{' '}
                      {topPriorityModule.dim.slotIndex}
                    </span>
                    <span>•</span>
                    <span>
                      Task: <strong>{topPriorityModule.dim.taskName}</strong>
                    </span>
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-ink break-words">
                    {topPriorityModule.dim.name}
                  </h3>
                  <p className="text-sm text-ink-muted">
                    {topPriorityModule.dim.scientificDefinition}
                  </p>
                </div>

                {/* Staircase & Psychometric Parameters Box */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono-tabular">
                  <div className="rounded-sm border border-border bg-canvas p-2.5">
                    <span className="text-ink-muted block">Current Band</span>
                    <strong className="text-ink text-sm">
                      {topPriorityModule.isUnassessed
                        ? 'Unassessed'
                        : `${topPriorityModule.est?.scorePct}% ± ${topPriorityModule.ciHalfWidth}%`}
                    </strong>
                  </div>
                  <div className="rounded-sm border border-border bg-canvas p-2.5">
                    <span className="text-ink-muted block">Staircase Level</span>
                    <strong className="text-ink text-sm">
                      Lvl {topPriorityModule.currentLevel} → Lvl{' '}
                      {topPriorityModule.nextTargetLevel}
                    </strong>
                  </div>
                  <div className="rounded-sm border border-border bg-canvas p-2.5">
                    <span className="text-ink-muted block">Block Length</span>
                    <strong className="text-ink text-sm">
                      {topPriorityModule.trialCount} Trials (~
                      {topPriorityModule.estimatedSeconds}s)
                    </strong>
                  </div>
                  <div className="rounded-sm border border-border bg-canvas p-2.5">
                    <span className="text-ink-muted block">Schema Engine</span>
                    <strong className="text-ink text-sm uppercase">
                      {topPriorityModule.dim.schemaTypes.join(' + ')}
                    </strong>
                  </div>
                </div>

                {/* Companion Guide Note (Locked out during actual timed trials on Page 04) */}
                {showMascot && (
                  <Mascot
                    state={
                      viewState === 'low-confidence'
                        ? 'rest'
                        : viewState === 'empty'
                          ? 'hello'
                          : 'thinking'
                    }
                    size="sm"
                    title="Pre-Block Pacing Guide (Auto-Hidden During Timed Trials)"
                    badgeLabel="Zero-Distraction Lock Armed"
                    message={
                      viewState === 'low-confidence'
                        ? '“Take a slow breath before starting. During timed trials on the next screen, my animations lock off automatically so nothing distracts your reaction-time telemetry.”'
                        : '“Completing this 90-second block will narrow your 95% confidence interval by ~6%. Remember: you can press Space or Escape to pause anytime.”'
                    }
                  />
                )}

                <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                  <Link
                    to={`/task/${topPriorityModule.dim.id}`}
                    className="tactile-btn bg-brand text-brand-ink px-5 py-3 text-base font-semibold no-underline inline-flex items-center"
                  >
                    ▶ Launch {topPriorityModule.dim.code} Micro-Block (
                    {topPriorityModule.estimatedSeconds}s) →
                  </Link>
                  <span className="text-xs font-mono-tabular text-ink-muted">
                    Scoring: {topPriorityModule.dim.scoringMethod}
                  </span>
                </div>
              </Card>

              <WhyThisPanel
                trail={SAMPLE_WHY_THIS_TRAIL}
                title={`Why Is ${topPriorityModule.dim.name} Queued #1? (5-Part Reasoning Trail)`}
                defaultExpanded
              />
            </div>

            {/* Right 5 Columns: Psychometric Safeguards + Known Biases + Live /v1/tasks/next Contract */}
            <div className="lg:col-span-5 min-w-0 flex flex-col justify-between gap-4">
              <Card className="p-5 space-y-4 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink">
                      Psychometric Validity &amp; Robustness Safeguards
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Active protections ensuring clean, reproducible cognitive
                      telemetry.
                    </p>
                  </div>
                  <Badge tone="success" glyph="✓">
                    All 5 Guards Armed
                  </Badge>
                </div>

                <ul className="space-y-2.5 text-xs text-ink">
                  <li className="rounded-sm border border-border bg-canvas p-3 flex items-start justify-between gap-2">
                    <div>
                      <strong className="font-display text-sm block">
                        1 · Tab-Blur &amp; Window-Hide Auto-Pause
                      </strong>
                      <span className="text-ink-muted">
                        Switching tabs or minimizing immediately pauses the
                        trial clock and flags the interrupted item so your RT is
                        never polluted.
                      </span>
                    </div>
                    <Badge tone="brand" glyph="●">
                      Active
                    </Badge>
                  </li>

                  <li className="rounded-sm border border-border bg-canvas p-3 flex items-start justify-between gap-2">
                    <div>
                      <strong className="font-display text-sm block">
                        2 · Hardware Input Latency Normalization
                      </strong>
                      <span className="text-ink-muted">
                        Subtracts device baseline offset (
                        <code className="font-mono-tabular">
                          {consentPreferences.inputLatencyMs ?? 138} ms
                        </code>
                        ) and logs display frame duration via{' '}
                        <code className="font-mono-tabular">
                          requestAnimationFrame
                        </code>
                        .
                      </span>
                    </div>
                    <Badge tone="info" glyph="◈">
                      {consentPreferences.inputLatencyMs ?? 138} ms
                    </Badge>
                  </li>

                  <li className="rounded-sm border border-border bg-canvas p-3 flex items-start justify-between gap-2">
                    <div>
                      <strong className="font-display text-sm block">
                        3 · Offline Event Ring Buffer (Up to 500 Trials)
                      </strong>
                      <span className="text-ink-muted">
                        {simulateOffline
                          ? 'Offline mode active: trial events are queued locally and will batch-sync on reconnect.'
                          : 'Zero trial loss if Wi-Fi drops mid-block.'}
                      </span>
                    </div>
                    <Badge
                      tone={simulateOffline ? 'warning' : 'success'}
                      glyph={simulateOffline ? '⚡' : '✓'}
                    >
                      {simulateOffline ? 'Buffering' : '0 Queued'}
                    </Badge>
                  </li>

                  <li className="rounded-sm border border-border bg-canvas p-3 flex items-start justify-between gap-2">
                    <div>
                      <strong className="font-display text-sm block">
                        4 · Mandatory Non-Biometric Telemetry Lock
                      </strong>
                      <span className="text-ink-muted">
                        Zero camera, microphone, gaze, or keystroke-content
                        capture.
                      </span>
                    </div>
                    <Badge tone="brand" glyph="✓">
                      Locked ON
                    </Badge>
                  </li>
                </ul>
              </Card>

              {/* Known Biases & Epistemic Limits Card */}
              <Card className="p-5 space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="font-display text-base font-bold text-ink">
                    Known Measurement Biases ({topPriorityModule.dim.code})
                  </strong>
                  <Badge tone="neutral" glyph="◈">
                    Epistemic Transparency
                  </Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  {topPriorityModule.dim.uncertaintyNote}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topPriorityModule.dim.knownBiases.map((bias) => (
                    <Badge key={bias} tone="neutral" glyph="•">
                      {bias}
                    </Badge>
                  ))}
                </div>
              </Card>

              {/* Live GET /v1/tasks/next & POST /v1/telemetry/event Contract Preview */}
              <Card className="p-5 space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-ink">
                      Scheduler &amp; Telemetry Contracts (`GET /v1/tasks/next`)
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Inspect the exact staircase payload sent to the Task
                      Runner and the bound telemetry endpoint.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-expanded={showNextTaskJson}
                    onClick={() => setShowNextTaskJson((prev) => !prev)}
                  >
                    {showNextTaskJson
                      ? 'Hide Payload JSON ▲'
                      : 'Inspect Payload JSON ▼'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono-tabular">
                  <div className="rounded-sm border border-border bg-canvas p-2.5">
                    <span className="text-ink-muted block">Queue Endpoint</span>
                    <strong className="text-ink">GET /v1/tasks/next</strong>
                  </div>
                  <div className="rounded-sm border border-border bg-canvas p-2.5">
                    <span className="text-ink-muted block">Event Sink</span>
                    <strong className="text-ink">
                      POST /v1/telemetry/event
                    </strong>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular text-ink-muted pt-1">
                  <span>
                    Target Schema:{' '}
                    <strong className="text-ink uppercase">
                      {topPriorityModule.dim.schemaTypes[0]}
                    </strong>
                  </span>
                  <span>
                    Posterior Target:{' '}
                    <strong className="text-ink">85% Acc (QUEST+)</strong>
                  </span>
                </div>

                {showNextTaskJson && (
                  <pre
                    tabIndex={0}
                    role="region"
                    aria-label="Next task scheduler JSON payload"
                    className="focus-ring rounded-sm border border-border bg-canvas p-3 text-xs font-mono-tabular text-ink overflow-x-auto whitespace-pre-wrap break-words max-h-52"
                  >
                    <code>
                      {JSON.stringify(nextTaskContractPayload, null, 2)}
                    </code>
                  </pre>
                )}
              </Card>
            </div>
          </section>

          {/* BOTTOM ROW: ALL CONFIGURED COGNITIVE TASK MODULES (CARDS OR TABLE) */}
          <Card
            as="section"
            aria-labelledby="all-modules-heading"
            className="p-6 space-y-5 min-w-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2
                  id="all-modules-heading"
                  className="font-display text-2xl font-bold text-ink"
                >
                  Configured Cognitive Task Modules ({filteredModules.length} of{' '}
                  {activeDimensions.length} Shown)
                </h2>
                <p className="text-xs text-ink-muted">
                  Ordered by calibration priority. Every dimension pairs an
                  Okabe-Ito color token, geometric vertex glyph, and explicit
                  confidence badge.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Filter assessment task modules"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {(
                    [
                      { id: 'all', label: `All (${activeDimensions.length})` },
                      {
                        id: 'priority-hatched',
                        label: '▨ Priority Hatched / Unassessed',
                      },
                      {
                        id: 'solid-calibrated',
                        label: '● Solid Calibrated (≥60%)',
                      },
                    ] as const
                  ).map((tab) => (
                    <Button
                      key={tab.id}
                      size="sm"
                      variant={queueFilter === tab.id ? 'primary' : 'secondary'}
                      aria-pressed={queueFilter === tab.id}
                      onClick={() => setQueueFilter(tab.id)}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  aria-pressed={showAsTable}
                  onClick={() => setShowAsTable((prev) => !prev)}
                >
                  {showAsTable
                    ? 'View Modules as Cards'
                    : 'View Task Queue as Table'}
                </Button>
              </div>
            </div>

            {showAsTable ? (
              <div className="overflow-x-auto">
                <table
                  aria-label="Assessment Hub cognitive task queue table"
                  className="w-full text-start border-collapse text-sm"
                >
                  <thead>
                    <tr className="border-b-2 border-border-strong text-xs font-mono-tabular uppercase text-ink-muted">
                      <th className="py-2.5 pe-3 text-start">Rank</th>
                      <th className="py-2.5 px-3 text-start">Dimension</th>
                      <th className="py-2.5 px-3 text-start">
                        Psychometric Task &amp; Schema
                      </th>
                      <th className="py-2.5 px-3 text-start">Current ±CI</th>
                      <th className="py-2.5 px-3 text-start">Staircase</th>
                      <th className="py-2.5 px-3 text-start">Confidence</th>
                      <th className="py-2.5 ps-3 text-start">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredModules.map((m, idx) => (
                      <tr key={m.dim.id}>
                        <td className="py-2.5 pe-3 font-mono-tabular font-bold text-ink">
                          #{idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-ink">
                          <span aria-hidden="true" className="me-1.5">
                            {m.dim.markerGlyph}
                          </span>
                          {m.dim.name} ({m.dim.code})
                        </td>
                        <td className="py-2.5 px-3 text-xs text-ink-muted">
                          {m.dim.taskName} (
                          <code className="font-mono-tabular">
                            {m.dim.schemaTypes.join(', ')}
                          </code>
                          )
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-ink">
                          {m.isUnassessed
                            ? 'Unassessed'
                            : `${m.est?.scorePct}% ± ${m.ciHalfWidth}%`}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-ink">
                          Lvl {m.currentLevel} → Lvl {m.nextTargetLevel}
                        </td>
                        <td className="py-2.5 px-3">
                          {m.isUnassessed ? (
                            <Badge tone="warning" glyph="◌">
                              0% (Unassessed)
                            </Badge>
                          ) : m.isHatched ? (
                            <Badge tone="low-confidence" glyph="▨">
                              {m.confidencePct}% (Hatched)
                            </Badge>
                          ) : (
                            <Badge tone="brand" glyph="●">
                              {m.confidencePct}% (Solid)
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 ps-3">
                          <Link
                            to={`/task/${m.dim.id}`}
                            className="focus-ring text-xs font-semibold text-ink underline"
                          >
                            Launch {m.dim.code} →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredModules.map((m, idx) => (
                  <Card
                    key={m.dim.id}
                    className={`p-4 flex flex-col justify-between gap-3 min-w-0 ${
                      m.isHatched || m.isUnassessed
                        ? 'border-dashed bg-surface-raised'
                        : 'bg-surface'
                    }`}
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-mono-tabular text-xs font-bold text-ink">
                          #{idx + 1} · {m.dim.markerGlyph} {m.dim.code}
                        </span>
                        {m.isUnassessed ? (
                          <Badge tone="warning" glyph="◌">
                            Unassessed
                          </Badge>
                        ) : m.isHatched ? (
                          <Badge tone="low-confidence" glyph="▨">
                            Hatched ({m.confidencePct}%)
                          </Badge>
                        ) : (
                          <Badge tone="brand" glyph="●">
                            Solid ({m.confidencePct}%)
                          </Badge>
                        )}
                      </div>

                      <h3 className="font-display text-lg font-bold text-ink break-words">
                        {m.dim.name}
                      </h3>

                      <p className="text-xs font-semibold text-ink">
                        {m.dim.taskName}
                      </p>

                      <p className="text-xs text-ink-muted line-clamp-2">
                        {m.dim.shortDescription}
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-border">
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono-tabular">
                        <div>
                          <span className="text-ink-muted block">
                            Current ±CI
                          </span>
                          <strong className="text-ink">
                            {m.isUnassessed
                              ? '—'
                              : `${m.est?.scorePct}% ± ${m.ciHalfWidth}%`}
                          </strong>
                        </div>
                        <div>
                          <span className="text-ink-muted block">
                            Staircase
                          </span>
                          <strong className="text-ink">
                            Lvl {m.currentLevel} → {m.nextTargetLevel}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="font-mono-tabular text-xs text-ink-muted uppercase">
                          {m.dim.schemaTypes[0]} · {m.estimatedSeconds}s
                        </span>
                        <Link
                          to={`/task/${m.dim.id}`}
                          className="tactile-btn bg-brand text-brand-ink px-3 py-1.5 text-xs font-semibold no-underline inline-flex items-center"
                        >
                          Launch Task →
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
