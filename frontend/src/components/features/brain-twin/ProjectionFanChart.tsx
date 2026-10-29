import { useEffect, useId, useMemo, useState } from 'react'
import type { DimensionConfig, TrajectoryPoint } from '../../../types'
import { buildTrajectoryForTarget } from '../../../services/mocks/fixtures'
import type { PersonaId } from '../../../state/useAppStore'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'

export interface ProjectionFanChartProps {
  dimensions: readonly DimensionConfig[]
  persona: PersonaId
  title?: string
  initialTarget?: string
}

const CHART_W = 680
const CHART_H = 260
const PAD_LEFT = 46
const PAD_RIGHT = 28
const PAD_TOP = 24
const PAD_BOTTOM = 38

export function ProjectionFanChart({
  dimensions,
  persona,
  title = '6-Week Historical Trajectory & 2-Week Uncertainty Fan',
  initialTarget = 'composite',
}: ProjectionFanChartProps) {
  const hatchPatternId = useId().replace(/:/g, '')
  const [selectedTarget, setSelectedTarget] = useState<string>(initialTarget)
  const [showTable, setShowTable] = useState<boolean>(false)

  useEffect(() => {
    setSelectedTarget(initialTarget)
  }, [initialTarget])

  const activeDim = useMemo(
    () => dimensions.find((d) => d.id === selectedTarget) ?? null,
    [dimensions, selectedTarget],
  )

  const points: TrajectoryPoint[] = useMemo(() => {
    const slotSeed = activeDim ? activeDim.slotIndex * 2 : 3
    return buildTrajectoryForTarget(selectedTarget, persona, slotSeed)
  }, [activeDim, persona, selectedTarget])

  const xForIndex = (idx: number) => {
    const usableW = CHART_W - PAD_LEFT - PAD_RIGHT
    return PAD_LEFT + (idx / Math.max(1, points.length - 1)) * usableW
  }

  const yForScore = (scorePct: number) => {
    const usableH = CHART_H - PAD_TOP - PAD_BOTTOM
    const clamped = Math.min(100, Math.max(0, scorePct))
    return PAD_TOP + ((100 - clamped) / 100) * usableH
  }

  // Split into Observed (indices 0..5) and Projected Fan (indices 5..7, anchored at W6 index 5)
  const observedPoints = points.slice(0, 6)
  const projectedPoints = points.slice(5)

  const observedBandPolygon = useMemo(() => {
    const upper = observedPoints.map(
      (pt, i) => `${xForIndex(i)},${yForScore(pt.ciUpperPct)}`,
    )
    const lower = [...observedPoints]
      .reverse()
      .map((pt, revIdx) => {
        const origIdx = observedPoints.length - 1 - revIdx
        return `${xForIndex(origIdx)},${yForScore(pt.ciLowerPct)}`
      })
    return [...upper, ...lower].join(' ')
  }, [observedPoints])

  const projectedFanPolygon = useMemo(() => {
    const startIdx = 5
    const upper = projectedPoints.map(
      (pt, i) => `${xForIndex(startIdx + i)},${yForScore(pt.ciUpperPct)}`,
    )
    const lower = [...projectedPoints]
      .reverse()
      .map((pt, revIdx) => {
        const origIdx = startIdx + (projectedPoints.length - 1 - revIdx)
        return `${xForIndex(origIdx)},${yForScore(pt.ciLowerPct)}`
      })
    return [...upper, ...lower].join(' ')
  }, [projectedPoints])

  const observedLinePoints = observedPoints
    .map((pt, i) => `${xForIndex(i)},${yForScore(pt.scorePct)}`)
    .join(' ')

  const projectedLinePoints = projectedPoints
    .map((pt, i) => `${xForIndex(5 + i)},${yForScore(pt.scorePct)}`)
    .join(' ')

  const strokeColor = activeDim ? activeDim.colorCssVar : 'var(--color-brand)'
  const fallbackPoint: TrajectoryPoint = {
    weekKey: 'W6',
    weekLabel: 'Week 6',
    scorePct: 75,
    ciLowerPct: 70,
    ciUpperPct: 80,
    confidence: 0.84,
    isProjected: false,
    sessionCount: 4,
  }
  const w6Point = points[5] ?? fallbackPoint
  const w8Point = points[7] ?? fallbackPoint

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-2 border-b border-border pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
            <Badge tone="info" glyph="◈">
              SAT-JEPA Forecast Fan
            </Badge>
          </div>
          <p className="text-xs text-ink-muted">
            Observed 95% confidence band narrows with practice (W1→W6), while
            the 2-week forecast cone widens honestly (
            <code className="font-mono-tabular">+1 Wk</code>,{' '}
            <code className="font-mono-tabular">+2 Wk</code>).
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          aria-pressed={showTable}
          onClick={() => setShowTable((prev) => !prev)}
        >
          {showTable ? 'View Fan Chart' : 'View Trajectory as Table'}
        </Button>
      </div>

      {/* Dimension Selector Tabs */}
      <div
        role="group"
        aria-label="Filter trajectory curve by cognitive dimension"
        className="flex flex-wrap items-center gap-1.5"
      >
        <button
          type="button"
          aria-pressed={selectedTarget === 'composite'}
          onClick={() => setSelectedTarget('composite')}
          className={`focus-ring min-h-11 px-2.5 py-1 rounded-sm border-2 text-xs font-bold cursor-pointer ${
            selectedTarget === 'composite'
              ? 'bg-brand text-brand-ink border-border-strong shadow-xs'
              : 'bg-surface-raised text-ink border-border-strong hover:bg-canvas'
          }`}
        >
          ★ Composite Twin
        </button>
        {dimensions.map((dim) => {
          const active = selectedTarget === dim.id
          return (
            <button
              key={dim.id}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedTarget(dim.id)}
              className={`focus-ring min-h-11 px-2.5 py-1 rounded-sm border-2 text-xs font-bold cursor-pointer ${
                active
                  ? 'bg-brand text-brand-ink border-border-strong shadow-xs'
                  : 'bg-surface-raised text-ink border-border-strong hover:bg-canvas'
              }`}
            >
              {dim.markerGlyph} {dim.code}
            </button>
          )
        })}
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table
            aria-label="Brain Twin 6-week historical trajectory and 2-week forecast table"
            className="w-full text-start border-collapse text-xs"
          >
            <caption className="sr-only">
              Weekly observed estimates and projected confidence intervals for{' '}
              {activeDim ? activeDim.name : 'Composite Brain Twin'}
            </caption>
            <thead>
              <tr className="border-b-2 border-border-strong bg-surface-raised">
                <th scope="col" className="p-2 text-start font-bold">
                  Week
                </th>
                <th scope="col" className="p-2 text-start font-bold">
                  Estimate ± CI
                </th>
                <th scope="col" className="p-2 text-start font-bold">
                  95% Range
                </th>
                <th scope="col" className="p-2 text-start font-bold">
                  Confidence
                </th>
                <th scope="col" className="p-2 text-start font-bold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((pt) => {
                const half = Math.round((pt.ciUpperPct - pt.ciLowerPct) / 2)
                return (
                  <tr key={pt.weekKey} className="border-b border-border">
                    <th
                      scope="row"
                      className="p-2 font-mono-tabular font-bold text-ink text-start"
                    >
                      {pt.weekKey}
                    </th>
                    <td className="p-2 font-mono-tabular text-ink">
                      {pt.scorePct}% ± {half}%
                    </td>
                    <td className="p-2 font-mono-tabular text-ink-muted">
                      [{pt.ciLowerPct}%, {pt.ciUpperPct}%]
                    </td>
                    <td className="p-2 font-mono-tabular text-ink">
                      {Math.round(pt.confidence * 100)}%
                    </td>
                    <td className="p-2">
                      {pt.isProjected ? (
                        <Badge tone="low-confidence" glyph="▨">
                          Forecast Cone
                        </Badge>
                      ) : (
                        <Badge tone="brand" glyph="●">
                          Observed ({pt.sessionCount} sessions)
                        </Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              role="img"
              aria-label={`Trajectory chart for ${
                activeDim ? activeDim.name : 'Composite Twin'
              }: Current Week 6 score ${w6Point.scorePct}% with 2-week forecast ${
                w8Point.scorePct
              }% (${w8Point.ciLowerPct}% to ${w8Point.ciUpperPct}%)`}
              className="w-full h-auto block"
            >
              <defs>
                <pattern
                  id={hatchPatternId}
                  width="8"
                  height="8"
                  patternTransform="rotate(45 0 0)"
                  patternUnits="userSpaceOnUse"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="8"
                    stroke="var(--uncertainty-low-stroke)"
                    strokeWidth="2"
                  />
                </pattern>
              </defs>

              {/* Horizontal Grid Lines (25%, 50%, 75%, 100%) */}
              {[25, 50, 75, 100].map((lvl) => {
                const y = yForScore(lvl)
                return (
                  <g key={lvl}>
                    <line
                      x1={PAD_LEFT}
                      y1={y}
                      x2={CHART_W - PAD_RIGHT}
                      y2={y}
                      stroke="var(--color-border)"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={PAD_LEFT - 8}
                      y={y + 4}
                      textAnchor="end"
                      fill="var(--color-ink-muted)"
                      className="text-xs font-mono-tabular"
                    >
                      {lvl}%
                    </text>
                  </g>
                )
              })}

              {/* Vertical Divider at Week 6 (Now -> Forecast Boundary) */}
              <line
                x1={xForIndex(5)}
                y1={PAD_TOP}
                x2={xForIndex(5)}
                y2={CHART_H - PAD_BOTTOM}
                stroke="var(--color-border-strong)"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />

              {/* Observed 95% Confidence Band (W1..W6) */}
              <polygon
                points={observedBandPolygon}
                fill="var(--uncertainty-band-fill)"
                stroke="var(--color-brand)"
                strokeWidth="1"
              />

              {/* Projected 2-Week Uncertainty Fan Cone (W6..+2 Wk) with Diagonal Hatching */}
              <polygon
                points={projectedFanPolygon}
                fill={`url(#${hatchPatternId})`}
                stroke="var(--uncertainty-low-stroke)"
                strokeDasharray="4 3"
                strokeWidth="1.5"
              />

              {/* Observed Trajectory Curve (Solid) */}
              <polyline
                fill="none"
                stroke={strokeColor}
                strokeWidth="3"
                points={observedLinePoints}
              />

              {/* Projected Forecast Curve (Dashed) */}
              <polyline
                fill="none"
                stroke="var(--uncertainty-low-stroke)"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                points={projectedLinePoints}
              />

              {/* Data Vertices & X-Axis Labels */}
              {points.map((pt, idx) => {
                const cx = xForIndex(idx)
                const cy = yForScore(pt.scorePct)
                const half = Math.round((pt.ciUpperPct - pt.ciLowerPct) / 2)
                return (
                  <g key={pt.weekKey}>
                    {pt.isProjected ? (
                      <rect
                        x={cx - 4.5}
                        y={cy - 4.5}
                        width="9"
                        height="9"
                        fill="var(--color-surface)"
                        stroke="var(--uncertainty-low-stroke)"
                        strokeWidth="2"
                      />
                    ) : (
                      <circle
                        cx={cx}
                        cy={cy}
                        r="4.5"
                        fill={strokeColor}
                        stroke="var(--color-surface)"
                        strokeWidth="2"
                      />
                    )}
                    {/* Score + CI callout on W1, W6, and +2 Wk */}
                    {(idx === 0 || idx === 5 || idx === 7) && (
                      <text
                        x={cx}
                        y={Math.max(14, cy - 10)}
                        textAnchor={
                          idx === 0 ? 'start' : idx === 7 ? 'end' : 'middle'
                        }
                        fill="var(--color-ink)"
                        className="text-xs font-mono-tabular font-bold"
                      >
                        {pt.scorePct}%±{half}
                      </text>
                    )}
                    <text
                      x={cx}
                      y={CHART_H - 12}
                      textAnchor="middle"
                      fill="var(--color-ink)"
                      className="text-xs font-mono-tabular font-semibold"
                    >
                      {pt.weekKey}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted pt-1 border-t border-border">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                <strong className="text-ink">● Solid Band:</strong> Observed 95%
                CI (W1–W6)
              </span>
              <span>
                <strong className="text-ink">▨ Hatched Cone:</strong> 2-Week
                SAT-JEPA Forecast Fan (
                <code className="font-mono-tabular">+1 Wk</code>,{' '}
                <code className="font-mono-tabular">+2 Wk</code>)
              </span>
            </div>
            <span className="font-mono-tabular text-ink font-semibold">
              Current W6: {w6Point.scorePct}% ±{' '}
              {Math.round((w6Point.ciUpperPct - w6Point.ciLowerPct) / 2)}%
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
