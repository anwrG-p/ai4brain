import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getDimensionsByPreset } from '../config/dimensions'
import {
  buildEstimatesForDimensions,
  SAMPLE_WHY_THIS_TRAIL,
} from '../services/mocks/fixtures'
import { useAppStore, type PersonaId } from '../state/useAppStore'
import { UncertaintyRadar } from '../components/features/radar/UncertaintyRadar'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { Mascot, type MascotState } from '../components/features/brand/Mascot'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'

type RevealViewState =
  | 'calibrated'
  | 'low-confidence'
  | 'partial'
  | 'empty'
  | 'loading'
  | 'error'
  | 'extreme-text'

type DimensionFilterMode = 'all' | 'calibrated-only' | 'hatched-only'

export default function ProfileRevealPage() {
  const navigate = useNavigate()
  const {
    dimensionPreset,
    activePersona,
    setActivePersona,
    showMascot,
    setShowMascot,
    consentPreferences,
  } = useAppStore()

  const initialViewState: RevealViewState =
    activePersona === 'new-user'
      ? 'empty'
      : activePersona === 'noisy-low-confidence'
        ? 'low-confidence'
        : activePersona === 'edge-missing-dim'
          ? 'partial'
          : 'calibrated'

  const [viewState, setViewState] = useState<RevealViewState>(initialViewState)
  const [filterMode, setFilterMode] = useState<DimensionFilterMode>('all')
  const [mascotOverride, setMascotOverride] = useState<MascotState | null>(null)
  const [showSnapshotJson, setShowSnapshotJson] = useState(false)

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

  const assessedEstimates = useMemo(
    () => estimates.filter((e) => e.scorePct !== null),
    [estimates],
  )

  const overallConfidencePct = useMemo(() => {
    if (assessedEstimates.length === 0) return 0
    const sum = assessedEstimates.reduce((acc, e) => acc + e.confidence, 0)
    return Math.round((sum / assessedEstimates.length) * 100)
  }, [assessedEstimates])

  const sortedByScore = useMemo(
    () =>
      [...assessedEstimates].sort(
        (a, b) => (b.scorePct ?? 0) - (a.scorePct ?? 0),
      ),
    [assessedEstimates],
  )

  const topAnchorEstimate = sortedByScore[0]
  const secondAnchorEstimate = sortedByScore[1] ?? sortedByScore[0]

  const calibrationTargetEstimate = useMemo(() => {
    const missing = estimates.find((e) => e.scorePct === null)
    if (missing) return missing
    const hatched = [...estimates]
      .filter((e) => e.isLowConfidence)
      .sort((a, b) => a.confidence - b.confidence)[0]
    if (hatched) return hatched
    return [...assessedEstimates].sort((a, b) => a.confidence - b.confidence)[0]
  }, [estimates, assessedEstimates])

  const getDimMeta = (dimId: string | undefined) =>
    activeDimensions.find((d) => d.id === dimId) ?? activeDimensions[0]

  const topAnchorMeta = getDimMeta(topAnchorEstimate?.dimensionId)
  const secondAnchorMeta = getDimMeta(secondAnchorEstimate?.dimensionId)
  const calibrationTargetMeta = getDimMeta(
    calibrationTargetEstimate?.dimensionId,
  )

  const defaultMascotState: MascotState =
    viewState === 'low-confidence'
      ? 'rest'
      : viewState === 'partial' || viewState === 'loading'
        ? 'thinking'
        : viewState === 'empty'
          ? 'hello'
          : 'celebrate'

  const activeMascotState: MascotState = mascotOverride ?? defaultMascotState

  const filteredDimensions = useMemo(() => {
    return activeDimensions.filter((dim) => {
      const est = estimates.find((e) => e.dimensionId === dim.id)
      if (!est) return true
      if (filterMode === 'calibrated-only') {
        return est.scorePct !== null && !est.isLowConfidence
      }
      if (filterMode === 'hatched-only') {
        return est.scorePct === null || est.isLowConfidence
      }
      return true
    })
  }, [activeDimensions, estimates, filterMode])

  const handleSelectViewState = (next: RevealViewState) => {
    setViewState(next)
    setMascotOverride(null)
    if (next === 'calibrated') setActivePersona('steady-improver')
    else if (next === 'low-confidence')
      setActivePersona('noisy-low-confidence')
    else if (next === 'partial') setActivePersona('edge-missing-dim')
    else if (next === 'empty') setActivePersona('new-user')
  }

  const snapshotPayloadPreview = useMemo(
    () => ({
      snapshotId:
        viewState === 'low-confidence'
          ? 'SNAP-2026-SALMA-01'
          : 'SNAP-2026-YOUSSEF-14',
      consentReceiptId: consentPreferences.consentReceiptId,
      nonBiometricMode: true,
      satJepaArchetype:
        viewState === 'low-confidence'
          ? {
              clusterId: 'C2-PROVISIONAL',
              label: 'Exploratory Fast-Responder (Hatched)',
              prototypeDeltaC: '+0.09',
              hysteresisStableSessions: '1/3 (Provisional)',
            }
          : {
              clusterId: 'C5-CONFIRMED',
              label: 'Analytical Pattern Builder',
              prototypeDeltaC: '+0.18',
              hysteresisStableSessions: '3/3 (Confirmed Lock)',
            },
      overallConfidencePct,
      dimensionCount: activeDimensions.length,
      estimates: estimates.map((e) => ({
        dim: e.dimensionId,
        scorePct: e.scorePct,
        ci95: `±${Math.round((e.ciUpperPct - e.ciLowerPct) / 2)}%`,
        confidence: `${Math.round(e.confidence * 100)}%`,
        isHatched: e.isLowConfidence,
      })),
    }),
    [
      viewState,
      consentPreferences.consentReceiptId,
      overallConfidencePct,
      activeDimensions.length,
      estimates,
    ],
  )

  return (
    <div className="space-y-8 min-w-0">
      {/* 1. PROFILE REVEAL HERO HEADER + STATE SWITCHER */}
      <Card
        as="section"
        aria-labelledby="reveal-hero-heading"
        className="p-6 space-y-5 min-w-0"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="reward" glyph="★">
                Brain Twin Snapshot Unlocked · Non-Clinical Synthesis
              </Badge>
              <Badge
                tone={overallConfidencePct >= 60 ? 'brand' : 'low-confidence'}
                glyph={overallConfidencePct >= 60 ? '●' : '▨'}
              >
                Overall Confidence: {overallConfidencePct}%
              </Badge>
              <Badge tone="info" glyph="◈">
                {activeDimensions.length} Active Dimensions
              </Badge>
            </div>
            <h1
              id="reveal-hero-heading"
              className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight"
            >
              Meet your initial Cognitive Twin—calibrated strengths, honest
              confidence bands, and your first 2-minute next step.
            </h1>
            <DoodleSquiggle className="max-w-xs mt-1" />
            <p className="text-base text-ink-muted">
              Your scores are evolving percentage estimates with a 95%
              confidence interval (<code className="font-mono-tabular">±CI</code>
              )—never a fixed label or clinical test. Solid bands mark stable
              timing; diagonally hatched bands simply need 1–2 more micro-blocks
              to narrow their range.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              onClick={() => navigate('/dashboard')}
            >
              Open Full Command Dashboard →
            </Button>
            <Button
              variant="secondary"
              aria-pressed={showMascot}
              onClick={() => setShowMascot(!showMascot)}
            >
              {showMascot ? '✦ Companion Guide: ON' : '◌ Companion Guide: OFF'}
            </Button>
            <Link
              to="/onboarding"
              className="tactile-btn bg-surface text-ink hover:bg-surface-raised px-4 py-2 text-sm font-semibold no-underline inline-flex items-center"
            >
              ← Calibration Setup
            </Link>
          </div>
        </div>

        {/* Persona & Edge-State Switcher Bar */}
        <div
          role="group"
          aria-label="Profile reveal persona and state switcher"
          className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                {
                  id: 'calibrated',
                  label: 'Calibrated Reveal (Youssef · 84%)',
                },
                {
                  id: 'low-confidence',
                  label: 'First-Session Hatched (Salma · 54%)',
                },
                { id: 'partial', label: 'Partial (1 Unassessed Dim)' },
                { id: 'empty', label: 'Empty (0 Trials)' },
                { id: 'loading', label: 'Synthesizing Skeleton' },
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

          {/* Mascot 5-State Interactive Preview Switcher */}
          {showMascot && (
            <div
              role="group"
              aria-label="Mascot companion state preview"
              className="flex flex-wrap items-center gap-1"
            >
              <span className="font-mono-tabular text-xs text-ink-muted me-1">
                Mascot State:
              </span>
              {(
                ['idle', 'hello', 'thinking', 'celebrate', 'rest'] as const
              ).map((mState) => (
                <Button
                  key={mState}
                  size="sm"
                  variant={
                    activeMascotState === mState ? 'reward' : 'secondary'
                  }
                  aria-pressed={activeMascotState === mState}
                  onClick={() => setMascotOverride(mState)}
                >
                  {mState}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* STATE: LOADING SKELETON */}
      {viewState === 'loading' && (
        <Card
          role="status"
          aria-label="Synthesizing cognitive twin reveal"
          className="p-6 space-y-6"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold text-ink">
              Synthesizing SAT-JEPA Latent Trajectory &amp; 95% Confidence
              Intervals…
            </span>
            <Badge tone="info" glyph="◌">
              QUEST+ Posterior Convergence
            </Badge>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 h-72 rounded-md border-2 border-border bg-surface-raised p-5 flex flex-col justify-between">
              <div className="h-6 w-56 rounded-sm bg-canvas" />
              <div className="h-32 w-full rounded-sm bg-canvas" />
              <div className="h-6 w-48 rounded-sm bg-canvas" />
            </div>
            <div className="lg:col-span-5 h-72 rounded-md border-2 border-border bg-surface-raised p-5 flex flex-col justify-between">
              <div className="h-6 w-48 rounded-sm bg-canvas" />
              <div className="h-44 w-44 mx-auto rounded-pill border-4 border-border" />
              <div className="h-4 w-40 rounded-sm bg-canvas" />
            </div>
          </div>
        </Card>
      )}

      {/* STATE: EMPTY (0 TRIALS) */}
      {viewState === 'empty' && (
        <Card className="p-8 text-center space-y-4">
          {showMascot && (
            <div className="flex justify-center">
              <Mascot state="hello" size="lg" />
            </div>
          )}
          <Badge tone="reward" glyph="★">
            Awaiting Initial 2-Minute Baseline
          </Badge>
          <h2 className="font-display text-2xl font-bold text-ink">
            Complete 3 quick micro-trials per dimension to unlock your Profile
            Reveal
          </h2>
          <p className="text-sm text-ink-muted max-w-xl mx-auto">
            Your Brain Twin never guesses without telemetry. Run the 2-minute
            non-biometric baseline or load a pre-calibrated demo reveal below.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/onboarding"
              className="tactile-btn bg-brand text-brand-ink px-5 py-3 text-base font-semibold no-underline inline-flex items-center"
            >
              Start 2-Minute Quick Baseline →
            </Link>
            <Button
              variant="secondary"
              onClick={() => handleSelectViewState('calibrated')}
            >
              Preview Calibrated Reveal Snapshot
            </Button>
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
              ✕ Snapshot Synthesis Interrupted (`/v1/dashboard/profile`)
            </h2>
            <Badge tone="danger" glyph="!">
              Retry Ready
            </Badge>
          </div>
          <p className="text-sm text-ink">
            Your baseline trial events are safely stored in your local browser
            buffer. Click below to re-synthesize your initial Cognitive Twin
            snapshot.
          </p>
          <Button
            variant="primary"
            onClick={() => handleSelectViewState('calibrated')}
          >
            Re-Synthesize Profile Reveal
          </Button>
        </Card>
      )}

      {/* STATE: EXTREME VALUES STRESS TEST */}
      {viewState === 'extreme-text' && (
        <Card className="p-6 space-y-3 min-w-0">
          <Badge tone="info" glyph="◈">
            Extreme Telemetry &amp; 200% Zoom Stress Test
          </Badge>
          <h2 className="font-display text-xl font-bold text-ink break-words">
            Cross-Modal Executive Set-Shifting &amp; High-Interference Episodic
            Lure Discrimination Composite Archetype
          </h2>
          <p className="font-mono-tabular text-2xl font-bold text-ink">
            99.9% ± 0.1% · Δc = +0.994 · 142,850 Trials · Jitter: 0.4 ms
          </p>
        </Card>
      )}

      {/* MAIN REVEAL SYNTHESIS GRID (Calibrated, Low-Confidence Hatched, Partial) */}
      {(viewState === 'calibrated' ||
        viewState === 'low-confidence' ||
        viewState === 'partial') && (
        <>
          <section
            aria-labelledby="reveal-synthesis-heading"
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
          >
            <h2 id="reveal-synthesis-heading" className="sr-only">
              Archetype Discovery, Companion Guide, and Initial Uncertainty
              Radar
            </h2>

            {/* Left 7 Columns: Archetype Discovery + Mascot + Top Anchors vs Calibration Opportunity + First Coach Step */}
            <div className="lg:col-span-7 min-w-0 flex flex-col justify-between gap-4">
              <Card className="p-6 space-y-5 min-w-0">
                {/* Mascot Companion Banner */}
                {showMascot && (
                  <Mascot
                    state={activeMascotState}
                    size="md"
                    title={
                      viewState === 'low-confidence'
                        ? 'Synapse Companion · Rest & Morning Calibration Recommended'
                        : viewState === 'partial'
                          ? 'Synapse Companion · 1 Dimension Remaining for Full 360° Twin'
                          : 'Synapse Companion · Initial Cognitive Twin Calibrated!'
                    }
                    badgeLabel={`State: ${activeMascotState}`}
                    message={
                      viewState === 'low-confidence'
                        ? '“Great effort completing your baseline! Because several trials showed evening response-time jitter (195 ms), we marked 4 dimensions with honest diagonal hatching (±16%). A rested 2-minute morning session will cut those bands in half.”'
                        : viewState === 'partial'
                          ? '“Your calibrated dimensions already show strong stability (±5% to ±7%). Whenever you have 90 seconds, complete Divided Perceptual Speed to close the remaining unassessed vertex.”'
                          : '“Your response timing across Attention Networks and Visuospatial Planning is remarkably steady! Let’s use that anchor to graduate Episodic Pattern Separation from hatched (48% conf) to solid.”'
                    }
                  />
                )}

                {/* SAT-JEPA Archetype Discovery Card */}
                <div className="rounded-md border-2 border-border-strong bg-canvas p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono-tabular text-xs font-bold uppercase tracking-wider text-ink-muted">
                      SAT-JEPA Latent Archetype Discovery
                    </span>
                    <Badge
                      tone={
                        viewState === 'low-confidence'
                          ? 'low-confidence'
                          : 'reward'
                      }
                      glyph={viewState === 'low-confidence' ? '▨' : '★'}
                    >
                      {viewState === 'low-confidence'
                        ? 'Provisional Cluster C2 · Hatched'
                        : 'Confirmed Cluster C5 · Hysteresis Locked'}
                    </Badge>
                  </div>

                  <h3 className="font-display text-2xl font-bold text-ink">
                    {viewState === 'low-confidence'
                      ? 'Exploratory Fast-Responder (Preliminary Profile)'
                      : 'Analytical Pattern Builder'}
                  </h3>

                  <p className="text-sm text-ink-muted">
                    {viewState === 'low-confidence'
                      ? 'Fast initial target detection paired with wider confidence intervals (±16%) during late-window blocks. Archetype label remains provisional until 2 consecutive low-jitter sessions confirm stability.'
                      : 'Consistent working-memory updating and low rule-switch cost (+62 ms) across dual-stream blocks. Confirmed across 3 consecutive sessions via SAT-JEPA hysteresis protection.'}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs font-mono-tabular">
                    <div className="rounded-sm border border-border bg-surface p-2.5">
                      <span className="text-ink-muted block">
                        Prototype Vector (Δc)
                      </span>
                      <strong className="text-ink">
                        {viewState === 'low-confidence'
                          ? '+0.09 (Preliminary)'
                          : '+0.18 (Dual-Stream)'}
                      </strong>
                    </div>
                    <div className="rounded-sm border border-border bg-surface p-2.5">
                      <span className="text-ink-muted block">
                        Hysteresis Stability
                      </span>
                      <strong className="text-ink">
                        {viewState === 'low-confidence'
                          ? '1 / 3 Sessions (Unconfirmed)'
                          : '3 / 3 Sessions (Locked)'}
                      </strong>
                    </div>
                    <div className="rounded-sm border border-border bg-surface p-2.5">
                      <span className="text-ink-muted block">
                        Telemetry Mode
                      </span>
                      <strong className="text-ink">
                        Non-Biometric (RT + Jitter)
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Top 2 Calibrated Anchors vs Top 1 Calibration Target */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {topAnchorEstimate && topAnchorMeta && (
                    <div className="rounded-md border-2 border-border bg-surface p-3.5 space-y-1.5 min-w-0">
                      <Badge tone="brand" glyph={topAnchorMeta.markerGlyph}>
                        Top Anchor #1
                      </Badge>
                      <h4 className="font-display text-base font-bold text-ink break-words">
                        {topAnchorMeta.name}
                      </h4>
                      <p className="font-mono-tabular text-xl font-bold text-ink">
                        {topAnchorEstimate.scorePct}%{' '}
                        <span className="text-xs font-normal text-ink-muted">
                          ±{' '}
                          {Math.round(
                            (topAnchorEstimate.ciUpperPct -
                              topAnchorEstimate.ciLowerPct) /
                              2,
                          )}
                          %
                        </span>
                      </p>
                      <p className="text-xs text-ink-muted">
                        Confidence: {Math.round(topAnchorEstimate.confidence * 100)}%
                      </p>
                    </div>
                  )}

                  {secondAnchorEstimate && secondAnchorMeta && (
                    <div className="rounded-md border-2 border-border bg-surface p-3.5 space-y-1.5 min-w-0">
                      <Badge tone="info" glyph={secondAnchorMeta.markerGlyph}>
                        Top Anchor #2
                      </Badge>
                      <h4 className="font-display text-base font-bold text-ink break-words">
                        {secondAnchorMeta.name}
                      </h4>
                      <p className="font-mono-tabular text-xl font-bold text-ink">
                        {secondAnchorEstimate.scorePct}%{' '}
                        <span className="text-xs font-normal text-ink-muted">
                          ±{' '}
                          {Math.round(
                            (secondAnchorEstimate.ciUpperPct -
                              secondAnchorEstimate.ciLowerPct) /
                              2,
                          )}
                          %
                        </span>
                      </p>
                      <p className="text-xs text-ink-muted">
                        Confidence:{' '}
                        {Math.round(secondAnchorEstimate.confidence * 100)}%
                      </p>
                    </div>
                  )}

                  {calibrationTargetEstimate && calibrationTargetMeta && (
                    <div className="rounded-md border-2 border-dashed border-border-strong bg-surface-raised p-3.5 space-y-1.5 min-w-0">
                      <Badge
                        tone="low-confidence"
                        glyph={calibrationTargetMeta.markerGlyph}
                      >
                        Next to Calibrate
                      </Badge>
                      <h4 className="font-display text-base font-bold text-ink break-words">
                        {calibrationTargetMeta.name}
                      </h4>
                      <p className="font-mono-tabular text-xl font-bold text-ink">
                        {calibrationTargetEstimate.scorePct !== null
                          ? `${calibrationTargetEstimate.scorePct}% ± ${Math.round((calibrationTargetEstimate.ciUpperPct - calibrationTargetEstimate.ciLowerPct) / 2)}%`
                          : 'Unassessed'}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {calibrationTargetEstimate.scorePct === null
                          ? '0 trials · 90s block needed'
                          : `▨ Hatched (${Math.round(calibrationTargetEstimate.confidence * 100)}% conf)`}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Signature #3 WhyThisPanel: First Explainable Micro-Step */}
              <WhyThisPanel
                trail={SAMPLE_WHY_THIS_TRAIL}
                title="Your First Explainable AI Coach Step (5-Part Reasoning Trail)"
                defaultExpanded
              />
            </div>

            {/* Right 5 Columns: Initial Uncertainty Radar + Calibration Readiness Summary + Snapshot Provenance */}
            <div className="lg:col-span-5 min-w-0 flex flex-col justify-between gap-4">
              <UncertaintyRadar
                dimensions={activeDimensions}
                estimates={estimates}
                title="Initial Cognitive Twin Radar"
              />

              <Card className="p-4 space-y-2.5 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="font-display text-sm font-bold text-ink">
                    Baseline Psychometric Convergence
                  </strong>
                  <Badge tone="brand" glyph="●">
                    QUEST+ 85% Staircase
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono-tabular">
                  <div className="rounded-sm border border-border bg-canvas p-2">
                    <span className="text-ink-muted block">Solid Dims</span>
                    <strong className="text-ink">
                      {
                        estimates.filter(
                          (e) => e.scorePct !== null && !e.isLowConfidence,
                        ).length
                      }{' '}
                      / {activeDimensions.length}
                    </strong>
                  </div>
                  <div className="rounded-sm border border-border bg-canvas p-2">
                    <span className="text-ink-muted block">Hatched Dims</span>
                    <strong className="text-ink">
                      {estimates.filter((e) => e.isLowConfidence).length}
                    </strong>
                  </div>
                  <div className="rounded-sm border border-border bg-canvas p-2">
                    <span className="text-ink-muted block">Next Block</span>
                    <strong className="text-ink">2 min (MST)</strong>
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-ink">
                      Snapshot Provenance &amp; Consent Receipt
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Every reveal snapshot is versioned and auditable.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-expanded={showSnapshotJson}
                    onClick={() => setShowSnapshotJson((prev) => !prev)}
                  >
                    {showSnapshotJson
                      ? 'Hide Snapshot JSON ▲'
                      : 'Inspect Snapshot JSON ▼'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono-tabular">
                  <div className="rounded-sm border border-border bg-canvas p-2.5">
                    <span className="text-ink-muted block">Consent Receipt</span>
                    <strong className="text-ink">
                      {consentPreferences.consentReceiptId}
                    </strong>
                  </div>
                  <div className="rounded-sm border border-border bg-canvas p-2.5">
                    <span className="text-ink-muted block">Input Latency</span>
                    <strong className="text-ink">
                      {consentPreferences.inputLatencyMs ?? 138} ms (Normalized)
                    </strong>
                  </div>
                </div>

                {showSnapshotJson && (
                  <pre
                    tabIndex={0}
                    role="region"
                    aria-label="Snapshot provenance JSON payload"
                    className="focus-ring rounded-sm border border-border bg-canvas p-3 text-xs font-mono-tabular text-ink overflow-x-auto whitespace-pre-wrap break-words max-h-56"
                  >
                    <code>
                      {JSON.stringify(snapshotPayloadPreview, null, 2)}
                    </code>
                  </pre>
                )}

                <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to="/dashboard"
                    className="tactile-btn bg-brand text-brand-ink px-4 py-2.5 text-sm font-semibold no-underline inline-flex items-center"
                  >
                    Continue to Full Dashboard →
                  </Link>
                  <span className="text-xs font-mono-tabular text-ink-muted">
                    GET /v1/dashboard/profile
                  </span>
                </div>
              </Card>
            </div>
          </section>

          {/* BOTTOM ROW: DIMENSION-BY-DIMENSION REVEAL STRIP */}
          <Card
            as="section"
            aria-labelledby="reveal-dims-heading"
            className="p-6 space-y-4 min-w-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2
                  id="reveal-dims-heading"
                  className="font-display text-xl font-bold text-ink"
                >
                  Dimension-by-Dimension Initial Calibration (
                  {filteredDimensions.length} of {activeDimensions.length}{' '}
                  Shown)
                </h2>
                <p className="text-xs text-ink-muted">
                  Filter between solid calibrated dimensions (≥60% confidence)
                  and hatched preliminary dimensions (&lt;60% confidence).
                </p>
              </div>

              <div
                role="group"
                aria-label="Filter reveal dimensions by confidence status"
                className="flex flex-wrap items-center gap-1.5"
              >
                {(
                  [
                    { id: 'all', label: `All (${activeDimensions.length})` },
                    { id: 'calibrated-only', label: 'Solid Calibrated (≥60%)' },
                    {
                      id: 'hatched-only',
                      label: '▨ Hatched / Needs Calibration (<60%)',
                    },
                  ] as const
                ).map((tab) => (
                  <Button
                    key={tab.id}
                    size="sm"
                    variant={filterMode === tab.id ? 'primary' : 'secondary'}
                    aria-pressed={filterMode === tab.id}
                    onClick={() => setFilterMode(tab.id)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {filteredDimensions.map((dim) => {
                const est = estimates.find((e) => e.dimensionId === dim.id)
                const isMissing = !est || est.scorePct === null
                const isHatched = Boolean(est?.isLowConfidence)

                return (
                  <div
                    key={dim.id}
                    className={`rounded-md border-2 p-3.5 space-y-2 min-w-0 ${
                      isHatched || isMissing
                        ? 'border-dashed border-border-strong bg-surface-raised'
                        : 'border-border bg-surface'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-mono-tabular text-xs font-bold text-ink">
                        {dim.markerGlyph} {dim.code}
                      </span>
                      {isMissing ? (
                        <Badge tone="warning" glyph="◌">
                          Unassessed
                        </Badge>
                      ) : isHatched ? (
                        <Badge tone="low-confidence" glyph="▨">
                          Hatched ({Math.round((est?.confidence ?? 0) * 100)}%)
                        </Badge>
                      ) : (
                        <Badge tone="brand" glyph="●">
                          Solid ({Math.round((est?.confidence ?? 0) * 100)}%)
                        </Badge>
                      )}
                    </div>

                    <h3 className="font-display text-base font-bold text-ink break-words">
                      {dim.name}
                    </h3>

                    <p className="font-mono-tabular text-xl font-bold text-ink">
                      {isMissing
                        ? '—'
                        : `${est?.scorePct}% ± ${Math.round(((est?.ciUpperPct ?? 0) - (est?.ciLowerPct ?? 0)) / 2)}%`}
                    </p>

                    <p className="text-xs text-ink-muted">
                      {isMissing
                        ? 'Complete 1 micro-block (90s) to initialize.'
                        : isHatched
                          ? 'Log 2 more micro-blocks to graduate from hatched to solid.'
                          : `Calibrated across ${est?.sampleSize ?? 18} trials (${est?.meanRtMs ?? 580} ms RT).`}
                    </p>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
