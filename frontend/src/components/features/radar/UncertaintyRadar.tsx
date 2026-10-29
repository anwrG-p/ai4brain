import { useState } from 'react'
import { scaleLinear } from 'd3-scale'
import type { DimensionConfig, DimensionEstimate, MarkerShape } from '../../../types'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'

export interface UncertaintyRadarProps {
  dimensions: readonly DimensionConfig[]
  estimates: readonly DimensionEstimate[]
  title?: string
  subtitle?: string | null
  showSubtitle?: boolean
  defaultShowTable?: boolean
  showTableToggle?: boolean
  headingLevel?: 'h2' | 'h3'
}

function regularPolygonPoints(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rotationRad = -Math.PI / 2,
): string {
  const pts: string[] = []
  for (let i = 0; i < sides; i++) {
    const a = rotationRad + (i * 2 * Math.PI) / sides
    pts.push(
      `${(cx + radius * Math.cos(a)).toFixed(2)},${(cy + radius * Math.sin(a)).toFixed(2)}`,
    )
  }
  return pts.join(' ')
}

function starPoints(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(
      `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`,
    )
  }
  return pts.join(' ')
}

function renderVertexMarker(
  shape: MarkerShape,
  cx: number,
  cy: number,
  color: string,
) {
  const r = 6
  switch (shape) {
    case 'circle':
      return (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={color}
          stroke="var(--color-surface)"
          strokeWidth={1.75}
        />
      )
    case 'square':
      return (
        <rect
          x={cx - r + 0.5}
          y={cy - r + 0.5}
          width={r * 2 - 1}
          height={r * 2 - 1}
          fill={color}
          stroke="var(--color-surface)"
          strokeWidth={1.75}
        />
      )
    case 'triangle':
      return (
        <polygon
          points={regularPolygonPoints(cx, cy, r + 1.5, 3)}
          fill={color}
          stroke="var(--color-surface)"
          strokeWidth={1.75}
        />
      )
    case 'diamond':
      return (
        <polygon
          points={regularPolygonPoints(cx, cy, r + 1.5, 4, 0)}
          fill={color}
          stroke="var(--color-surface)"
          strokeWidth={1.75}
        />
      )
    case 'pentagon':
      return (
        <polygon
          points={regularPolygonPoints(cx, cy, r + 1, 5)}
          fill={color}
          stroke="var(--color-surface)"
          strokeWidth={1.75}
        />
      )
    case 'hexagon':
      return (
        <polygon
          points={regularPolygonPoints(cx, cy, r + 1, 6, 0)}
          fill={color}
          stroke="var(--color-surface)"
          strokeWidth={1.75}
        />
      )
    case 'star':
      return (
        <polygon
          points={starPoints(cx, cy, r + 2, r * 0.48)}
          fill={color}
          stroke="var(--color-surface)"
          strokeWidth={1.5}
        />
      )
    case 'cross':
      return (
        <path
          d={`M ${cx - 2} ${cy - r} H ${cx + 2} V ${cy - 2} H ${cx + r} V ${cy + 2} H ${cx + 2} V ${cy + r} H ${cx - 2} V ${cy + 2} H ${cx - r} V ${cy - 2} H ${cx - 2} Z`}
          fill={color}
          stroke="var(--color-surface)"
          strokeWidth={1.25}
        />
      )
    case 'ring':
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="var(--color-surface)"
            stroke={color}
            strokeWidth={3}
          />
          <circle cx={cx} cy={cy} r={2} fill={color} />
        </g>
      )
    case 'hourglass':
      return (
        <polygon
          points={`${cx - r},${cy - r} ${cx + r},${cy - r} ${cx - r},${cy + r} ${cx + r},${cy + r}`}
          fill={color}
          stroke="var(--color-surface)"
          strokeWidth={1.5}
        />
      )
  }
}

export function UncertaintyRadar({
  dimensions,
  estimates,
  title = 'Brain Twin Uncertainty Radar',
  subtitle,
  showSubtitle = true,
  defaultShowTable = false,
  showTableToggle = true,
  headingLevel = 'h2',
}: UncertaintyRadarProps) {
  const [showTable, setShowTable] = useState(defaultShowTable)

  const size = 430
  const center = size / 2
  const maxRadius = 112
  const labelRadius = 142
  const radiusScale = scaleLinear().domain([0, 100]).range([0, maxRadius]).clamp(true)

  const count = Math.max(dimensions.length, 3)
  const angleForIndex = (i: number) => (Math.PI * 2 * i) / count - Math.PI / 2

  const pointAt = (i: number, pct: number): [number, number] => {
    const r = radiusScale(pct)
    const angle = angleForIndex(i)
    return [
      Math.round((center + r * Math.cos(angle)) * 100) / 100,
      Math.round((center + r * Math.sin(angle)) * 100) / 100,
    ]
  }

  const labelPointAt = (i: number): [number, number] => {
    const angle = angleForIndex(i)
    const verticalBoost = Math.abs(Math.sin(angle)) > 0.85 ? 8 : 0
    const r = labelRadius + verticalBoost
    return [
      Math.round((center + r * Math.cos(angle)) * 100) / 100,
      Math.round((center + r * Math.sin(angle)) * 100) / 100,
    ]
  }

  const rows = dimensions.map((dim, idx) => {
    const est = estimates.find((e) => e.dimensionId === dim.id)
    const score = est?.scorePct ?? null
    const ciLower = est?.ciLowerPct ?? 40
    const ciUpper = est?.ciUpperPct ?? 60
    const confidence = est?.confidence ?? 0.45
    const isLowConf = est ? est.isLowConfidence || est.confidence < 0.6 : true

    return {
      dim,
      idx,
      score,
      ciLower,
      ciUpper,
      confidence,
      isLowConf,
      meanRtMs: est?.meanRtMs ?? 0,
    }
  })

  const hasAnyLowConfidence = rows.some((r) => r.isLowConf)

  const outerPoints = rows
    .map((r) => pointAt(r.idx, r.score !== null ? r.ciUpper : 55).join(','))
    .join(' ')
  const innerPoints = rows
    .map((r) => pointAt(r.idx, r.score !== null ? r.ciLower : 45).join(','))
    .join(' ')
  const scorePoints = rows
    .map((r) => pointAt(r.idx, r.score !== null ? r.score : 50).join(','))
    .join(' ')

  const rings = [25, 50, 75, 100]

  return (
    <div className="tactile-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          {headingLevel === 'h3' ? (
            <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
          ) : (
            <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          )}
          {showSubtitle && subtitle !== null && (
            <p className="text-xs text-ink-muted">
              {subtitle ??
                `Showing ${dimensions.length} cognitive dimensions with 95% confidence bands${
                  hasAnyLowConfidence ? ' (hatched = preliminary low-confidence range)' : ''
                }.`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasAnyLowConfidence && (
            <Badge tone="low-confidence" glyph="▨">
              Hatched = Confidence &lt; 60%
            </Badge>
          )}
          {showTableToggle && (
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={showTable}
              onClick={() => setShowTable((prev) => !prev)}
            >
              {showTable ? 'Hide Accessible Table' : 'View as Table'}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-md h-auto overflow-visible"
          role="img"
          aria-label={`${title} across ${dimensions.length} cognitive dimensions`}
        >
          <defs>
            <pattern
              id="low-confidence-hatch"
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
                strokeWidth="2.5"
              />
            </pattern>
          </defs>

          {/* Concentric reference polygons */}
          {rings.map((ringPct) => {
            const poly = rows
              .map((r) => pointAt(r.idx, ringPct).join(','))
              .join(' ')
            return (
              <polygon
                key={ringPct}
                points={poly}
                fill="none"
                stroke="var(--color-border)"
                strokeDasharray={ringPct === 100 ? undefined : '3 3'}
                strokeWidth={ringPct === 100 ? 1.5 : 1}
              />
            )
          })}

          {/* Axis spokes */}
          {rows.map((r) => {
            const [x2, y2] = pointAt(r.idx, 100)
            return (
              <line
                key={r.dim.id}
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
            )
          })}

          {/* Outer Uncertainty Band (Hatched if any dimension is low confidence) */}
          <polygon
            points={outerPoints}
            fill={
              hasAnyLowConfidence
                ? 'url(#low-confidence-hatch)'
                : 'var(--uncertainty-band-fill)'
            }
            fillOpacity={hasAnyLowConfidence ? 0.45 : 0.9}
            stroke="var(--uncertainty-low-stroke)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />

          {/* Inner Uncertainty Band cutout */}
          <polygon
            points={innerPoints}
            fill="var(--color-surface)"
            fillOpacity={0.65}
            stroke="var(--color-border)"
            strokeDasharray="2 2"
            strokeWidth={1}
          />

          {/* Point Estimate Polygon */}
          <polygon
            points={scorePoints}
            fill="var(--uncertainty-band-fill)"
            stroke="var(--color-brand)"
            strokeWidth={2.5}
          />

          {/* Distinct Vertex Markers & Direct Labels with Halo */}
          {rows.map((r) => {
            const val = r.score !== null ? r.score : 50
            const [vx, vy] = pointAt(r.idx, val)
            const [lx, ly] = labelPointAt(r.idx)
            const textAnchor =
              Math.abs(lx - center) < 14
                ? 'middle'
                : lx > center
                  ? 'start'
                  : 'end'
            const halfBand = Math.round((r.ciUpper - r.ciLower) / 2)

            return (
              <g key={r.dim.id}>
                {renderVertexMarker(
                  r.dim.markerShape,
                  vx,
                  vy,
                  r.dim.colorCssVar,
                )}
                <text
                  x={lx}
                  y={ly}
                  textAnchor={textAnchor}
                  dominantBaseline="middle"
                  fill="var(--color-ink)"
                  stroke="var(--color-surface)"
                  strokeWidth="3.5"
                  paintOrder="stroke"
                  className="font-mono-tabular"
                  fontSize="11"
                  fontWeight="700"
                >
                  <title>{`${r.dim.consumerLabel || r.dim.name}: ${r.score !== null ? `${r.score}% ± ${halfBand}%` : 'Unassessed'}`}</title>
                  {`${r.dim.markerGlyph} ${r.dim.code} ${
                    r.score !== null ? `${r.score}%±${halfBand}` : 'N/A'
                  }`}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {showTable && (
        <div className="mt-4 overflow-x-auto">
          <table
            className="w-full border-collapse text-sm"
            aria-label={`${title} accessible data table`}
          >
            <thead>
              <tr className="border-b-2 border-border-strong text-start">
                <th scope="col" className="py-2 pe-3 text-start font-semibold">
                  Dimension
                </th>
                <th scope="col" className="py-2 px-3 text-start font-semibold">
                  Estimate
                </th>
                <th scope="col" className="py-2 px-3 text-start font-semibold">
                  95% CI Range
                </th>
                <th scope="col" className="py-2 ps-3 text-start font-semibold">
                  Confidence
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const halfBand = Math.round((r.ciUpper - r.ciLower) / 2)
                return (
                  <tr
                    key={r.dim.id}
                    className="border-b border-border"
                  >
                    <td className="py-2 pe-3 font-medium">
                      <span aria-hidden="true" className="me-1.5">
                        {r.dim.markerGlyph}
                      </span>
                      {r.dim.consumerLabel ? <><span className="font-bold">{r.dim.consumerLabel}</span> <span className="text-xs text-ink-muted">({r.dim.name})</span></> : r.dim.name} ({r.dim.code})
                    </td>
                    <td className="py-2 px-3 font-mono-tabular">
                      {r.score !== null ? `${r.score}% ± ${halfBand}%` : 'Not yet assessed'}
                    </td>
                    <td className="py-2 px-3 font-mono-tabular">
                      {r.score !== null ? `${r.ciLower}% – ${r.ciUpper}%` : '—'}
                    </td>
                    <td className="py-2 ps-3">
                      <Badge
                        tone={r.isLowConf ? 'low-confidence' : 'success'}
                        glyph={r.isLowConf ? '▨' : '●'}
                      >
                        {Math.round(r.confidence * 100)}%{' '}
                        {r.isLowConf ? '(Preliminary)' : '(Calibrated)'}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
