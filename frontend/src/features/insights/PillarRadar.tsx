import { PILLAR_IDS, PILLAR_LABELS, type PillarId, type PillarScore } from './pillars'

/* The five-pillar radar: one dataset, a 20% sky fill and a full-opacity border, plain labels and
   numbers on the axes (spec charts table). A pillar without a score reads "Not measured yet" and
   gets no point: no fake value. Screen readers get a visually hidden table.
   ponytail: the minimal radar for /results. Ticket 08 extends it (the "View as table" toggle, the
   bar view, uncertainty) for the dashboard. */

export const NOT_MEASURED = 'Not measured yet'

const W = 400
const H = 315
const CX = 200
const CY = 160
const R = 90
const LABEL_GAP = 14
const LINE = 18

const angle = (k: number) => ((-90 + k * (360 / PILLAR_IDS.length)) * Math.PI) / 180
const at = (k: number, r: number): [number, number] => [CX + r * Math.cos(angle(k)), CY + r * Math.sin(angle(k))]
const pts = (ps: [number, number][]) => ps.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

/** The value as shown: a whole number, or "Not measured yet". */
export const shownScore = (s: PillarScore) => (s.score === null ? NOT_MEASURED : String(Math.round(s.score)))

function AxisLabel({ k, pillar, score }: { k: number; pillar: PillarId; score: PillarScore }) {
  const [x, y] = at(k, R + LABEL_GAP)
  // Two lines, split at the last space ("Focus &" / "Strategy"), keep every label inside the box.
  const label = PILLAR_LABELS[pillar]
  const cut = label.lastIndexOf(' ')
  const name = cut < 0 ? [label] : [label.slice(0, cut), label.slice(cut + 1)]
  const lines = name.length + 1
  const side = Math.abs(x - CX) < 1 ? 'middle' : x > CX ? 'start' : 'end'
  // Top label sits above its point, bottom ones below, side ones centred on it.
  const top = y < CY - R / 2 ? y - lines * LINE + 12 : y > CY + R / 2 ? y + 12 : y - (lines * LINE) / 2 + 12
  return (
    <text x={x} y={top} textAnchor={side} className="fill-ink">
      {name.map((word, i) => (
        <tspan key={i} x={x} dy={i ? LINE : 0} fontSize={15} fontWeight={500}>
          {word}
        </tspan>
      ))}
      {score.score === null ? (
        <tspan x={x} dy={LINE} fontSize={12} className="fill-ink-muted">
          {NOT_MEASURED}
        </tspan>
      ) : (
        <tspan x={x} dy={LINE} fontSize={17} fontWeight={700} className="tabular-nums">
          {Math.round(score.score)}
        </tspan>
      )}
    </text>
  )
}

export interface PillarRadarProps {
  scores: Record<PillarId, PillarScore>
  /** Results stay blurred until the consent choice (the one allowed blur, anti-slop rule 2). */
  blurred?: boolean
  className?: string
}

export function PillarRadar({ scores, blurred = false, className = '' }: PillarRadarProps) {
  const measured = PILLAR_IDS.flatMap((p, k) => {
    const s = scores[p].score
    return s === null ? [] : [at(k, (R * Math.min(100, Math.max(0, s))) / 100)]
  })
  return (
    <figure data-blurred={blurred} className={`m-0 w-full ${className}`}>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${W} ${H}`}
        className={`block h-auto w-full select-none font-sans transition duration-500 ease-out motion-reduce:transition-none ${blurred ? 'blur-md' : ''}`}
      >
        {[1 / 3, 2 / 3, 1].map((f) => (
          <polygon key={f} points={pts(PILLAR_IDS.map((_, k) => at(k, R * f)))} className="fill-none stroke-border" />
        ))}
        {PILLAR_IDS.map((p, k) => {
          const [x, y] = at(k, R)
          return <line key={p} x1={CX} y1={CY} x2={x} y2={y} className="stroke-border" />
        })}
        {measured.length >= 3 && (
          <polygon points={pts(measured)} strokeWidth={2} strokeLinejoin="round" className="fill-brand-vivid/20 stroke-brand-vivid" />
        )}
        {measured.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4} className="fill-brand-vivid" />
        ))}
        {PILLAR_IDS.map((p, k) => (
          <AxisLabel key={p} k={k} pillar={p} score={scores[p]} />
        ))}
      </svg>
      {/* Hidden while blurred: the blur must not be read out either. */}
      {!blurred && (
        <table className="sr-only">
          <caption>Your five skills, out of 100</caption>
          <tbody>
            {PILLAR_IDS.map((p) => (
              <tr key={p}>
                <th scope="row">{PILLAR_LABELS[p]}</th>
                <td>{shownScore(scores[p])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  )
}
