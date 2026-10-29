import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DimensionConfig, DimensionEstimate } from '../../../types'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'

export interface BrainTwinSnapshot {
  snapshotIndex: number
  snapshotId: string
  recordedAt: string
  shortDate: string
  label: string
  milestoneTag: string
  sessionCount: number
  archetypeLabel: string
  cosineSimilarity: number
  hysteresisHoldCount: number
  manifoldCoord: { x: number; y: number }
  estimates: DimensionEstimate[]
}

export interface BrainTwinTimeTravelProps {
  snapshots: BrainTwinSnapshot[]
  dimensions: DimensionConfig[]
  selectedSnapIndex: number
  onSelectSnapIndex: (index: number) => void
  compareAnchorIndex: number
  onSelectCompareAnchorIndex: (index: number) => void
}

const ARCHETYPE_ANCHORS = [
  {
    id: 'focused_builder',
    label: 'Focused Builder',
    glyph: '◆',
    x: 76,
    y: 26,
  },
  {
    id: 'precision_verifier',
    label: 'Precision Verifier',
    glyph: '■',
    x: 78,
    y: 74,
  },
  {
    id: 'exploratory_generalist',
    label: 'Exploratory Generalist',
    glyph: '●',
    x: 24,
    y: 28,
  },
  {
    id: 'adaptive_sprinter',
    label: 'Adaptive Sprinter',
    glyph: '▲',
    x: 26,
    y: 76,
  },
] as const

export function buildHistoricalSnapshots(
  dimensions: DimensionConfig[],
  baseEstimates: DimensionEstimate[],
): BrainTwinSnapshot[] {
  const totalSnapshots = 14
  const milestones: Record<number, { label: string; tag: string }> = {
    1: { label: 'Day 1 Cold Baseline', tag: 'Baseline' },
    4: { label: 'Early Lure Calibration', tag: 'Day 4' },
    7: { label: 'Mid-Week Rule-Switch Shift', tag: 'Day 7' },
    11: { label: 'Dual-Stream N-Back Unlock', tag: 'Day 11' },
    14: { label: 'Latest Converged Twin State', tag: 'Latest' },
  }

  return Array.from({ length: totalSnapshots }, (_, idx) => {
    const snapNum = idx + 1
    // progress from 0.0 (Snap #1) to 1.0 (Snap #14)
    const progress = idx / (totalSnapshots - 1)
    const dayNumber = 11 + idx
    const dayStr = String(dayNumber).padStart(2, '0')

    const estimates: DimensionEstimate[] = dimensions.map((dim, dIdx) => {
      const target = baseEstimates.find((e) => e.dimensionId === dim.id)
      const finalScore = target?.scorePct ?? 74
      const finalConf = target?.confidence ?? 0.82
      const finalHalfCi = target
        ? Math.max(4, Math.round((target.ciUpperPct - target.ciLowerPct) / 2))
        : 6

      // Earlier snapshots start lower in score (by 9..16 pts) and wider in CI (15..19%)
      const scoreGainSpan = 10 + (dIdx % 4) * 2
      const historicalScore = Math.max(
        38,
        Math.round(finalScore - scoreGainSpan * (1 - progress)),
      )
      const historicalHalfCi = Math.round(
        finalHalfCi + (17 - finalHalfCi) * (1 - progress),
      )
      const historicalConf = Number(
        Math.max(
          0.38,
          Math.min(0.95, finalConf - 0.34 * (1 - progress)),
        ).toFixed(2),
      )

      return {
        dimensionId: dim.id,
        backendDimensionKey: dim.backendDimensionKey,
        scorePct: historicalScore,
        ciLowerPct: Math.max(5, historicalScore - historicalHalfCi),
        ciUpperPct: Math.min(99, historicalScore + historicalHalfCi),
        uncertaintySigma: Number((historicalHalfCi / 100).toFixed(2)),
        confidence: historicalConf,
        isLowConfidence: historicalConf < 0.6,
        sampleSize: Math.max(4, Math.round(6 + idx * 3.5 + (dIdx % 3) * 2)),
        meanRtMs: target?.meanRtMs ?? 590,
        errorRatePct: target?.errorRatePct ?? 12,
        hesitationJitterMs: target?.hesitationJitterMs ?? 48,
        speedAccuracyProfile: target?.speedAccuracyProfile ?? 'fast_accurate',
        trendDeltaPct: Math.round(scoreGainSpan * progress),
        lastUpdatedIso: `2026-10-${dayStr}T18:30:00Z`,
      }
    })

    // Manifold trajectory from center-left (34, 62) toward Focused Builder (74, 28)
    const manifoldX = Math.round(34 + 40 * progress)
    const manifoldY = Math.round(64 - 36 * progress + (idx % 2 === 0 ? 2 : -2))

    const milestoneInfo = milestones[snapNum] ?? {
      label: `Session Checkpoint #${snapNum}`,
      tag: `Day ${snapNum}`,
    }

    return {
      snapshotIndex: snapNum,
      snapshotId: `snap_2026_10_${dayStr}_${String(snapNum).padStart(2, '0')}`,
      recordedAt: `2026-10-${dayStr}T18:30:00Z`,
      shortDate: `Oct ${dayStr}`,
      label: milestoneInfo.label,
      milestoneTag: milestoneInfo.tag,
      sessionCount: snapNum,
      archetypeLabel:
        snapNum < 4
          ? 'Exploratory Generalist (Provisional)'
          : 'Focused Builder',
      cosineSimilarity: Number((0.61 + 0.23 * progress).toFixed(2)),
      hysteresisHoldCount: snapNum < 4 ? 1 : snapNum < 6 ? 2 : 3,
      manifoldCoord: { x: manifoldX, y: manifoldY },
      estimates,
    }
  })
}

export function BrainTwinTimeTravel({
  snapshots,
  dimensions,
  selectedSnapIndex,
  onSelectSnapIndex,
  compareAnchorIndex,
  onSelectCompareAnchorIndex,
}: BrainTwinTimeTravelProps) {
  const [showTable, setShowTable] = useState(false)

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

  const diffRows = useMemo(() => {
    return dimensions.map((dim) => {
      const aEst = anchorSnap.estimates.find((e) => e.dimensionId === dim.id)
      const bEst = selectedSnap.estimates.find((e) => e.dimensionId === dim.id)

      const aScore = aEst?.scorePct ?? 60
      const bScore = bEst?.scorePct ?? 74
      const aCi = aEst
        ? Math.max(4, Math.round((aEst.ciUpperPct - aEst.ciLowerPct) / 2))
        : 16
      const bCi = bEst
        ? Math.max(4, Math.round((bEst.ciUpperPct - bEst.ciLowerPct) / 2))
        : 6
      const aConf = Math.round((aEst?.confidence ?? 0.48) * 100)
      const bConf = Math.round((bEst?.confidence ?? 0.82) * 100)

      const scoreDelta = bScore - aScore
      const ciDelta = bCi - aCi
      const graduated = aConf < 60 && bConf >= 60

      return {
        dim,
        aScore,
        bScore,
        aCi,
        bCi,
        aConf,
        bConf,
        scoreDelta,
        ciDelta,
        graduated,
      }
    })
  }, [dimensions, anchorSnap, selectedSnap])

  const quickMilestoneIndices = [1, 4, 7, 11, 14]

  return (
    <div className="space-y-6 min-w-0">
      {/* 1. INTERACTIVE 14-SNAPSHOT SCRUBBER CARD */}
      <Card
        as="section"
        aria-labelledby="time-travel-scrubber-heading"
        className="p-6 space-y-5 min-w-0 shadow-doodle"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="reward" glyph="★">
                Signature #2 · BrainTwinTimeTravel Scrubber
              </Badge>
              <Badge tone="brand" glyph="●">
                Active: Snap #{selectedSnap.snapshotIndex} ({selectedSnap.shortDate})
              </Badge>
            </div>
            <h2
              id="time-travel-scrubber-heading"
              className="font-display text-xl sm:text-2xl font-bold text-ink"
            >
              Historical Snapshot Timeline Scrubber (Snap #1 → Snap #14)
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted">
              Drag the timeline slider or use keyboard arrows (
              <code className="font-mono-tabular">←</code> /{' '}
              <code className="font-mono-tabular">→</code>) to scrub your
              SAT-JEPA latent twin (<code className="font-mono-tabular">s_t → c_t</code>)
              across 14 recorded checkpoints.
            </p>
          </div>

          <Button
            size="sm"
            variant="secondary"
            aria-pressed={showTable}
            onClick={() => setShowTable((prev) => !prev)}
          >
            {showTable
              ? 'View Visual Diff Cards'
              : 'View Snapshot Diff as Table'}
          </Button>
        </div>

        {/* Range Slider Control */}
        <div className="rounded-md border-2 border-border bg-canvas p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular">
            <label
              htmlFor="snapshot-range-slider"
              className="font-bold text-ink"
            >
              Scrub Active Snapshot: #{selectedSnap.snapshotIndex} ·{' '}
              {selectedSnap.label}
            </label>
            <span className="text-ink-muted">
              ID: {selectedSnap.snapshotId} · Cosine: {selectedSnap.cosineSimilarity}
            </span>
          </div>

          <input
            id="snapshot-range-slider"
            type="range"
            min={1}
            max={snapshots.length}
            step={1}
            value={selectedSnap.snapshotIndex}
            aria-label="Select historical Brain Twin snapshot"
            aria-valuemin={1}
            aria-valuemax={snapshots.length}
            aria-valuenow={selectedSnap.snapshotIndex}
            aria-valuetext={`Snapshot ${selectedSnap.snapshotIndex} of ${snapshots.length}: ${selectedSnap.label}`}
            onChange={(e) => onSelectSnapIndex(Number(e.target.value))}
            className="w-full accent-brand cursor-pointer h-3"
          />

          {/* Quick-Jump Milestone Buttons */}
          <div
            role="group"
            aria-label="Quick-jump snapshot milestones"
            className="flex flex-wrap items-center justify-between gap-1.5 pt-1"
          >
            {quickMilestoneIndices.map((idx) => {
              const snap = snapshots.find((s) => s.snapshotIndex === idx)
              if (!snap) return null
              const isSelected = snap.snapshotIndex === selectedSnap.snapshotIndex
              return (
                <Button
                  key={snap.snapshotId}
                  size="sm"
                  variant={isSelected ? 'primary' : 'secondary'}
                  aria-pressed={isSelected}
                  onClick={() => onSelectSnapIndex(snap.snapshotIndex)}
                >
                  #{snap.snapshotIndex} · {snap.milestoneTag} ({snap.shortDate})
                </Button>
              )
            })}
          </div>
        </div>

        {/* Comparison Anchor Selector + Side-by-Side Diff Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">
              Side-by-Side Snapshot Diff Comparator (Snap #{anchorSnap.snapshotIndex} vs Snap #{selectedSnap.snapshotIndex})
            </h3>
            <p className="text-xs text-ink-muted">
              Comparing <strong>{anchorSnap.label}</strong> against{' '}
              <strong>{selectedSnap.label}</strong> across all {dimensions.length}{' '}
              active dimensions.
            </p>
          </div>

          <div
            role="group"
            aria-label="Select comparison anchor snapshot"
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="font-mono-tabular text-xs text-ink-muted me-1">
              Compare vs:
            </span>
            {[
              { idx: 1, label: 'Snap #1 (Day 1)' },
              { idx: 7, label: 'Snap #7 (Mid-Week)' },
              {
                idx: Math.max(1, selectedSnap.snapshotIndex - 1),
                label: 'Prev (t - 1)',
              },
            ].map((anchorOpt) => (
              <Button
                key={`${anchorOpt.label}-${anchorOpt.idx}`}
                size="sm"
                variant={
                  compareAnchorIndex === anchorOpt.idx ? 'reward' : 'secondary'
                }
                aria-pressed={compareAnchorIndex === anchorOpt.idx}
                onClick={() => onSelectCompareAnchorIndex(anchorOpt.idx)}
              >
                {anchorOpt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Diff View: Accessible Semantic Table OR Visual Diff Grid */}
        {showTable ? (
          <div className="overflow-x-auto">
            <table
              aria-label="Side-by-side historical snapshot comparison table"
              className="w-full text-start border-collapse text-xs font-mono-tabular"
            >
              <thead>
                <tr className="border-b-2 border-border-strong text-ink-muted uppercase">
                  <th scope="col" className="py-2 pe-3 text-start">
                    Dimension
                  </th>
                  <th scope="col" className="py-2 px-3 text-start">
                    Snap #{anchorSnap.snapshotIndex} (±CI)
                  </th>
                  <th scope="col" className="py-2 px-3 text-start">
                    Snap #{selectedSnap.snapshotIndex} (±CI)
                  </th>
                  <th scope="col" className="py-2 px-3 text-start">
                    Net Delta
                  </th>
                  <th scope="col" className="py-2 ps-3 text-start">
                    Band Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {diffRows.map((row) => (
                  <tr key={row.dim.id}>
                    <td className="py-2.5 pe-3 font-bold text-ink">
                      <span aria-hidden="true" className="me-1">
                        {row.dim.markerGlyph}
                      </span>
                      {row.dim.code} · {row.dim.name}
                    </td>
                    <td className="py-2.5 px-3 text-ink-muted">
                      {row.aScore}% ± {row.aCi}% ({row.aConf}% conf)
                    </td>
                    <td className="py-2.5 px-3 font-bold text-ink">
                      {row.bScore}% ± {row.bCi}% ({row.bConf}% conf)
                    </td>
                    <td className="py-2.5 px-3 font-bold text-ink">
                      {row.scoreDelta >= 0 ? `+${row.scoreDelta}%` : `${row.scoreDelta}%`}{' '}
                      ({row.ciDelta <= 0 ? `${row.ciDelta}% CI` : `+${row.ciDelta}% CI`})
                    </td>
                    <td className="py-2.5 ps-3">
                      <Badge
                        tone={row.bConf >= 60 ? 'success' : 'warning'}
                        glyph={row.bConf >= 60 ? '●' : '⚡'}
                      >
                        {row.graduated
                          ? 'Graduated → Solid'
                          : row.bConf >= 60
                            ? 'Solid Band'
                            : 'Hatched Band'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {diffRows.map((row) => (
              <div
                key={row.dim.id}
                className="rounded-md border-2 border-border bg-canvas p-3.5 space-y-2 min-w-0 flex flex-col justify-between"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to={`/dimensions/${row.dim.id}`}
                    className="font-display text-sm font-bold text-ink hover:text-brand no-underline"
                  >
                    <span aria-hidden="true" className="me-1">
                      {row.dim.markerGlyph}
                    </span>
                    {row.dim.code} · {row.dim.name}
                  </Link>
                  <Badge
                    tone={row.bConf >= 60 ? 'success' : 'warning'}
                    glyph={row.bConf >= 60 ? '●' : '⚡'}
                  >
                    {row.graduated
                      ? 'Graduated → Solid'
                      : row.bConf >= 60
                        ? `Solid (${row.bConf}%)`
                        : `Hatched (${row.bConf}%)`}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs font-mono-tabular">
                  <div className="rounded-sm border border-border bg-surface p-2">
                    <span className="text-ink-muted block">
                      Snap #{anchorSnap.snapshotIndex}
                    </span>
                    <strong className="text-ink">
                      {row.aScore}% ±{row.aCi}%
                    </strong>
                  </div>
                  <div className="rounded-sm border border-border bg-surface p-2">
                    <span className="text-ink-muted block">
                      Snap #{selectedSnap.snapshotIndex}
                    </span>
                    <strong className="text-ink">
                      {row.bScore}% ±{row.bCi}%
                    </strong>
                  </div>
                  <div className="rounded-sm border border-border bg-surface p-2">
                    <span className="text-ink-muted block">Delta (Δc)</span>
                    <strong className="text-ink">
                      {row.scoreDelta >= 0
                        ? `+${row.scoreDelta}%`
                        : `${row.scoreDelta}%`}{' '}
                      ({row.ciDelta}% CI)
                    </strong>
                  </div>
                </div>
              </div>
            ))}

            {diffRows.length % 2 === 1 && (
              <div className="rounded-md border-2 border-border-strong bg-surface-raised p-3.5 space-y-2 min-w-0 flex flex-col justify-between">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-ink">
                    ◈ Aggregate Twin Convergence ({diffRows.length} Axes)
                  </span>
                  <Badge tone="brand" glyph="★">
                    Cosine: {selectedSnap.cosineSimilarity}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono-tabular">
                  <div className="rounded-sm border border-border bg-canvas p-2">
                    <span className="text-ink-muted block">Sessions</span>
                    <strong className="text-ink">
                      {selectedSnap.sessionCount} Logged
                    </strong>
                  </div>
                  <div className="rounded-sm border border-border bg-canvas p-2">
                    <span className="text-ink-muted block">Hysteresis</span>
                    <strong className="text-ink">
                      {selectedSnap.hysteresisHoldCount}/3 Hold
                    </strong>
                  </div>
                  <div className="rounded-sm border border-border bg-canvas p-2">
                    <span className="text-ink-muted block">Cluster</span>
                    <strong className="text-ink">Stable</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 2. SAT-JEPA 2D PROTOTYPE MANIFOLD & HYSTERESIS TRAJECTORY CARD */}
      <Card
        as="section"
        aria-labelledby="manifold-map-heading"
        className="p-6 space-y-4 min-w-0"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand" glyph="◆">
                SAT-JEPA Latent Manifold (s_t → c_t)
              </Badge>
              <Badge
                tone={
                  selectedSnap.hysteresisHoldCount >= 3 ? 'success' : 'warning'
                }
                glyph={selectedSnap.hysteresisHoldCount >= 3 ? '✓' : '◌'}
              >
                Hysteresis Lock: {selectedSnap.hysteresisHoldCount} / 3 Sessions
              </Badge>
            </div>
            <h3
              id="manifold-map-heading"
              className="font-display text-lg font-bold text-ink"
            >
              SAT-JEPA 2D Prototype Manifold &amp; Hysteresis Trajectory
            </h3>
            <p className="text-xs text-ink-muted">
              3-session hysteresis hold prevents noisy archetype switching when
              a single session fluctuates. Active cluster:{' '}
              <strong className="text-ink">{selectedSnap.archetypeLabel}</strong>{' '}
              (cosine similarity{' '}
              <code className="font-mono-tabular">
                {selectedSnap.cosineSimilarity}
              </code>
              ).
            </p>
          </div>
        </div>

        {/* 2D Manifold SVG Canvas */}
        <div className="rounded-md border-2 border-border bg-canvas p-4">
          <svg
            viewBox="0 0 420 190"
            className="w-full h-44"
            role="img"
            aria-label={`2D SAT-JEPA prototype manifold showing trajectory from Snapshot 1 to Snapshot ${selectedSnap.snapshotIndex} toward ${selectedSnap.archetypeLabel}`}
          >
            {/* Subtle Grid Axes */}
            <line
              x1="210"
              y1="12"
              x2="210"
              y2="178"
              stroke="var(--color-border)"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />
            <line
              x1="20"
              y1="95"
              x2="400"
              y2="95"
              stroke="var(--color-border)"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />

            {/* 4 Reference Archetype Prototype Anchors */}
            {ARCHETYPE_ANCHORS.map((arch) => {
              const cx = (arch.x / 100) * 380 + 20
              const cy = (arch.y / 100) * 160 + 15
              return (
                <g key={arch.id}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="16"
                    fill="var(--color-brand-subtle)"
                    stroke="var(--color-border-strong)"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                  <text
                    x={cx}
                    y={cy + 4}
                    textAnchor="middle"
                    fill="var(--color-ink)"
                    fontSize="11"
                    fontWeight="700"
                  >
                    {arch.glyph}
                  </text>
                  <text
                    x={cx}
                    y={cy + 28}
                    textAnchor="middle"
                    fill="var(--color-ink-muted)"
                    fontSize="9.5"
                    fontWeight="600"
                  >
                    {arch.label}
                  </text>
                </g>
              )
            })}

            {/* Historical Trajectory Polyline (Snap #1 .. Selected Snap) */}
            <polyline
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth="2.8"
              points={snapshots
                .slice(0, selectedSnap.snapshotIndex)
                .map(
                  (s) =>
                    `${(s.manifoldCoord.x / 100) * 380 + 20},${
                      (s.manifoldCoord.y / 100) * 160 + 15
                    }`,
                )
                .join(' ')}
            />

            {/* Anchor Snapshot Marker (Snap A) */}
            <circle
              cx={(anchorSnap.manifoldCoord.x / 100) * 380 + 20}
              cy={(anchorSnap.manifoldCoord.y / 100) * 160 + 15}
              r="6"
              fill="var(--color-surface)"
              stroke="var(--color-ink)"
              strokeWidth="2.5"
            />

            {/* Active Scrubbed Snapshot Marker (Snap B) */}
            <circle
              cx={(selectedSnap.manifoldCoord.x / 100) * 380 + 20}
              cy={(selectedSnap.manifoldCoord.y / 100) * 160 + 15}
              r="8.5"
              fill="var(--color-reward)"
              stroke="var(--color-ink)"
              strokeWidth="2.5"
            />
          </svg>
        </div>
      </Card>
    </div>
  )
}
