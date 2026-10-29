import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ProjectionFanChart } from '../components/features/brain-twin/ProjectionFanChart'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'
import { getDimensionsByPreset } from '../config/dimensions'
import type { DimensionConfig, WhyThisTrail } from '../types'
import { buildEstimatesForDimensions } from '../services/mocks/fixtures'
import { type PersonaId, useAppStore } from '../state/useAppStore'

type DimensionDetailPreviewState =
  | 'converged'
  | 'low-confidence-hatched'
  | 'loading'
  | 'empty'
  | 'error'
  | 'extreme-text'

interface SessionTrialRow {
  sessionCode: string
  dateLabel: string
  staircaseLevel: number
  medianRtMs: number
  jitterMs: number
  accuracyPct: number
  scorePct: number
  halfCiPct: number
  confidencePct: number
}

const PERSONA_OPTIONS: { id: PersonaId; label: string }[] = [
  { id: 'steady-improver', label: 'Youssef (Balanced)' },
  { id: 'new-user', label: 'Salma (First Session)' },
  { id: 'noisy-low-confidence', label: 'Rami (High Fatigue)' },
  { id: 'edge-missing-dim', label: 'Partial (Missing Dim)' },
  { id: 'edge-10-dimensions', label: '10-Dim Stress' },
]

function resolveDimensionFromParam(
  param: string | undefined,
  activeDims: readonly DimensionConfig[],
): DimensionConfig {
  const fallback = activeDims[0]!
  if (!param) return fallback
  const normalized = param.toLowerCase().replace(/-/g, '_')
  const exact = activeDims.find(
    (d) =>
      d.id.toLowerCase() === normalized ||
      d.code.toLowerCase() === normalized ||
      d.id.toLowerCase().startsWith(normalized),
  )
  return exact ?? fallback
}

function getFormulaForDimension(dim: DimensionConfig): {
  equation: string
  everydayTransfer: string
  questStepRule: string
} {
  switch (dim.code) {
    case 'WM':
      return {
        equation:
          'θ_WM = σ(0.55 · d_prime_nback − 0.30 · z_RT − 0.15 · jitter_norm)',
        everydayTransfer:
          'Holding multi-step problem constraints in mind while writing code, synthesizing lecture notes, or comparing technical specs.',
        questStepRule:
          'Advance N-Back load (+1 step) when accuracy ≥ 85% and jitter < 110 ms across 2 consecutive blocks.',
      }
    case 'IC':
      return {
        equation:
          'θ_IC = σ(0.50 · acc_incongruent − 0.35 · ΔRT_stroop − 0.15 · burst_rate)',
        everydayTransfer:
          'Resisting notification context-switching and verifying AI-generated claims before accepting plausible-sounding outputs.',
        questStepRule:
          'Tighten incongruent cue window (−40 ms) when conflict cost ΔRT < 95 ms with 0 error bursts.',
      }
    case 'CF':
      return {
        equation:
          'θ_CF = σ(0.50 · post_switch_acc − 0.35 · switch_cost_ms − 0.15 · perseveration)',
        everydayTransfer:
          'Pivoting smoothly between analytical debugging, architectural synthesis, and written documentation without rule carryover.',
        questStepRule:
          'Increase rule-switch frequency when post-switch stabilization occurs within ≤ 2 trials.',
      }
    case 'AN':
      return {
        equation:
          'θ_AN = σ(0.55 · peripheral_hit_rate − 0.25 · orienting_delta − 0.20 · false_alarms)',
        everydayTransfer:
          'Maintaining sustained focus during dense reading sessions while filtering peripheral visual or auditory clutter.',
        questStepRule:
          'Add peripheral distractor ring density (+2 distractors) when central + peripheral hit rate ≥ 88%.',
      }
    case 'PS':
      return {
        equation:
          'θ_PS = σ(0.60 · (1 − threshold_shown_ms / 240) + 0.40 · dual_target_acc)',
        everydayTransfer:
          'Rapidly scanning dashboards, log streams, or multi-panel diagrams to spot anomalies at a glance.',
        questStepRule:
          'QUEST+ Bayesian threshold updates presentation frames (shown_ms) toward the 82% psychometric inflection point.',
      }
    case 'EP':
      return {
        equation:
          'θ_EP = σ(0.65 · (P("Similar"|Lure) − P("Similar"|New)) − 0.35 · z_RT_lure)',
        everydayTransfer:
          'Distinguishing subtly different API contracts, theorems, or historical cases without conflating overlapping details.',
        questStepRule:
          'Increase visual lure similarity (perturbation delta L3 → L4) once Lure Discrimination Index exceeds 0.62.',
      }
    default:
      return {
        equation: `θ_${dim.code} = σ(0.55 · acc_norm − 0.30 · z_RT − 0.15 · PathCost_ratio)`,
        everydayTransfer:
          'Planning multi-step reasoning paths, evaluating structural trade-offs, and calibrating self-estimated confidence.',
        questStepRule:
          'Step staircase difficulty up (+1) after 3 consecutive optimal-path completions with low hesitation jitter.',
      }
  }
}

function buildSessionHistory(
  dim: DimensionConfig,
  currentScorePct: number,
  currentHalfCi: number,
  currentConfPct: number,
): SessionTrialRow[] {
  const baseRt = 480 + dim.slotIndex * 18
  const isLowConf = currentConfPct < 60
  const latestAcc = Math.min(94, Math.max(84, 83 + (dim.slotIndex % 8)))
  return [
    {
      sessionCode: 'Session 06 (Latest)',
      dateLabel: 'Today · 09:40',
      staircaseLevel: isLowConf ? 2 : 4,
      medianRtMs: baseRt,
      jitterMs: isLowConf ? 98 : 42,
      accuracyPct: latestAcc,
      scorePct: currentScorePct,
      halfCiPct: currentHalfCi,
      confidencePct: currentConfPct,
    },
    {
      sessionCode: 'Session 05',
      dateLabel: '2 Days Ago',
      staircaseLevel: isLowConf ? 2 : 4,
      medianRtMs: baseRt + 14,
      jitterMs: isLowConf ? 106 : 48,
      accuracyPct: latestAcc - 2,
      scorePct: Math.max(42, currentScorePct - 2),
      halfCiPct: currentHalfCi + 1,
      confidencePct: Math.max(38, currentConfPct - 4),
    },
    {
      sessionCode: 'Session 04',
      dateLabel: '5 Days Ago',
      staircaseLevel: isLowConf ? 2 : 3,
      medianRtMs: baseRt + 26,
      jitterMs: 55,
      accuracyPct: latestAcc - 3,
      scorePct: Math.max(40, currentScorePct - 4),
      halfCiPct: currentHalfCi + 2,
      confidencePct: Math.max(34, currentConfPct - 9),
    },
    {
      sessionCode: 'Session 03',
      dateLabel: 'Week 5 · Thu',
      staircaseLevel: 3,
      medianRtMs: baseRt + 38,
      jitterMs: 63,
      accuracyPct: latestAcc - 5,
      scorePct: Math.max(38, currentScorePct - 6),
      halfCiPct: currentHalfCi + 4,
      confidencePct: Math.max(30, currentConfPct - 15),
    },
    {
      sessionCode: 'Session 02',
      dateLabel: 'Week 4 · Tue',
      staircaseLevel: 2,
      medianRtMs: baseRt + 52,
      jitterMs: 74,
      accuracyPct: latestAcc - 7,
      scorePct: Math.max(36, currentScorePct - 9),
      halfCiPct: currentHalfCi + 6,
      confidencePct: Math.max(26, currentConfPct - 22),
    },
    {
      sessionCode: 'Session 01 (Baseline)',
      dateLabel: 'Week 3 · Mon',
      staircaseLevel: 1,
      medianRtMs: baseRt + 78,
      jitterMs: 92,
      accuracyPct: latestAcc - 9,
      scorePct: Math.max(34, currentScorePct - 12),
      halfCiPct: currentHalfCi + 9,
      confidencePct: Math.max(22, currentConfPct - 30),
    },
  ]
}

export function DimensionDetailPage() {
  const { dimId } = useParams<{ dimId: string }>()
  const navigate = useNavigate()

  const dimensionPreset = useAppStore((s) => s.dimensionPreset)
  const setDimensionPreset = useAppStore((s) => s.setDimensionPreset)
  const activePersona = useAppStore((s) => s.activePersona)
  const setActivePersona = useAppStore((s) => s.setActivePersona)
  const simulateLlmDown = useAppStore((s) => s.simulateLlmDown)

  const activeDimensions = useMemo(
    () => getDimensionsByPreset(dimensionPreset),
    [dimensionPreset],
  )

  const currentDim = useMemo(
    () => resolveDimensionFromParam(dimId, activeDimensions),
    [dimId, activeDimensions],
  )

  const [previewState, setPreviewState] =
    useState<DimensionDetailPreviewState>('converged')
  const [showRawTelemetryJson, setShowRawTelemetryJson] =
    useState<boolean>(false)

  const estimates = useMemo(
    () => buildEstimatesForDimensions(activeDimensions, activePersona),
    [activeDimensions, activePersona],
  )

  const currentEstimate = useMemo(() => {
    const found = estimates.find((e) => e.dimensionId === currentDim.id)
    const resolvedScore = found?.scorePct ?? 74
    if (previewState === 'low-confidence-hatched') {
      return {
        dimensionId: currentDim.id,
        scorePct: resolvedScore,
        ciLowerPct: Math.max(0, resolvedScore - 16),
        ciUpperPct: Math.min(100, resolvedScore + 16),
        confidence: 0.48,
        isLowConfidence: true,
        trialCount: 4,
      }
    }
    return {
      dimensionId: currentDim.id,
      scorePct: resolvedScore,
      ciLowerPct: found?.ciLowerPct ?? 68,
      ciUpperPct: found?.ciUpperPct ?? 80,
      confidence: found && found.confidence > 0 ? found.confidence : 0.82,
      isLowConfidence: found?.isLowConfidence ?? false,
      trialCount: found?.sampleSize ?? 24,
    }
  }, [estimates, currentDim.id, previewState])

  const halfCi = Math.max(
    4,
    Math.round(
      (currentEstimate.ciUpperPct - currentEstimate.ciLowerPct) / 2,
    ),
  )
  const confPct = Math.round(currentEstimate.confidence * 100)
  const isHatched = confPct < 60

  const formulaSpec = useMemo(
    () => getFormulaForDimension(currentDim),
    [currentDim],
  )

  const sessionRows = useMemo(
    () =>
      buildSessionHistory(
        currentDim,
        currentEstimate.scorePct,
        halfCi,
        confPct,
      ),
    [currentDim, currentEstimate.scorePct, halfCi, confPct],
  )

  const whyThisTrail = useMemo<WhyThisTrail>(
    () => ({
      id: `why-dim-detail-${currentDim.id}`,
      observedData: [
        `${currentDim.taskName}: ${isHatched ? '4 baseline trials' : '24 calibrated trials'} logged across recent sessions.`,
        `Latest median normalized RT: ${sessionRows[0]?.medianRtMs ?? 520} ms (hesitation jitter ±${sessionRows[0]?.jitterMs ?? 44} ms).`,
        `Current 95% Bayesian credible interval: [${currentEstimate.ciLowerPct}%, ${currentEstimate.ciUpperPct}%] (${confPct}% epistemic confidence).`,
      ],
      inference: isHatched
        ? `Because epistemic confidence is ${confPct}% (< 60% threshold), QUEST+ renders ${currentDim.name} with diagonal SVG hatching to prevent over-interpreting early trials.`
        : `SAT-JEPA differential vector (Δc) confirms stable convergence at Staircase Level ${sessionRows[0]?.staircaseLevel ?? 4} with posterior entropy narrowed to 0.38 bits.`,
      recommendation: isHatched
        ? `Complete one 90-second ${currentDim.taskName} micro-block to add 8 calibrated trials and graduate ${currentDim.code} to a solid confidence band.`
        : `Maintain ${currentDim.code} with one weekly Level ${sessionRows[0]?.staircaseLevel ?? 4} block during your morning peak window (09:00–11:30).`,
      confidence: currentEstimate.confidence,
      sourceModule: simulateLlmDown
        ? 'deterministic_fallback'
        : 'quest_staircase',
      counterfactual: `If response-time jitter rises above 120 ms or accuracy drops below 72%, QUEST+ automatically steps down 1 staircase level to protect measurement validity.`,
    }),
    [
      currentDim,
      currentEstimate,
      halfCi,
      confPct,
      isHatched,
      sessionRows,
      simulateLlmDown,
    ],
  )

  return (
    <div className="space-y-6">
      {/* TOP HEADER & 1-CLICK REGISTRY DIMENSION SWITCHER */}
      <Card
        as="section"
        aria-labelledby="dimension-detail-heading"
        className="p-6 space-y-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand" glyph={currentDim.markerGlyph}>
                Dimension Deep Dive · Slot {currentDim.slotIndex} of{' '}
                {activeDimensions.length}
              </Badge>
              <Badge
                tone={isHatched ? 'warning' : 'success'}
                glyph={isHatched ? '⚡' : '●'}
              >
                {isHatched
                  ? `Hatched Band · ${confPct}% Confidence (±${halfCi}% CI)`
                  : `Solid Band · ${confPct}% Confidence (±${halfCi}% CI)`}
              </Badge>
              <Badge tone="info" glyph="◈">
                Estimate: {currentEstimate.scorePct}% ± {halfCi}%
              </Badge>
            </div>

            <h1
              id="dimension-detail-heading"
              className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink"
            >
              <span aria-hidden="true" className="me-2">
                {currentDim.markerGlyph}
              </span>
              {currentDim.code} · {currentDim.name}
            </h1>
            <DoodleSquiggle className="max-w-xs mt-1" />

            <p className="text-base text-ink-muted">
              {currentDim.scientificDefinition} Inspect how behavioral task
              telemetry maps to your QUEST+ confidence interval, 6-week
              projection fan, and everyday study habits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to={`/task/${currentDim.id}`}
              className="tactile-btn bg-brand text-brand-ink px-4 py-2.5 text-sm font-semibold no-underline inline-flex items-center"
            >
              Launch 90s {currentDim.code} Block →
            </Link>
            <Link
              to="/coach"
              className="tactile-btn bg-surface text-ink hover:bg-surface-raised px-3.5 py-2.5 text-sm font-semibold no-underline inline-flex items-center"
            >
              Ask AI Coach →
            </Link>
          </div>
        </div>

        {/* 1-Click Dimension Switcher Bar across all active 3/6/7/8/10 dimensions */}
        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono-tabular text-xs font-semibold uppercase text-ink-muted">
              Switch Active Dimension ({activeDimensions.length} Registered in
              Current Preset):
            </span>
            <Link
              to="/assessment"
              className="text-xs font-semibold text-brand hover:underline"
            >
              View Full Assessment Queue →
            </Link>
          </div>

          <div
            role="group"
            aria-label="Select cognitive dimension to inspect"
            className="flex flex-wrap items-center gap-2"
          >
            {activeDimensions.map((dim) => {
              const est = estimates.find((e) => e.dimensionId === dim.id)
              const dimConf = Math.round((est?.confidence ?? 0.8) * 100)
              const dimHatched = dimConf < 60
              const isSelected = dim.id === currentDim.id

              return (
                <Button
                  key={dim.id}
                  size="sm"
                  variant={isSelected ? 'primary' : 'secondary'}
                  aria-pressed={isSelected}
                  onClick={() => {
                    navigate(`/dimensions/${dim.id}`)
                  }}
                >
                  <span aria-hidden="true" className="me-1">
                    {dim.markerGlyph}
                  </span>
                  {dim.code} · {dim.name}
                  {dimHatched ? ' ⚡' : ''}
                </Button>
              )
            })}
          </div>
        </div>

        {/* Dimension Profile Switcher */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Dimension profile switcher"
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="font-mono-tabular text-xs font-semibold uppercase text-ink-muted me-1">
              Profile:
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
            aria-label="Dimension detail preview state switcher"
            className="flex flex-wrap items-center gap-1.5"
          >
            {(
              [
                { id: 'converged', label: '1 · Converged Solid' },
                {
                  id: 'low-confidence-hatched',
                  label: '2 · ⚡ Hatched (<60% CI)',
                },
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
                  if (st.id === 'low-confidence-hatched') {
                    const epDim = activeDimensions.find(
                      (d) => d.id === 'episodic_pattern_separation',
                    )
                    if (epDim) {
                      navigate(`/dimensions/${epDim.id}`)
                    }
                  }
                }}
              >
                {st.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* LOW-CONFIDENCE HATCHED BANNER (When confidence < 60%) */}
      {isHatched &&
        (previewState === 'converged' ||
          previewState === 'low-confidence-hatched' ||
          previewState === 'extreme-text') && (
          <Card
            role="region"
            aria-label="Low confidence diagonal hatching notice"
            className="p-5 border-2 border-border-strong bg-warning-subtle flex flex-wrap items-center justify-between gap-4"
          >
            <div className="space-y-1 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning" glyph="⚡">
                  Diagonal SVG Hatching Active · Confidence {confPct}% (&lt;60%)
                </Badge>
                <span className="font-mono-tabular text-xs font-bold text-ink">
                  Interval Width: ±{halfCi}% ([{currentEstimate.ciLowerPct}%,{' '}
                  {currentEstimate.ciUpperPct}%])
                </span>
              </div>
              <p className="text-sm text-ink font-medium">
                Only 4 baseline trials have been logged for{' '}
                <strong>{currentDim.name}</strong> so far. SynapseTwin displays
                this axis with diagonal hatching so you never confuse early
                sample variance with a fixed trait. One 90-second calibration
                block narrows this band to ±6%.
              </p>
            </div>
            <Link
              to={`/task/${currentDim.id}`}
              className="tactile-btn bg-brand text-brand-ink px-4 py-2.5 text-xs font-semibold no-underline shrink-0"
            >
              Calibrate {currentDim.code} Now (90s) →
            </Link>
          </Card>
        )}

      {/* STATE: LOADING */}
      {previewState === 'loading' && (
        <Card
          role="status"
          aria-label="Loading dimension psychometric telemetry"
          className="p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold text-ink">
              Loading {currentDim.code} QUEST+ Posterior &amp; 6-Week
              Trajectory…
            </span>
            <Badge tone="info" glyph="◌">
              Fetching Telemetry
            </Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 h-64 rounded-md border-2 border-border bg-surface-raised" />
            <div className="lg:col-span-5 h-64 rounded-md border-2 border-border bg-surface-raised" />
          </div>
        </Card>
      )}

      {/* STATE: EMPTY */}
      {previewState === 'empty' && (
        <Card className="p-6 space-y-4">
          <Badge tone="info" glyph="◌">
            Uncalibrated Dimension · 0 Trials Logged
          </Badge>
          <h2 className="font-display text-2xl font-bold text-ink">
            No Telemetry Recorded Yet for {currentDim.code} · {currentDim.name}
          </h2>
          <p className="text-sm text-ink-muted max-w-2xl">
            Run a 90-second <strong>{currentDim.taskName}</strong> baseline
            micro-block to initialize your Bayesian QUEST+ credible interval and
            6-week projection fan.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/task/${currentDim.id}`}
              className="tactile-btn bg-brand text-brand-ink px-4 py-2.5 text-sm font-semibold no-underline"
            >
              Start First {currentDim.code} Micro-Block →
            </Link>
            <Button
              variant="secondary"
              onClick={() => setPreviewState('converged')}
            >
              Restore Seeded {currentDim.code} Telemetry
            </Button>
          </div>
        </Card>
      )}

      {/* STATE: ERROR */}
      {previewState === 'error' && (
        <Card
          role="alert"
          className="p-6 border-2 border-danger bg-danger-subtle space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-ink">
              ✕ Dimension Telemetry Endpoint Timeout (GET /v1/dashboard/profile)
            </h2>
            <Badge tone="info" glyph="⚙">
              Local Snapshot Cache Intact
            </Badge>
          </div>
          <p className="text-sm text-ink">
            Could not refresh remote trial history for {currentDim.name}. You
            can restore the verified local QUEST+ snapshot immediately.
          </p>
          <Button
            variant="primary"
            onClick={() => setPreviewState('converged')}
          >
            Restore Cached {currentDim.code} Snapshot →
          </Button>
        </Card>
      )}

      {/* STATE: EXTREME-TEXT */}
      {previewState === 'extreme-text' && (
        <Card className="p-6 space-y-2 min-w-0">
          <Badge tone="info" glyph="◈">
            Multi-Clause Psychometric Equation &amp; 10-Dimension Stress Test
          </Badge>
          <h2 className="font-display text-xl font-bold text-ink break-words">
            {currentDim.code} · {currentDim.name} — Bayesian Adaptive QUEST+
            Posterior Entropy &amp; Cross-Session Latency Normalization
          </h2>
          <p className="font-mono-tabular text-xs font-bold text-ink break-words">
            Formula: {formulaSpec.equation} · Prior H₀ = 1.42 bits → Posterior
            H_t = 0.38 bits
          </p>
        </Card>
      )}

      {/* MAIN 7:5 GRID: Trajectory + Session Table (Left 7) | Formula + Biases + WhyThis (Right 5) */}
      {(previewState === 'converged' ||
        previewState === 'low-confidence-hatched' ||
        previewState === 'extreme-text') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT 7 COLUMNS */}
          <div className="lg:col-span-7 min-w-0 flex flex-col justify-between gap-6">
            {/* Card L1: Signature #4 <ProjectionFanChart /> locked to currentDim */}
            <ProjectionFanChart
              dimensions={activeDimensions}
              persona={activePersona}
              initialTarget={currentDim.id}
              title={`${currentDim.code} · ${currentDim.name} 6-Week Trajectory & Forecast Fan`}
            />

            {/* Card L2: Session-by-Session Trial & QUEST+ Calibration Log */}
            <Card
              as="section"
              aria-labelledby="session-trial-log-heading"
              className="p-5 space-y-4 min-w-0"
            >
              <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-2 border-b border-border pb-3">
                <div className="min-w-0 flex-1">
                  <h2
                    id="session-trial-log-heading"
                    className="font-display text-lg font-bold text-ink"
                  >
                    Session-by-Session Trial &amp; QUEST+ Calibration Log (n=6)
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Task paradigm: <strong>{currentDim.taskName}</strong> ·
                    Normalized reaction time and staircase progression.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  aria-pressed={showRawTelemetryJson}
                  onClick={() => setShowRawTelemetryJson((prev) => !prev)}
                >
                  {showRawTelemetryJson
                    ? 'View Session Table'
                    : 'View Telemetry JSON'}
                </Button>
              </div>

              {showRawTelemetryJson ? (
                <pre
                  tabIndex={0}
                  role="region"
                  aria-label="Dimension telemetry summary JSON payload"
                  className="focus-ring rounded-sm border border-border bg-canvas p-3 text-xs font-mono-tabular text-ink overflow-x-auto whitespace-pre-wrap break-words max-h-72"
                >
                  <code>
                    {JSON.stringify(
                      {
                        dimension_id: currentDim.id,
                        code: currentDim.code,
                        task_paradigm: currentDim.taskName,
                        schema_types: currentDim.schemaTypes,
                        posterior_estimate: {
                          score_pct: currentEstimate.scorePct,
                          ci_lower_pct: currentEstimate.ciLowerPct,
                          ci_upper_pct: currentEstimate.ciUpperPct,
                          confidence: currentEstimate.confidence,
                          hatched: isHatched,
                        },
                        recent_sessions: sessionRows,
                      },
                      null,
                      2,
                    )}
                  </code>
                </pre>
              ) : (
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Session calibration log scrollable container"
                  className="focus-ring overflow-x-auto"
                >
                  <table
                    aria-label={`Recent calibration sessions for ${currentDim.name}`}
                    className="w-full text-start border-collapse text-xs font-mono-tabular"
                  >
                    <thead>
                      <tr className="border-b-2 border-border-strong text-ink-muted uppercase">
                        <th scope="col" className="py-2 pe-3 text-start">
                          Session
                        </th>
                        <th scope="col" className="py-2 px-2 text-start">
                          Staircase
                        </th>
                        <th scope="col" className="py-2 px-2 text-start">
                          Median RT ± Jitter
                        </th>
                        <th scope="col" className="py-2 px-2 text-start">
                          Accuracy
                        </th>
                        <th scope="col" className="py-2 ps-2 text-start">
                          Posterior ± CI
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sessionRows.map((row) => (
                        <tr key={row.sessionCode}>
                          <th
                            scope="row"
                            className="py-2.5 pe-3 font-bold text-ink text-start"
                          >
                            {row.sessionCode}
                            <span className="block text-ink-muted font-normal">
                              {row.dateLabel}
                            </span>
                          </th>
                          <td className="py-2.5 px-2 text-ink">
                            Lvl {row.staircaseLevel}
                          </td>
                          <td className="py-2.5 px-2 text-ink">
                            {row.medianRtMs} ms (±{row.jitterMs} ms)
                          </td>
                          <td className="py-2.5 px-2 text-ink">
                            {row.accuracyPct}%
                          </td>
                          <td className="py-2.5 ps-2">
                            <Badge
                              tone={
                                row.confidencePct < 60 ? 'warning' : 'success'
                              }
                              glyph={row.confidencePct < 60 ? '⚡' : '●'}
                            >
                              {row.scorePct}% ±{row.halfCiPct}% (
                              {row.confidencePct}%)
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border text-xs">
                <div className="rounded-sm border border-border bg-canvas p-2.5">
                  <span className="font-mono-tabular font-bold uppercase text-ink-muted block">
                    Prior → Posterior Entropy
                  </span>
                  <span className="font-mono-tabular font-bold text-ink">
                    1.42 bits → {isHatched ? '0.94 bits (Wide)' : '0.38 bits'}
                  </span>
                </div>
                <div className="rounded-sm border border-border bg-canvas p-2.5">
                  <span className="font-mono-tabular font-bold uppercase text-ink-muted block">
                    6-Session Gain (Δc)
                  </span>
                  <span className="font-mono-tabular font-bold text-ink">
                    +12% Percentile · −9% CI Width
                  </span>
                </div>
                <div className="rounded-sm border border-border bg-canvas p-2.5">
                  <span className="font-mono-tabular font-bold uppercase text-ink-muted block">
                    Backend Schema Key
                  </span>
                  <span className="font-mono-tabular font-bold text-ink">
                    {currentDim.backendDimensionKey} (
                    {currentDim.schemaTypes.join(', ')})
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* RIGHT 5 COLUMNS: Psychometric Formula + Known Biases + <WhyThisPanel /> */}
          <div className="lg:col-span-5 min-w-0 flex flex-col justify-between gap-6">
            {/* Card R1: Psychometric Paradigm, Scoring Formula & Everyday Transfer */}
            <Card
              as="section"
              aria-labelledby="psychometric-formula-heading"
              className="p-5 space-y-3.5 min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2
                  id="psychometric-formula-heading"
                  className="font-display text-lg font-bold text-ink"
                >
                  Psychometric Scoring &amp; QUEST+ Specification
                </h2>
                <Badge tone="brand" glyph="◆">
                  {currentDim.code} Formula
                </Badge>
              </div>

              <div className="rounded-sm border-2 border-border-strong bg-canvas p-3 space-y-1.5">
                <span className="font-mono-tabular text-xs font-bold uppercase text-ink-muted block">
                  Explicit Latent Trait Estimator:
                </span>
                <p className="font-mono-tabular text-xs sm:text-sm font-bold text-ink break-words">
                  {formulaSpec.equation}
                </p>
                <p className="text-xs text-ink-muted">
                  {currentDim.scoringMethod}
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="rounded-sm border border-border bg-surface-raised p-2.5 space-y-1">
                  <span className="font-mono-tabular font-bold uppercase text-ink-muted block">
                    Adaptive Staircase Step Rule
                  </span>
                  <p className="text-ink">{formulaSpec.questStepRule}</p>
                </div>

                <div className="rounded-sm border border-border bg-surface-raised p-2.5 space-y-1">
                  <span className="font-mono-tabular font-bold uppercase text-ink-muted block">
                    Everyday Study &amp; Work Transfer
                  </span>
                  <p className="text-ink">{formulaSpec.everydayTransfer}</p>
                </div>
              </div>
            </Card>

            {/* Card R2: Known Measurement Biases & Ecological Validity Limits */}
            <Card
              as="section"
              aria-labelledby="known-biases-heading"
              className="p-5 space-y-3 min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2
                    id="known-biases-heading"
                    className="font-display text-base font-bold text-ink"
                  >
                    Known Measurement Biases &amp; Validity Limits
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Why we always report ±CI bands instead of single fixed
                    numbers.
                  </p>
                </div>
                <Badge tone="info" glyph="✓">
                  Non-Clinical Boundary
                </Badge>
              </div>

              <ul className="space-y-1.5 text-xs text-ink list-disc ps-5">
                {currentDim.knownBiases.map((bias) => (
                  <li key={bias} className="leading-relaxed">
                    <strong>Confounder:</strong> {bias}
                  </li>
                ))}
                <li className="leading-relaxed">
                  <strong>Uncertainty Driver:</strong>{' '}
                  {currentDim.uncertaintyNote}
                </li>
              </ul>

              <p className="rounded-sm border border-border bg-canvas p-2.5 text-xs text-ink-muted">
                <strong className="text-ink">Non-Clinical Guarantee:</strong>{' '}
                Task scores reflect moment-in-time behavioral telemetry—never a
                clinical diagnosis, medical evaluation, or fixed intelligence
                measure.
              </p>
            </Card>

            {/* Card R3: Embedded Signature #3 <WhyThisPanel /> */}
            <WhyThisPanel
              trail={whyThisTrail}
              title={`5-Part Reasoning Trail · ${currentDim.code} Telemetry`}
              defaultExpanded
            />
          </div>
        </div>
      )}
    </div>
  )
}
export default DimensionDetailPage
