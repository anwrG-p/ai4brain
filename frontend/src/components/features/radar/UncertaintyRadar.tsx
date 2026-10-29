import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { scaleLinear } from 'd3-scale'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
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
  bare?: boolean
  interactive?: boolean
  selectedDimensionId?: string | null
  onSelectDimension?: (dimId: string | null) => void
  size?: number
  className?: string
  style?: React.CSSProperties
  cardOffsetFromCenter?: number
  cardOffsetY?: number
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
  customRadius?: number,
) {
  const r = customRadius ?? 6
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
  bare = false,
  interactive = false,
  selectedDimensionId,
  onSelectDimension,
  size,
  className,
  style,
  cardOffsetFromCenter,
  cardOffsetY = 0,
}: UncertaintyRadarProps) {
  const [showTable, setShowTable] = useState(defaultShowTable)
  const [internalSelectedDim, setInternalSelectedDim] = useState<string | null>(null)
  const activeSelectedDimId =
    selectedDimensionId !== undefined ? selectedDimensionId : internalSelectedDim

  const handleSelectDimension = (dimId: string | null) => {
    const next = activeSelectedDimId === dimId ? null : dimId
    if (onSelectDimension) {
      onSelectDimension(next)
    }
    setInternalSelectedDim(next)
  }

  useEffect(() => {
    if (!interactive || !activeSelectedDimId) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSelectDimension(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [interactive, activeSelectedDimId])

  const radarSize = size ?? (bare ? 660 : 430)
  const center = radarSize / 2
  const maxRadius = bare ? Math.round(radarSize * 0.3) : 112
  const labelRadius = bare ? Math.round(radarSize * 0.385) : 142
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
    const verticalBoost = Math.abs(Math.sin(angle)) > 0.85 ? (bare ? 12 : 10) : 0
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
  const selectedRow = rows.find((r) => r.dim.id === activeSelectedDimId)

  const getDimensionCardSide = (row: typeof selectedRow): 'left' | 'right' => {
    if (!row) return 'left'
    if (row.dim.code === 'WM' || row.dim.id === 'working_memory') {
      return 'right'
    }
    const [lx] = labelPointAt(row.idx)
    return lx >= center ? 'right' : 'left'
  }

  const cardSide = selectedRow ? getDimensionCardSide(selectedRow) : null

  const halfRadar = radarSize / 2
  const cardMargin =
    cardOffsetFromCenter !== undefined ? cardOffsetFromCenter - halfRadar : 24

  const renderDetailCard = (row: NonNullable<typeof selectedRow>) => (
    <div className="p-5 sm:p-6 rounded-2xl bg-surface border-2 border-border-strong shadow-doodle space-y-4 text-start relative">
      {/* Top: Glyph + Code + Close Button */}
      <div className="flex items-start justify-between gap-3 border-b-2 border-dashed border-border-strong/30 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span
              className="text-lg leading-none"
              style={{ color: row.dim.colorCssVar }}
              aria-hidden="true"
            >
              {row.dim.markerGlyph}
            </span>
            <span className="font-mono text-xs font-bold text-ink-muted uppercase tracking-wider">
              {row.dim.code} · {row.dim.consumerLabel || 'Cognitive Dimension'}
            </span>
          </div>
          <h3 className="font-display text-xl font-bold text-ink tracking-tight m-0">
            {row.dim.name}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => handleSelectDimension(null)}
          aria-label="Close dimension details"
          className="focus-ring p-1.5 rounded-lg border border-border-strong/40 bg-surface hover:bg-surface-raised active:scale-90 text-ink-muted hover:text-ink cursor-pointer transition-all shadow-xs shrink-0"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Score & Confidence Range Display */}
      <div className="p-3.5 rounded-xl bg-surface-raised border border-border-strong/30 space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-display text-3xl font-black text-ink">
              {row.score !== null ? `${row.score}%` : 'N/A'}
            </span>
            <span className="font-mono text-xs text-ink-muted ms-2">
              {row.score !== null
                ? `±${Math.round((row.ciUpper - row.ciLower) / 2)}% CI`
                : 'Uncalibrated'}
            </span>
          </div>
          <Badge
            tone={row.isLowConf ? 'low-confidence' : 'success'}
            glyph={row.isLowConf ? '▨' : '●'}
          >
            {row.isLowConf ? 'Preliminary (<60%)' : 'Calibrated (95% CI)'}
          </Badge>
        </div>

        {/* Horizontal Visual CI Range Scale */}
        {row.score !== null && (
          <div className="space-y-1 pt-1">
            <div className="relative w-full h-3 bg-surface rounded-pill border border-border-strong/40 overflow-hidden">
              {/* Shaded CI Range */}
              <div
                className="absolute h-full bg-brand/25 border-x border-brand"
                style={{
                  left: `${row.ciLower}%`,
                  width: `${Math.max(row.ciUpper - row.ciLower, 4)}%`,
                }}
              />
              {/* Point estimate marker */}
              <div
                className="absolute top-0 bottom-0 w-1.5 bg-brand rounded-full shadow-xs"
                style={{ left: `calc(${row.score}% - 3px)` }}
              />
            </div>
            <div className="flex justify-between text-xs font-mono text-ink-muted">
              <span>0%</span>
              <span>
                Range: {row.ciLower}% – {row.ciUpper}%
              </span>
              <span>100%</span>
            </div>
          </div>
        )}
      </div>

      {/* Plain-English Cognitive Explanation */}
      <div className="space-y-1.5 text-xs text-ink">
        <p className="font-semibold text-ink m-0">
          {row.dim.shortDescription}
        </p>
        {row.dim.scientificDefinition && (
          <p className="text-ink-muted leading-relaxed m-0 text-xs">
            {row.dim.scientificDefinition}
          </p>
        )}
      </div>

      {/* Task & Telemetry details */}
      <div className="pt-2 border-t border-dashed border-border-strong/30 flex items-center justify-between text-xs font-mono text-ink-muted">
        <span className="truncate max-w-44" title={row.dim.taskName}>
          {row.dim.taskName}
        </span>
        {row.meanRtMs > 0 && (
          <span className="font-bold text-ink shrink-0">
            {row.meanRtMs} ms RT
          </span>
        )}
      </div>

      {/* Practice / Deep Dive Button */}
      <div className="pt-1">
        <Link
          to="/task/episodic_pattern_separation"
          className="tactile-btn w-full py-2.5 px-4 rounded-xl bg-brand text-brand-ink font-display text-sm font-bold border-2 border-border-strong shadow-doodle-sm hover:shadow-doodle no-underline inline-flex items-center justify-center gap-2 text-center transition-all"
        >
          <span>Practice {row.dim.code} Flow</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )

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
    <div
      style={style}
      className={`${bare ? 'w-full' : 'tactile-card p-5'} ${className || ''}`.trim()}
    >
      {/* Header bar only rendered if !bare and (title or showTableToggle or hasAnyLowConfidence) */}
      {!bare && (Boolean(title) || showTableToggle || hasAnyLowConfidence) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            {title &&
              (headingLevel === 'h3' ? (
                <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
              ) : (
                <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
              ))}
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
      )}

      {/* Main Interactive Graph Stage */}
      <div className="w-full flex flex-col items-center justify-center pt-2">
        <div className="w-full flex flex-col lg:flex-row items-center justify-center gap-y-6 lg:gap-0 relative">
          {/* LEFT: Dimension Detail Info Card (Only for Left-side dimensions) */}
          <AnimatePresence>
            {interactive && selectedRow && cardSide === 'left' && (
              <motion.div
                key={`card-left-${selectedRow.dim.id}`}
                initial={{ opacity: 0, x: -28, y: cardOffsetY, scale: 0.96 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  y: cardOffsetY,
                  scale: 1,
                  transition: { type: 'spring', stiffness: 340, damping: 28 },
                }}
                exit={{
                  opacity: 0,
                  x: -20,
                  y: cardOffsetY,
                  scale: 0.94,
                  transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] },
                }}
                className="w-full sm:w-80 lg:w-80 shrink-0 z-10"
                style={{ marginRight: `${cardMargin}px` }}
              >
                {renderDetailCard(selectedRow)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* CENTER: The Radar SVG Graph (layout animated, maintaining its exact scale) */}
          <motion.div
            layout="position"
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 26,
              mass: 0.8,
            }}
            className="flex flex-col items-center justify-center shrink-0"
            style={{ width: `${radarSize}px`, maxWidth: '100%' }}
          >
            <svg
              viewBox={`0 0 ${radarSize} ${radarSize}`}
              style={{ width: `${radarSize}px`, maxWidth: '100%' }}
              className="h-auto overflow-visible select-none"
              role="img"
              aria-label={`${title || 'Cognitive Radar'} across ${dimensions.length} cognitive dimensions`}
              onClick={(e) => {
                if (e.target === e.currentTarget && interactive && activeSelectedDimId) {
                  handleSelectDimension(null)
                }
              }}
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

              {/* Concentric reference polygons & scale percentages */}
              {rings.map((ringPct) => {
                const poly = rows
                  .map((r) => pointAt(r.idx, ringPct).join(','))
                  .join(' ')
                const [, ringY] = pointAt(0, ringPct)
                return (
                  <g key={ringPct}>
                    <polygon
                      points={poly}
                      fill="none"
                      stroke="var(--color-border)"
                      strokeDasharray={ringPct === 100 ? undefined : '3 3'}
                      strokeWidth={ringPct === 100 ? (bare ? 2 : 1.5) : 1}
                    />
                    <text
                      x={center + 5}
                      y={ringY - 4}
                      fill="var(--color-ink-muted)"
                      fontSize={bare ? '10' : '9'}
                      fontFamily="inherit"
                      className="font-mono-tabular select-none pointer-events-none opacity-50 font-bold"
                    >
                      {ringPct}%
                    </text>
                  </g>
                )
              })}

              {/* Axis spokes */}
              {rows.map((r) => {
                const [x2, y2] = pointAt(r.idx, 100)
                const isSelected = activeSelectedDimId === r.dim.id
                return (
                  <line
                    key={r.dim.id}
                    x1={center}
                    y1={center}
                    x2={x2}
                    y2={y2}
                    stroke={isSelected ? 'var(--color-brand)' : 'var(--color-border)'}
                    strokeWidth={isSelected ? 3 : 1.25}
                    strokeDasharray={isSelected ? undefined : '2 2'}
                    className="transition-all duration-300 ease-out"
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
                strokeWidth={bare ? 2 : 1.5}
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
                strokeWidth={bare ? 3 : 2.5}
              />

              {/* Distinct Vertex Markers & Direct Labels */}
              {rows.map((r) => {
                const val = r.score !== null ? r.score : 50
                const [vx, vy] = pointAt(r.idx, val)
                const [lx, ly] = labelPointAt(r.idx)
                const isSelected = activeSelectedDimId === r.dim.id
                const textAnchor =
                  Math.abs(lx - center) < 14
                    ? 'middle'
                    : lx > center
                      ? 'start'
                      : 'end'
                const halfBand = Math.round((r.ciUpper - r.ciLower) / 2)

                return (
                  <g
                    key={r.dim.id}
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    aria-label={`${r.dim.name}: ${
                      r.score !== null ? `${r.score}% ± ${halfBand}%` : 'Unassessed'
                    }`}
                    aria-pressed={interactive ? isSelected : undefined}
                    onClick={() => interactive && handleSelectDimension(r.dim.id)}
                    onKeyDown={(e) => {
                      if (interactive && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        handleSelectDimension(r.dim.id)
                      }
                    }}
                    className={
                      interactive
                        ? 'cursor-pointer group select-none focus:outline-none'
                        : 'select-none'
                    }
                  >
                    {/* Invisible enlarged hit target for effortless tapping */}
                    {interactive && (
                      <circle cx={vx} cy={vy} r={bare ? 28 : 22} fill="transparent" />
                    )}

                    {/* Selected Animated Halo Ring with smooth enter & exit */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.circle
                          key={`halo-${r.dim.id}`}
                          cx={vx}
                          cy={vy}
                          r={bare ? 16 : 13}
                          fill="none"
                          stroke="var(--color-brand)"
                          strokeWidth={2.5}
                          strokeDasharray="3 2"
                          className="animate-spin"
                          style={{
                            transformOrigin: `${vx}px ${vy}px`,
                            animationDuration: '6s',
                          }}
                          initial={{ scale: 0.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.3, opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Vertex Marker with scale-up on hover/selected and smooth return on deselect */}
                    <g
                      className={`transition-transform duration-300 ease-out ${
                        isSelected
                          ? 'scale-125'
                          : interactive
                            ? 'group-hover:scale-125'
                            : ''
                      }`}
                      style={{ transformOrigin: `${vx}px ${vy}px` }}
                    >
                      {renderVertexMarker(
                        r.dim.markerShape,
                        vx,
                        vy,
                        r.dim.colorCssVar,
                        bare ? 8 : 6,
                      )}
                    </g>

                    {/* Selected Label Backdrop Pill with smooth enter & exit */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.rect
                          key={`pill-${r.dim.id}`}
                          x={
                            textAnchor === 'middle'
                              ? lx - (bare ? 54 : 44)
                              : textAnchor === 'start'
                                ? lx - 6
                                : lx - (bare ? 102 : 82)
                          }
                          y={ly - (bare ? 13 : 10)}
                          width={bare ? 108 : 88}
                          height={bare ? 26 : 20}
                          rx={bare ? 13 : 10}
                          fill="var(--color-brand)"
                          stroke="var(--color-border-strong)"
                          strokeWidth={1.5}
                          className="shadow-xs"
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.7, opacity: 0 }}
                          style={{ transformOrigin: `${lx}px ${ly}px` }}
                          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Label Text */}
                    <text
                      x={lx}
                      y={ly}
                      textAnchor={textAnchor}
                      dominantBaseline="middle"
                      fill={isSelected ? 'var(--color-brand-ink)' : 'var(--color-ink)'}
                      stroke={isSelected ? 'none' : 'var(--color-surface)'}
                      strokeWidth={isSelected ? 0 : 4}
                      paintOrder="stroke"
                      className="font-mono-tabular transition-colors duration-200"
                      fontSize={bare ? (isSelected ? '14' : '13') : (isSelected ? '12' : '11')}
                      fontWeight="700"
                    >
                      <title>{`${r.dim.consumerLabel || r.dim.name}: ${
                        r.score !== null ? `${r.score}% ± ${halfBand}%` : 'Unassessed'
                      }`}</title>
                      {`${r.dim.markerGlyph} ${r.dim.code} ${
                        r.score !== null ? `${r.score}%±${halfBand}` : 'N/A'
                      }`}
                    </text>
                  </g>
                )
              })}
            </svg>
          </motion.div>

          {/* RIGHT: Dimension Detail Info Card (For Right-side dimensions & WM) */}
          <AnimatePresence>
            {interactive && selectedRow && cardSide === 'right' && (
              <motion.div
                key={`card-right-${selectedRow.dim.id}`}
                initial={{ opacity: 0, x: 28, y: cardOffsetY, scale: 0.96 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  y: cardOffsetY,
                  scale: 1,
                  transition: { type: 'spring', stiffness: 340, damping: 28 },
                }}
                exit={{
                  opacity: 0,
                  x: 20,
                  y: cardOffsetY,
                  scale: 0.94,
                  transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] },
                }}
                className="w-full sm:w-80 lg:w-80 shrink-0 z-10"
                style={{ marginLeft: `${cardMargin}px` }}
              >
                {renderDetailCard(selectedRow)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Interactive Dimension Quick-Select Chips Row */}
        {interactive && (
          <div
            role="group"
            aria-label="Cognitive dimension selector"
            className="mt-6 flex flex-wrap items-center justify-center gap-2.5 max-w-3xl px-2"
          >
            {rows.map((r) => {
              const isSelected = activeSelectedDimId === r.dim.id
              const halfBand = Math.round((r.ciUpper - r.ciLower) / 2)
              return (
                <button
                  key={r.dim.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelectDimension(r.dim.id)}
                  className={`focus-ring px-3.5 py-1.5 rounded-pill border-2 text-xs sm:text-sm font-mono font-bold flex items-center gap-1.5 transition-all duration-300 ease-out active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-brand text-brand-ink border-border-strong shadow-doodle-sm scale-105'
                      : 'bg-surface text-ink border-border-strong/40 hover:border-border-strong hover:bg-surface-raised shadow-xs'
                  }`}
                >
                  <span style={{ color: isSelected ? 'inherit' : r.dim.colorCssVar }}>
                    {r.dim.markerGlyph}
                  </span>
                  <span>{r.dim.code}</span>
                  <span className="opacity-80">
                    {r.score !== null ? `${r.score}%±${halfBand}` : 'N/A'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {showTable && (
        <div className="mt-4 overflow-x-auto">
          <table
            className="w-full border-collapse text-sm"
            aria-label={`${title || 'Cognitive Radar'} accessible data table`}
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
                  <tr key={r.dim.id} className="border-b border-border">
                    <td className="py-2 pe-3 font-medium">
                      <span aria-hidden="true" className="me-1.5">
                        {r.dim.markerGlyph}
                      </span>
                      {r.dim.consumerLabel ? (
                        <>
                          <span className="font-bold">{r.dim.consumerLabel}</span>{' '}
                          <span className="text-xs text-ink-muted">
                            ({r.dim.name})
                          </span>
                        </>
                      ) : (
                        r.dim.name
                      )}{' '}
                      ({r.dim.code})
                    </td>
                    <td className="py-2 px-3 font-mono-tabular">
                      {r.score !== null
                        ? `${r.score}% ± ${halfBand}%`
                        : 'Not yet assessed'}
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
