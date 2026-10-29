import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import {
  BrainTwinTimeTravel,
  buildHistoricalSnapshots,
} from '../components/features/brain-twin/BrainTwinTimeTravel'
import { BrianMascot } from '../components/features/brand/BrianMascot'
import { UncertaintyRadar } from '../components/features/radar/UncertaintyRadar'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'
import { getDimensionsByPreset } from '../config/dimensions'
import {
  buildEstimatesForDimensions,
  SAMPLE_WHY_THIS_TRAIL,
} from '../services/mocks/fixtures'
import { useAppStore, type PersonaId } from '../state/useAppStore'

type PreviewState =
  | 'live'
  | 'early-snapshot'
  | 'loading'
  | 'empty'
  | 'error'
  | 'extreme-text'

const PERSONA_OPTIONS: { id: PersonaId; label: string; tag: string }[] = [
  { id: 'steady-improver', label: 'Youssef (Steady Improver)', tag: '86% Conf' },
  { id: 'new-user', label: 'Salma (First Session)', tag: '48% Conf' },
  {
    id: 'noisy-low-confidence',
    label: 'Rami (Noisy / High Fatigue)',
    tag: '54% Conf',
  },
  { id: 'edge-missing-dim', label: 'Partial (Missing Dim)', tag: 'Partial' },
  { id: 'edge-10-dimensions', label: '10-Dim Stress', tag: '10 Axes' },
  { id: 'edge-llm-offline', label: 'Offline / Rule Engine', tag: 'Fallback' },
]

interface DimensionModalInfo {
  title: string
  scoreRange: string
  quote: string
  howItWorks: string
  tag: string
  glyph: string
}

const DIMENSION_DEEP_DIVES: Record<string, DimensionModalInfo> = {
  working_memory: {
    title: 'Working Memory',
    scoreRange: '82–87%',
    quote: 'Holds n-back chunks effortlessly before noon; drops slightly during multi-tab context switching.',
    howItWorks: 'Measures span retention without rehearsal. Calibration controls for touch-screen latency variations and screen size discrepancy.',
    tag: 'Chunk Stability: Steady',
    glyph: 'WM',
  },
  processing_speed: {
    title: 'Processing Speed',
    scoreRange: '88–92%',
    quote: 'Rapid visual discrimination; response variance is exceptionally low on early morning prompts.',
    howItWorks: 'Calculated through symbol-match reaction times. Outlier taps (<110ms anticipation or >2000ms interruptions) are filtered out automatically.',
    tag: 'Reaction Floor: 242ms',
    glyph: 'PS',
  },
  focus_stability: {
    title: 'Focus Stability',
    scoreRange: '78–84%',
    quote: 'Sustains unbroken attention blocks for 24 mins; sensitive to noisy open-office intervals.',
    howItWorks: 'Tracks the standard deviation of response times during continuous vigilance tasks. Accounts for day-of-week stress levels.',
    tag: 'Lapse Rate: 3.1%',
    glyph: 'FS',
  },
  mental_flexibility: {
    title: 'Mental Flexibility',
    scoreRange: '81–86%',
    quote: 'Smooth task-switching cost of under 180ms when toggling between divergent word & number sets.',
    howItWorks: 'Evaluates cognitive inhibition and rule-switch adaptation. We calibrate against input habits to prevent typing bias.',
    tag: 'Switch Cost: Low',
    glyph: 'MF',
  },
  spatial_recall: {
    title: 'Spatial Recall',
    scoreRange: '75–81%',
    quote: 'Excels at grid topology layout recalls; slight degradation observed on Friday evenings.',
    howItWorks: 'Derived from matrix rotation and hidden-token recall drills. Dynamic normalization standardizes across handheld tablet vs phone displays.',
    tag: 'Topology Score: 8.2',
    glyph: 'SR',
  },
  cognitive_reserve: {
    title: 'Cognitive Reserve',
    scoreRange: '85–90%',
    quote: 'Strong stamina buffer: retains >80% baseline accuracy even after prolonged cognitive exertion.',
    howItWorks: 'Composite index of performance retention under end-of-day fatigue. Calibrated with sleep metrics and active session duration.',
    tag: 'Depletion Rate: Mild',
    glyph: 'CR',
  },
}

export default function BrainTwinPage() {
  const {
    dimensionPreset,
    setDimensionPreset,
    activePersona,
    setActivePersona,
    showMascot,
  } = useAppStore()

  const [previewState, setPreviewState] = useState<PreviewState>('live')
  const [selectedSnapIndex, setSelectedSnapIndex] = useState<number>(14)
  const [compareAnchorIndex, setCompareAnchorIndex] = useState<number>(1)
  const [activeScenario, setActiveScenario] = useState<'A' | 'B'>('A')
  const [activeModalDim, setActiveModalDim] = useState<DimensionModalInfo | null>(null)

  const activeDimensions = useMemo(
    () => getDimensionsByPreset(dimensionPreset),
    [dimensionPreset],
  )

  const baseEstimates = useMemo(
    () => buildEstimatesForDimensions(activeDimensions, activePersona),
    [activeDimensions, activePersona],
  )

  const snapshots = useMemo(
    () => buildHistoricalSnapshots(activeDimensions, baseEstimates),
    [activeDimensions, baseEstimates],
  )

  const selectedSnap = useMemo(
    () =>
      snapshots.find((s) => s.snapshotIndex === selectedSnapIndex) ??
      snapshots[snapshots.length - 1]!,
    [snapshots, selectedSnapIndex],
  )

  const anchorSnap = useMemo(
    () =>
      snapshots.find((s) => s.snapshotIndex === compareAnchorIndex) ??
      snapshots[0]!,
    [snapshots, compareAnchorIndex],
  )

  const meanConfPct = useMemo(() => {
    const sum = selectedSnap.estimates.reduce((acc, e) => acc + e.confidence, 0)
    return Math.round((sum / Math.max(1, selectedSnap.estimates.length)) * 100)
  }, [selectedSnap])

  const hatchedCount = useMemo(
    () => selectedSnap.estimates.filter((e) => e.confidence < 0.6).length,
    [selectedSnap],
  )

  const snapshotProvenanceJson = useMemo(
    () => ({
      endpoint: 'GET /v1/dashboard/profile?include_history=true',
      snapshot_id: selectedSnap.snapshotId,
      snapshot_index: selectedSnap.snapshotIndex,
      total_snapshots: snapshots.length,
      recorded_at: selectedSnap.recordedAt,
      model_version: 'sat-jepa-v1.4-quest',
      archetype_cluster: selectedSnap.archetypeLabel,
      cosine_similarity: selectedSnap.cosineSimilarity,
      hysteresis_hold_sessions: `${selectedSnap.hysteresisHoldCount}/3`,
      mean_confidence_pct: meanConfPct,
      hatched_dimensions_count: hatchedCount,
      prev_hash: 'sha256:4a9c8e12b03d...7f19',
      state_hash: `sha256:9f2b7d0${selectedSnap.snapshotIndex}e84...c301`,
    }),
    [selectedSnap, snapshots.length, meanConfPct, hatchedCount],
  )

  return (
    <div className="space-y-8 min-w-0">
      {/* 1. HERO HEADER & PERSONA / STATE SWITCHER */}
      <Card
        as="section"
        aria-labelledby="brain-twin-heading"
        className="p-6 space-y-5 min-w-0"
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="reward" glyph="★">
                Layer A→B Longitudinal Brain Twin · 14 Snapshots
              </Badge>
              <Badge tone="brand" glyph="●">
                Active: Snap #{selectedSnap.snapshotIndex} ({selectedSnap.label})
              </Badge>
              <Badge
                tone={hatchedCount === 0 ? 'success' : 'warning'}
                glyph={hatchedCount === 0 ? '✓' : '⚡'}
              >
                {hatchedCount === 0
                  ? 'All Dimensions ≥60% Conf (Solid)'
                  : `${hatchedCount} Hatched (<60% Conf)`}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono-tabular uppercase tracking-wider text-ink-muted">
              <span className="w-2.5 h-2.5 rounded-full bg-success border border-border-strong inline-block" />
              <span>Archive &amp; Projections · Recovery Calibrated</span>
            </div>
            <h1
              id="brain-twin-heading"
              className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight break-words"
            >
              Longitudinal Brain Twin &amp; Time-Travel Studio
            </h1>
            <DoodleSquiggle className="max-w-xs mt-1" />
            <p className="text-base text-ink-muted">
              Your evolving mental baseline synthesized across 42 days of active micro-sessions. Scrub across 14 historical Brain Twin snapshots, compare checkpoints side-by-side, and inspect how your Clarity Range narrows over time.
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <div className="p-3 rounded-xl border-2 border-border-strong bg-surface-raised flex items-center gap-3 shadow-doodle-sm">
              <span className="text-xl">✨</span>
              <div className="text-start">
                <span className="text-xs font-mono-tabular uppercase tracking-wider text-ink-muted block">
                  Model Confidence
                </span>
                <strong className="text-sm font-bold text-ink">94.2% · High Sync</strong>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                to={`/dimensions/${activeDimensions[0]?.id ?? 'working_memory'}`}
                className="tactile-btn bg-brand text-brand-ink px-3.5 py-2 text-xs font-semibold no-underline inline-flex items-center"
              >
                Inspect {activeDimensions[0]?.code ?? 'WM'} Detail →
              </Link>
              <Link
                to="/coach"
                className="tactile-btn bg-surface text-ink hover:bg-surface-raised px-3 py-2 text-xs font-semibold no-underline inline-flex items-center"
              >
                Open Coach →
              </Link>
            </div>
          </div>
        </div>

        {/* Persona + Preview State Controls */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Select seeded Brain Twin persona"
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="font-mono-tabular text-xs font-semibold text-ink-muted me-1">
              Persona:
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
            aria-label="Brain Twin preview state switcher"
            className="flex flex-wrap items-center gap-1.5"
          >
            {(
              [
                { id: 'live', label: '1 · Snap #14 vs #1 (Live)' },
                { id: 'early-snapshot', label: '2 · Scrub to Snap #1 (Hatched)' },
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
                  if (st.id === 'early-snapshot') {
                    setSelectedSnapIndex(1)
                    setCompareAnchorIndex(14)
                  } else if (st.id === 'live') {
                    setSelectedSnapIndex(14)
                    setCompareAnchorIndex(1)
                  }
                }}
              >
                {st.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* STATE: LOADING SKELETON */}
      {previewState === 'loading' && (
        <Card
          role="status"
          aria-label="Loading historical Brain Twin snapshot chain"
          className="p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold text-ink">
              Reconstructing 14-Snapshot Brain Twin Trajectory (
              <code className="font-mono-tabular">s_1 … s_14</code>)…
            </span>
            <Badge tone="info" glyph="◌">
              Loading Chain
            </Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 h-72 rounded-md border-2 border-border bg-surface-raised" />
            <div className="lg:col-span-5 h-72 rounded-md border-2 border-border bg-surface-raised" />
          </div>
        </Card>
      )}

      {/* STATE: EMPTY (COLD-START 0 SNAPSHOTS) */}
      {previewState === 'empty' && (
        <Card className="p-6 space-y-4">
          <Badge tone="warning" glyph="◌">
            Cold-Start · 0 Snapshots Recorded Yet
          </Badge>
          <h2 className="font-display text-2xl font-bold text-ink">
            Your Longitudinal Brain Twin Timeline Starts After Block #1
          </h2>
          <p className="text-sm text-ink-muted max-w-2xl">
            Complete a 2-minute non-biometric baseline block in the Assessment
            Hub to mint Snapshot #1 and unlock historical time-travel scrubbing.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/assessment"
              className="tactile-btn bg-brand text-brand-ink px-4 py-2.5 text-sm font-semibold no-underline inline-flex items-center"
            >
              Launch First 90s Calibration Block →
            </Link>
            <Button variant="secondary" onClick={() => setPreviewState('live')}>
              Restore 14-Snapshot Demo Chain
            </Button>
          </div>
        </Card>
      )}

      {/* STATE: ERROR BOUNDARY */}
      {previewState === 'error' && (
        <Card
          role="alert"
          className="p-6 border-2 border-danger bg-danger-subtle space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-ink">
              ✕ Historical Snapshot Chain Sync Timeout (HTTP 504)
            </h2>
            <Badge tone="warning" glyph="⚡">
              Local Snapshot Cache Active
            </Badge>
          </div>
          <p className="text-sm text-ink">
            Could not fetch remote snapshot history from{' '}
            <code className="font-mono-tabular">
              GET /v1/dashboard/profile?include_history=true
            </code>
            . Showing the 14-snapshot sample history.
          </p>
          <Button variant="primary" onClick={() => setPreviewState('live')}>
            Retry &amp; Restore Live Scrubber
          </Button>
        </Card>
      )}

      {/* STATE: EXTREME-TEXT STRESS TEST */}
      {previewState === 'extreme-text' && (
        <Card className="p-6 space-y-3 min-w-0">
          <Badge tone="info" glyph="◈">
            365-Day Longitudinal &amp; 10-Dimension Stress Test
          </Badge>
          <h2 className="font-display text-xl font-bold text-ink break-words">
            Snapshot No. 365 (2026-10-24T23:59:59Z) · Multi-Hop Relational &amp;
            Orthogonal Pattern Separation Convergence
          </h2>
          <p className="font-mono-tabular text-lg font-bold text-ink break-words">
            Δc = +18.4% ± 1.2% · Cosine Similarity: 0.942 · Hysteresis Lock:
            14/14 Consecutive Sessions Verified
          </p>
        </Card>
      )}

      {/* MAIN VIEW: LIVE / EARLY SNAPSHOT / EXTREME TEXT */}
      {(previewState === 'live' ||
        previewState === 'early-snapshot' ||
        previewState === 'extreme-text') && (
        <>
          {/* STITCH SCREEN 3 COMPONENT 1: 6-WEEK TRAJECTORY + DAILY FOCUS & ALERTNESS RHYTHM HEATMAP */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Card (7 cols): Growth Curve + 2-Week Future Fan */}
            <div className="lg:col-span-7 bg-surface p-6 rounded-2xl border-2 border-border-strong shadow-doodle flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h2 className="font-display text-xl font-bold text-ink flex items-center gap-2">
                      <span>📈</span>
                      <span>6-Week Trajectory &amp; Future Scenarios</span>
                    </h2>
                    <p className="text-xs text-ink-muted mt-1">
                      Confidence ribbons expanding into probabilistic 14-day projections.
                    </p>
                  </div>
                  <Badge tone="brand" glyph="ℹ">
                    Conditional Scenario, Not a Fixed Prediction
                  </Badge>
                </div>

                {/* Scenario Switchers */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveScenario('A')}
                    className={`px-4 py-2 rounded-xl border-2 border-border-strong text-xs font-bold transition-all shadow-doodle-sm cursor-pointer flex items-center gap-2 ${
                      activeScenario === 'A'
                        ? 'bg-brand text-brand-ink'
                        : 'bg-surface-raised text-ink hover:bg-surface'
                    }`}
                  >
                    <span>⚡</span>
                    <span>Scenario A: 2 mins/day Flow</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveScenario('B')}
                    className={`px-4 py-2 rounded-xl border-2 border-border-strong text-xs font-bold transition-all shadow-doodle-sm cursor-pointer flex items-center gap-2 ${
                      activeScenario === 'B'
                        ? 'bg-brand text-brand-ink'
                        : 'bg-surface-raised text-ink hover:bg-surface'
                    }`}
                  >
                    <span>🌙</span>
                    <span>Scenario B: 2-Week Rest Break</span>
                  </button>
                </div>

                {/* Trajectory SVG Canvas */}
                <div className="relative w-full bg-surface-raised p-4 rounded-xl border-2 border-border-strong space-y-2">
                  <div className="flex justify-between text-xs font-mono-tabular text-ink-muted px-1">
                    <span>W1: 64.0 (Baseline)</span>
                    <span>Today: 82.4</span>
                    <span className="text-success font-bold">
                      {activeScenario === 'A' ? '+2W Target: 87.8' : '+2W Target: 81.2 (Protected)'}
                    </span>
                  </div>

                  <svg
                    viewBox="0 0 700 240"
                    className="w-full h-56 text-ink"
                    fill="none"
                    aria-label="Brain Twin 6-week longitudinal trajectory and scenario fan projection"
                  >
                    <defs>
                      <pattern
                        id="longitudinalGrid"
                        width="70"
                        height="40"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 70 0 L 0 0 0 40"
                          fill="none"
                          stroke="currentColor"
                          strokeDasharray="2 3"
                          strokeOpacity="0.12"
                          strokeWidth="0.75"
                        />
                      </pattern>
                      <linearGradient id="band95Grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0.08" />
                      </linearGradient>
                      <linearGradient id="band50Grad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0.20" />
                      </linearGradient>
                    </defs>

                    <rect width="700" height="240" fill="url(#longitudinalGrid)" />

                    {/* Baseline Divider */}
                    <line
                      x1="490"
                      y1="10"
                      x2="490"
                      y2="230"
                      stroke="currentColor"
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />
                    <text
                      x="495"
                      y="24"
                      className="font-mono text-xs fill-current"
                      fontSize="10"
                    >
                      NOW (WEEK 6)
                    </text>

                    {/* Scenario A vs B Paths */}
                    {activeScenario === 'A' ? (
                      <>
                        <path
                          d="M 490 85 Q 580 60 670 42 L 670 148 Q 580 115 490 85 Z"
                          fill="url(#band95Grad)"
                          stroke="currentColor"
                          strokeDasharray="3 3"
                          strokeWidth="1"
                        />
                        <path
                          d="M 490 85 Q 580 72 670 58 L 670 118 Q 580 98 490 85 Z"
                          fill="url(#band50Grad)"
                        />
                        <path
                          d="M 490 85 Q 580 75 670 65"
                          stroke="var(--color-brand)"
                          strokeDasharray="5 4"
                          strokeLinecap="round"
                          strokeWidth="3"
                        />
                        <circle
                          cx="670"
                          cy="65"
                          r="5"
                          fill="var(--color-success)"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </>
                    ) : (
                      <>
                        <path
                          d="M 490 85 Q 580 82 670 82 L 670 135 Q 580 110 490 85 Z"
                          fill="url(#band95Grad)"
                          stroke="currentColor"
                          strokeDasharray="3 3"
                          strokeWidth="1"
                        />
                        <path
                          d="M 490 85 Q 580 86 670 88 L 670 118 Q 580 102 490 85 Z"
                          fill="url(#band50Grad)"
                        />
                        <path
                          d="M 490 85 Q 580 88 670 94"
                          stroke="var(--color-brand)"
                          strokeDasharray="5 4"
                          strokeLinecap="round"
                          strokeWidth="3"
                        />
                        <circle
                          cx="670"
                          cy="94"
                          r="5"
                          fill="var(--color-brand)"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </>
                    )}

                    {/* Historical 6-Week Narrowing Confidence Band */}
                    <path
                      d="M 40 185 Q 120 160 210 140 T 350 105 T 490 85 L 490 85 T 350 115 T 210 162 T 40 210 Z"
                      fill="currentColor"
                      fillOpacity="0.08"
                    />

                    {/* Historical Solid Median Trajectory Line */}
                    <path
                      d="M 40 198 Q 120 172 210 151 T 350 110 T 490 85"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="3"
                    />

                    {/* Data nodes W1 to W6 */}
                    <circle cx="40" cy="198" r="4.5" fill="var(--color-surface)" stroke="currentColor" strokeWidth="2.5" />
                    <circle cx="130" cy="176" r="4.5" fill="var(--color-surface)" stroke="currentColor" strokeWidth="2.5" />
                    <circle cx="220" cy="148" r="4.5" fill="var(--color-surface)" stroke="currentColor" strokeWidth="2.5" />
                    <circle cx="310" cy="122" r="4.5" fill="var(--color-surface)" stroke="currentColor" strokeWidth="2.5" />
                    <circle cx="400" cy="104" r="4.5" fill="var(--color-surface)" stroke="currentColor" strokeWidth="2.5" />
                    <circle cx="490" cy="85" r="6" fill="var(--color-brand)" stroke="currentColor" strokeWidth="2.5" />
                  </svg>
                </div>
              </div>

              {/* Legend & Explanation */}
              <div className="p-4 rounded-xl border border-border-strong bg-surface-raised flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 font-mono-tabular font-bold text-ink">
                    <span className="w-3.5 h-3.5 bg-brand border border-border-strong rounded-sm inline-block" />
                    <span>50% Probable</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono-tabular font-bold text-ink">
                    <span className="w-3.5 h-3.5 bg-brand/30 border border-border-strong rounded-sm inline-block" />
                    <span>95% Outer Envelope</span>
                  </div>
                </div>
                <p className="text-ink text-start sm:text-end max-w-sm">
                  {activeScenario === 'A'
                    ? 'Continuing regular 2-min sessions narrows cognitive variance and guards peak recall by +5.4 pts.'
                    : 'Scheduled 2-week rest preserves baseline memory with 0% streak penalty, stabilizing neural reserve.'}
                </p>
              </div>
            </div>

            {/* Right Card (5 cols): Daily Focus & Alertness Rhythm Heatmap */}
            <div className="lg:col-span-5 bg-surface p-6 rounded-2xl border-2 border-border-strong shadow-doodle flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h2 className="font-display text-xl font-bold text-ink flex items-center gap-2">
                    <span>🌤️</span>
                    <span>Focus &amp; Alertness Rhythm</span>
                  </h2>
                  <Badge tone="neutral" glyph="⏱">
                    7-Day × Dayparts
                  </Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  Reaction stability matrix calibrated from 124 passive device latency samples.
                </p>
              </div>

              {/* Heatmap Grid */}
              <div className="space-y-2 bg-surface-raised p-4 rounded-xl border-2 border-border-strong">
                <div className="grid grid-cols-8 gap-1.5 text-center font-mono-tabular text-xs font-bold text-ink-muted">
                  <span />
                  <span>M</span>
                  <span>T</span>
                  <span>W</span>
                  <span>T</span>
                  <span>F</span>
                  <span>S</span>
                  <span>S</span>
                </div>

                {/* Morning Row */}
                <div className="grid grid-cols-8 gap-1.5 items-center">
                  <span className="font-mono-tabular text-xs font-bold text-ink truncate">Morn</span>
                  <div className="h-9 rounded-lg border border-border-strong bg-brand text-brand-ink flex items-center justify-center font-mono-tabular text-xs font-bold">86</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-brand text-brand-ink flex items-center justify-center font-mono-tabular text-xs font-bold">88</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-brand text-brand-ink flex items-center justify-center font-mono-tabular text-xs font-bold">84</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-brand text-brand-ink flex items-center justify-center font-mono-tabular text-xs font-bold">89</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-success text-brand-ink flex items-center justify-center font-mono-tabular text-xs font-bold shadow-xs">92</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-surface-raised text-ink flex items-center justify-center font-mono-tabular text-xs font-medium">74</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-surface-raised text-ink flex items-center justify-center font-mono-tabular text-xs font-medium">71</div>
                </div>

                {/* Afternoon Row */}
                <div className="grid grid-cols-8 gap-1.5 items-center">
                  <span className="font-mono-tabular text-xs font-bold text-ink truncate">Aftn</span>
                  <div className="h-9 rounded-lg border border-border-strong bg-brand text-brand-ink flex items-center justify-center font-mono-tabular text-xs font-bold">79</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-brand text-brand-ink flex items-center justify-center font-mono-tabular text-xs font-bold">81</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-surface-raised text-ink flex items-center justify-center font-mono-tabular text-xs font-medium">73</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-brand text-brand-ink flex items-center justify-center font-mono-tabular text-xs font-bold">78</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-surface-raised text-ink flex items-center justify-center font-mono-tabular text-xs font-medium">72</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-surface text-ink-muted flex items-center justify-center font-mono-tabular text-xs">66</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-surface text-ink-muted flex items-center justify-center font-mono-tabular text-xs">68</div>
                </div>

                {/* Evening Row */}
                <div className="grid grid-cols-8 gap-1.5 items-center">
                  <span className="font-mono-tabular text-xs font-bold text-ink truncate">Eve</span>
                  <div className="h-9 rounded-lg border border-border-strong bg-surface text-ink-muted flex items-center justify-center font-mono-tabular text-xs">62</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-surface text-ink-muted flex items-center justify-center font-mono-tabular text-xs">59</div>
                  <div className="h-9 rounded-lg border-2 border-border-strong bg-reward text-reward-ink flex items-center justify-center font-mono-tabular text-xs font-bold shadow-xs">48</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-surface text-ink-muted flex items-center justify-center font-mono-tabular text-xs">61</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-surface text-ink-muted flex items-center justify-center font-mono-tabular text-xs">54</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-surface text-ink-muted flex items-center justify-center font-mono-tabular text-xs">50</div>
                  <div className="h-9 rounded-lg border border-border-strong bg-surface text-ink-muted flex items-center justify-center font-mono-tabular text-xs">52</div>
                </div>
              </div>

              {/* Rhythm Insights */}
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-lg border border-border-strong bg-surface-raised flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-success border border-border-strong shrink-0" />
                  <span className="font-bold text-ink">Morning Peak: 88% Flow (08:30 – 11:45)</span>
                </div>
                <div className="p-3 rounded-lg border border-border-strong bg-reward-subtle flex items-center gap-2">
                  <span className="text-base shrink-0">🌙</span>
                  <span className="font-bold text-ink">Late Evening: Rest Recommended by Brian</span>
                </div>
              </div>
            </div>
          </div>

          {/* STITCH SCREEN 3 COMPONENT 2: 6 CORE COGNITIVE DIMENSIONS (2x3 RESPONSIVE GRID) */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="font-display text-2xl font-bold text-ink flex items-center gap-2">
                  <span>🧠</span>
                  <span>6 Core Cognitive Dimensions</span>
                </h2>
                <p className="text-sm text-ink-muted">
                  Continuous percentile range relative to your unique 6-week baseline stability.
                </p>
              </div>
              <span className="text-xs font-mono-tabular text-ink-muted">
                Tap <strong>[How this works]</strong> on any card for telemetry calibration notes
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(DIMENSION_DEEP_DIVES).map(([key, info]) => (
                <div
                  key={key}
                  className="bg-surface p-5 rounded-2xl border-2 border-border-strong shadow-doodle flex flex-col justify-between gap-4 hover:-translate-y-0.5 transition-transform"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg border-2 border-border-strong bg-brand text-brand-ink font-mono-tabular text-xs font-bold flex items-center justify-center">
                          {info.glyph}
                        </span>
                        <h3 className="font-display text-base font-bold text-ink">
                          {info.title}
                        </h3>
                      </div>
                      <span className="font-mono-tabular text-sm font-bold text-brand">
                        {info.scoreRange}
                      </span>
                    </div>
                    <p className="text-xs text-ink font-medium border-s-2 border-brand ps-2.5">
                      “{info.quote}”
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-border-strong/40 text-xs">
                    <span className="font-mono-tabular text-ink-muted">{info.tag}</span>
                    <button
                      type="button"
                      onClick={() => setActiveModalDim(info)}
                      className="font-bold text-brand hover:underline cursor-pointer"
                    >
                      How this works
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SIGNATURE #2 <BrainTwinTimeTravel /> + TIME-SCRUBBED RADAR & PROVENANCE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left 7 Columns: Signature #2 <BrainTwinTimeTravel /> + 2D Manifold */}
            <div className="lg:col-span-7 min-w-0 flex flex-col justify-between gap-6">
              <BrainTwinTimeTravel
                snapshots={snapshots}
                dimensions={activeDimensions}
                selectedSnapIndex={selectedSnap.snapshotIndex}
                onSelectSnapIndex={setSelectedSnapIndex}
                compareAnchorIndex={anchorSnap.snapshotIndex}
                onSelectCompareAnchorIndex={setCompareAnchorIndex}
              />
            </div>

            {/* Right 5 Columns: Time-Scrubbed <UncertaintyRadar /> + Milestone Cadence + Cryptographic Provenance Card */}
            <div className="lg:col-span-5 min-w-0 flex flex-col justify-between gap-6">
              <UncertaintyRadar
                dimensions={activeDimensions}
                estimates={selectedSnap.estimates}
                title={`Time-Scrubbed Radar · Snap #${selectedSnap.snapshotIndex} (${selectedSnap.shortDate})`}
              />

              <Card
                as="section"
                aria-labelledby="milestone-cadence-heading"
                className="p-5 space-y-3 min-w-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2
                    id="milestone-cadence-heading"
                    className="font-display text-base font-bold text-ink"
                  >
                    Snapshot Milestone &amp; QUEST+ Cadence
                  </h2>
                  <Badge tone="reward" glyph="★">
                    {selectedSnap.milestoneTag}
                  </Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  Each snapshot records a non-biometric 90-second calibration
                  checkpoint and updates the posterior confidence intervals (
                  <code className="font-mono-tabular">±CI</code>) across all{' '}
                  {activeDimensions.length} active dimensions.
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono-tabular">
                  <div className="rounded-sm border border-border bg-canvas p-2.5">
                    <span className="text-ink-muted block">Checkpoint</span>
                    <strong className="text-ink">
                      #{selectedSnap.snapshotIndex} / {snapshots.length}
                    </strong>
                  </div>
                  <div className="rounded-sm border border-border bg-canvas p-2.5">
                    <span className="text-ink-muted block">Mean Conf</span>
                    <strong className="text-ink">{meanConfPct}%</strong>
                  </div>
                  <div className="rounded-sm border border-border bg-canvas p-2.5">
                    <span className="text-ink-muted block">Hysteresis</span>
                    <strong className="text-ink">
                      {selectedSnap.hysteresisHoldCount}/3 Sessions
                    </strong>
                  </div>
                </div>
              </Card>

              <Card
                as="section"
                aria-labelledby="snapshot-provenance-heading"
                className="p-5 space-y-3.5 min-w-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2
                      id="snapshot-provenance-heading"
                      className="font-display text-base font-bold text-ink"
                    >
                      Cryptographic Snapshot Provenance &amp; Audit
                    </h2>
                    <p className="text-xs text-ink-muted">
                      Immutable hash chain for Snapshot #
                      {selectedSnap.snapshotIndex} ({selectedSnap.snapshotId}).
                    </p>
                  </div>
                  <Badge tone="info" glyph="✓">
                    SHA-256 Verified
                  </Badge>
                </div>

                <pre
                  tabIndex={0}
                  role="region"
                  aria-label="Snapshot cryptographic provenance JSON payload"
                  className="focus-ring rounded-sm border border-border bg-canvas p-3 text-xs font-mono-tabular text-ink overflow-x-auto whitespace-pre-wrap break-words max-h-48"
                >
                  <code>{JSON.stringify(snapshotProvenanceJson, null, 2)}</code>
                </pre>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <Link
                    to="/privacy"
                    className="font-semibold text-brand hover:underline"
                  >
                    Manage Retention &amp; Export in Privacy Center →
                  </Link>
                  <span className="font-mono-tabular text-ink-muted">
                    Model: sat-jepa-v1.4
                  </span>
                </div>
              </Card>
            </div>
          </div>

          {/* ROW 2: LONGITUDINAL EXPLAINABILITY (<WhyThisPanel /> + Brian Companion Note) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 min-w-0 flex flex-col justify-between gap-4">
              <WhyThisPanel
                trail={SAMPLE_WHY_THIS_TRAIL}
                title={`Why Your Twin Shifted Between Snap #${anchorSnap.snapshotIndex} and Snap #${selectedSnap.snapshotIndex} (5-Part Trail)`}
                defaultExpanded
              />
            </div>

            <div className="lg:col-span-5 min-w-0 flex flex-col justify-between gap-4">
              {showMascot && (
                <div className="rounded-2xl border-2 border-border-strong bg-surface p-5 shadow-doodle flex flex-col sm:flex-row items-center gap-4">
                  <BrianMascot
                    pose={selectedSnap.snapshotIndex >= 11 ? 'celebrating' : 'explorer'}
                    scale="telemetry"
                    showHalo
                    haloColor={selectedSnap.snapshotIndex >= 11 ? 'reward' : 'brand'}
                    statusPip="active"
                  />
                  <div className="space-y-1 text-start">
                    <span className="font-mono-tabular text-xs uppercase tracking-wider text-brand font-bold block">
                      Brian Companion · Snap #{selectedSnap.snapshotIndex}
                    </span>
                    <p className="text-xs text-ink leading-relaxed">
                      “Between Snapshot #{anchorSnap.snapshotIndex} ({anchorSnap.shortDate}) and Snapshot #{selectedSnap.snapshotIndex} ({selectedSnap.shortDate}), your mean epistemic confidence reached {meanConfPct}% across {activeDimensions.length} dimensions. Scrub back to Snap #1 anytime to see how wide your initial uncertainty bands were!”
                    </p>
                  </div>
                </div>
              )}

              {/* Artisanal Journal Prompt Note */}
              <div className="p-4 rounded-xl border-2 border-border-strong bg-surface-raised flex flex-col sm:flex-row items-center justify-between gap-3 shadow-doodle-sm">
                <div className="flex items-center gap-3 text-start">
                  <span className="text-2xl">📝</span>
                  <div>
                    <strong className="text-sm font-bold text-ink block">
                      Brian's Synthesis Note
                    </strong>
                    <span className="text-xs text-ink-muted">
                      “Your focus rhythm has consolidated by 14% since Week 2. Wednesday restful dips are healthy and protective.”
                    </span>
                  </div>
                </div>
                <Link
                  to="/privacy"
                  className="tactile-btn bg-surface text-ink hover:bg-surface-raised px-3.5 py-1.5 text-xs font-bold no-underline shrink-0"
                >
                  Export Twin Snapshot
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Interactive Modal Dialogue for Dimension Info */}
      {activeModalDim && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-dim-title"
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="max-w-md w-full bg-surface p-6 rounded-2xl border-2 border-border-strong shadow-doodle-lg space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg border-2 border-border-strong bg-brand text-brand-ink font-mono-tabular text-xs font-bold flex items-center justify-center">
                  {activeModalDim.glyph}
                </span>
                <h3 id="modal-dim-title" className="font-display text-lg font-bold text-ink">
                  {activeModalDim.title} Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalDim(null)}
                aria-label="Close details"
                className="w-8 h-8 rounded-lg border border-border-strong bg-surface-raised flex items-center justify-center text-ink hover:bg-surface cursor-pointer"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <p className="text-sm text-ink leading-relaxed">
              {activeModalDim.howItWorks}
            </p>

            <div className="p-3 rounded-lg border border-border-strong bg-surface-raised text-xs font-mono-tabular text-ink flex items-center gap-2">
              <span className="text-success font-bold">✓</span>
              <span>Device jitter, touch bias, and sleep latency filtered automatically.</span>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveModalDim(null)}
              >
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
