import { useId, useState, type CSSProperties } from 'react'
import { PILLAR_IDS, PILLAR_LABELS, type PillarId, type PillarScore } from './pillars'
import { useWidth } from './useWidth'

/* The five-pillar radar (Results and Home): one dataset, a 20% sky fill and a full-opacity border,
   plain labels on the axes with a whole number, or "—" for a pillar with no score yet (no point, no
   fake value). A coral "Real improvement" tag marks a pillar that passed RCI >= 1.96. The SVG is drawn
   in real pixels (useWidth), so every label stays at 14 px or more on a phone. The data table is for
   screen readers; with `tableToggle` a small "View as table" link also shows it (with bars) on screen.
   The table is the one place that shows each score's range ("62 · likely 55–69").
   No legend, bands or view switch here: they live behind "Further explore my training" (rule 13). */

export const NOT_MEASURED = 'Not measured yet'
export const REAL_IMPROVEMENT = 'Real improvement'

const GAP = 10
const NAME = 14 // px, the pillar name
const NAME_LINE = 18
const NUM = 18 // px, the score
const NUM_LINE = 22
const SIDE_ROOM = 64 // px beside a side vertex: the longest name word ("Strategy", "Control")
const SIDE_ROOM_TAG = 96 // ... or "improvement" at 14 px
const COS18 = Math.cos(Math.PI / 10)

/** The value as read out: a whole number, or "Not measured yet". */
export const shownScore = (s: PillarScore) => (s.score === null ? NOT_MEASURED : String(Math.round(s.score)))

const clamp100 = (n: number) => Math.round(Math.min(100, Math.max(0, n)))
/** The table's value: "62 · likely 55–69" from the score's ~95% half-width (user decision,
    2026-10-31: ranges live in the table only; the radar keeps one number). */
export const scoreWithRange = (s: PillarScore) =>
  s.score === null ? NOT_MEASURED : `${Math.round(s.score)} · likely ${clamp100(s.score - s.uncertainty)}–${clamp100(s.score + s.uncertainty)}`

const angle = (k: number) => ((-90 + k * (360 / PILLAR_IDS.length)) * Math.PI) / 180
const isSide = (k: number) => k === 1 || k === 4

/** The label's two name lines ("Focus &" / "Strategy"). */
function nameLines(pillar: PillarId): string[] {
  const label = PILLAR_LABELS[pillar]
  const cut = label.lastIndexOf(' ')
  return cut < 0 ? [label] : [label.slice(0, cut), label.slice(cut + 1)]
}
const isBottom = (k: number) => k === 2 || k === 3
// The tag wraps ("Real" / "improvement") everywhere but on the top label, which has the width.
const tagLines = (k: number) => (k === 0 ? 1 : 2)
const TAG_WIDTH = 92 // px, "improvement" at 14 px semibold
const labelHeight = (k: number, tagged: boolean) => 2 * NAME_LINE + NUM_LINE + (tagged ? tagLines(k) * NAME_LINE : 0)

function geometry(width: number, improved: ReadonlySet<PillarId>) {
  const tagged = (k: number) => improved.has(PILLAR_IDS[k]!)
  const side = tagged(1) || tagged(4) ? SIDE_ROOM_TAG : SIDE_ROOM
  const r = Math.max(56, Math.min(140, (width - 2 * (side + GAP)) / (2 * COS18)))
  const top = labelHeight(0, tagged(0)) + GAP
  const cy = top + r
  const bottom = Math.max(labelHeight(2, tagged(2)), labelHeight(3, tagged(3))) + GAP
  const height = Math.ceil(cy + r * Math.cos(Math.PI / 5) + bottom + 4)
  const cx = width / 2
  const at = (k: number, rr: number): [number, number] => [cx + rr * Math.cos(angle(k)), cy + rr * Math.sin(angle(k))]
  return { r, cx, cy, height, at, tagged }
}

const pts = (ps: [number, number][]) => ps.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

type Geometry = ReturnType<typeof geometry>

function AxisLabel({ k, pillar, score, g }: { k: number; pillar: PillarId; score: PillarScore; g: Geometry }) {
  const [vx, vy] = g.at(k, g.r)
  const tagged = g.tagged(k)
  const h = labelHeight(k, tagged)
  // Top label sits above its vertex, the bottom two below theirs, the side two beside theirs. On a
  // narrow radar the bottom two lean outward so their texts cannot meet in the middle.
  const right = vx > g.cx
  const lean = isBottom(k) && 2 * (vx - g.cx) * (right ? 1 : -1) < TAG_WIDTH + 2 * GAP
  const anchor = isSide(k) || lean ? (right ? 'start' : 'end') : 'middle'
  const x = isSide(k) ? vx + (right ? GAP : -GAP) : lean ? vx + (right ? -2 * GAP : 2 * GAP) : vx
  const blockTop = k === 0 ? vy - GAP - h : isSide(k) ? vy - h / 2 : vy + GAP
  const baseline = blockTop + NAME // first line's baseline
  const names = nameLines(pillar)
  const numY = baseline + NAME_LINE * (names.length - 1) + NUM_LINE
  return (
    <>
      <text x={x} y={baseline} textAnchor={anchor} className="fill-ink">
        {names.map((word, i) => (
          <tspan key={i} x={x} dy={i ? NAME_LINE : 0} fontSize={NAME} fontWeight={500}>
            {word}
          </tspan>
        ))}
        <tspan
          x={x}
          dy={NUM_LINE}
          fontSize={NUM}
          fontWeight={700}
          className={score.score === null ? 'fill-ink-muted' : 'tabular-nums'}
        >
          {score.score === null ? '—' : Math.round(score.score)}
        </tspan>
      </text>
      {tagged && (
        <text
          data-real-improvement={pillar}
          x={x}
          y={numY + NAME_LINE}
          textAnchor={anchor}
          fontSize={NAME}
          fontWeight={600}
          className="fill-accent-strong"
        >
          {tagLines(k) === 2 ? (
            <>
              <tspan x={x} fontSize={NAME}>
                {'Real '}
              </tspan>
              <tspan x={x} dy={NAME_LINE} fontSize={NAME}>
                improvement
              </tspan>
            </>
          ) : (
            REAL_IMPROVEMENT
          )}
        </text>
      )}
    </>
  )
}

export interface PillarRadarProps {
  scores: Record<PillarId, PillarScore>
  /** Pillars that passed RCI >= 1.96: tagged "Real improvement". */
  improved?: readonly PillarId[]
  /** Results stay blurred until the consent choice (the one allowed blur, anti-slop rule 2). */
  blurred?: boolean
  /** Adds the small "View as table" link (Home). */
  tableToggle?: boolean
  /** The shape grows from the centre once, on mount (spec R8). */
  grow?: boolean
  className?: string
}

export function PillarRadar({ scores, improved = [], blurred = false, tableToggle = false, grow = false, className = '' }: PillarRadarProps) {
  const [ref, width] = useWidth<HTMLDivElement>(400)
  const [showTable, setShowTable] = useState(false)
  const tableId = useId()
  const better = new Set(improved)
  const g = geometry(width, better)
  const measured = PILLAR_IDS.flatMap((p, k) => {
    const s = scores[p].score
    return s === null ? [] : [g.at(k, (g.r * Math.min(100, Math.max(0, s))) / 100)]
  })
  const origin: CSSProperties = { transformOrigin: `${g.cx}px ${g.cy}px` }
  return (
    <figure data-blurred={blurred} className={`m-0 w-full ${className}`}>
      <div ref={ref} className="w-full">
        <svg
          aria-hidden="true"
          width={width}
          height={g.height}
          viewBox={`0 0 ${width} ${g.height}`}
          className={`block max-w-full select-none font-sans transition duration-500 ease-out motion-reduce:transition-none ${blurred ? 'blur-md' : ''}`}
        >
          {[1 / 3, 2 / 3, 1].map((f) => (
            <polygon key={f} points={pts(PILLAR_IDS.map((_, k) => g.at(k, g.r * f)))} className="fill-none stroke-border" />
          ))}
          {PILLAR_IDS.map((p, k) => {
            const [x, y] = g.at(k, g.r)
            return <line key={p} x1={g.cx} y1={g.cy} x2={x} y2={y} className="stroke-border" />
          })}
          <g className={grow ? 'anim-radar-grow' : undefined} style={origin}>
            {measured.length >= 3 && (
              <polygon points={pts(measured)} strokeWidth={2} strokeLinejoin="round" className="fill-brand-vivid/20 stroke-brand-vivid" />
            )}
            {measured.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={4} className="fill-brand-vivid" />
            ))}
          </g>
          {PILLAR_IDS.map((p, k) => (
            <AxisLabel key={p} k={k} pillar={p} score={scores[p]} g={g} />
          ))}
        </svg>
      </div>
      {/* Hidden while blurred: the blur must not be read out either. */}
      {!blurred && (
        <>
          <table id={tableId} className={showTable ? 'mx-auto mt-2 border-collapse text-sm text-ink' : 'sr-only'}>
            <caption className={showTable ? 'sr-only' : undefined}>Your five skills, out of 100</caption>
            <tbody>
              {PILLAR_IDS.map((p) => {
                const s = scores[p].score
                return (
                  <tr key={p} className="border-b border-border last:border-b-0">
                    <th scope="row" className="py-1.5 pr-4 text-left font-medium">
                      {PILLAR_LABELS[p]}
                    </th>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${better.has(p) ? 'text-accent-strong' : ''}`}>
                      {scoreWithRange(scores[p]) + (better.has(p) ? ', real improvement' : '')}
                    </td>
                    {showTable && (
                      <td aria-hidden="true" className="w-24 py-1.5">
                        <div className="h-2 w-full rounded-pill bg-surface-raised">
                          {s !== null && <div className="h-2 rounded-pill bg-brand-vivid" style={{ width: `${Math.min(100, Math.max(0, s))}%` }} />}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {tableToggle && (
            <div className="mt-1 text-center">
              <button
                type="button"
                aria-expanded={showTable}
                aria-controls={tableId}
                onClick={() => setShowTable((v) => !v)}
                className="focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-sm text-sm font-medium text-brand underline underline-offset-4"
              >
                {showTable ? 'Hide table' : 'View as table'}
              </button>
            </div>
          )}
        </>
      )}
    </figure>
  )
}
