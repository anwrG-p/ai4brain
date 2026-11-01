import { scaleLinear, scaleTime } from 'd3-scale'
import { curveMonotoneX, line } from 'd3-shape'
import { Loti } from '../../components/features/characters'
import { curveWindow, type HistoryPoint } from './dashboard'
import { projection } from './projection'
import { useWidth } from './useWidth'

/* The progress curve: the unified score as a smooth solid sky line with one dot per session. From the
   3rd session one dashed line, "If you keep training", projects ahead (the doc's asymptotic model).
   Review fixes (ticket 08): no goal marker (a per-pillar goal on the overall score could look met on
   the day it is set, or be met by another skill; goals show against their own pillar instead) and no
   coral milestone (it applied pillar-level RCI settings to the overall score).
   User decision (2026-10-31): no "If you pause" line and no idle decay (no evidence for the rate, and
   it reads as a guilt penalty), and no projection on fewer than 3 points. The legend names the line
   styles (at most 2). No bands and no toggles (rule 13). Drawn in real pixels so text stays 14 px. */

export const CURVE_EMPTY = 'Finish one session to see your curve.'
/** The projection appears from this many sessions. */
export const PROJECT_FROM = 3
export const DASHED = '8 6' // If you keep training
/** Both lines and the dots; the methodology page's swatches use it too. */
export const CURVE_STROKE = 'stroke-brand-vivid'

const HEIGHT = 220
const M = { top: 16, right: 16, bottom: 30, left: 36 }
const TEXT = 14

const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export interface ProgressCurveProps {
  history: readonly HistoryPoint[]
  now: Date
}

export function ProgressCurve({ history, now }: ProgressCurveProps) {
  const [ref, width] = useWidth<HTMLDivElement>(600)

  if (!history.length) {
    return (
      <div className="flex items-end gap-3">
        <Loti size="sm" pose="think" className="shrink-0" />
        <p className="tactile-card max-w-md px-4 py-3 text-base text-ink">{CURVE_EMPTY}</p>
      </div>
    )
  }

  const project = history.length >= PROJECT_FROM
  const win = curveWindow(history, now)
  const last = history.at(-1)!
  const lastPoint = { at: Date.parse(last.at), score: last.score }
  const keep = project ? [lastPoint, ...projection(history, { now, days: 30 })!.optimal.slice(0, win.horizonDays + 1)] : null
  const xEnd = keep ? win.end : now.getTime()

  const x = scaleTime().domain([win.start, xEnd]).range([M.left, width - M.right])
  const y = scaleLinear().domain([0, 100]).range([HEIGHT - M.bottom, M.top])
  const path = line<{ at: number; score: number }>()
    .x((p) => x(p.at))
    .y((p) => y(p.score))
    .curve(curveMonotoneX)
  const actual = history.map((h) => ({ at: Date.parse(h.at), score: h.score }))
  const first = history[0]!.score
  const end = keep?.at(-1)
  const summary =
    (history.length === 1
      ? `Your score: ${Math.round(first)} after 1 session.`
      : `Your score went from ${Math.round(first)} to ${Math.round(last.score)} over ${history.length} sessions.`) +
    (end ? ` If you keep training, about ${Math.round(end.score)} by ${day(end.at)}.` : '')
  const legend = [
    { label: 'Your score', dash: undefined, width: 3 },
    ...(keep ? [{ label: 'If you keep training', dash: DASHED, width: 2.5 }] : []),
  ]

  return (
    <figure className="m-0">
      <div ref={ref} className="w-full">
        <svg aria-hidden="true" width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} className="block max-w-full select-none font-sans">
          {[0, 50, 100].map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="stroke-border" />
              <text x={M.left - 8} y={y(t) + 5} textAnchor="end" fontSize={TEXT} className="fill-ink-muted tabular-nums">
                {t}
              </text>
            </g>
          ))}
          {keep && <path data-line="keep" d={path(keep) ?? ''} fill="none" strokeWidth={2.5} strokeDasharray={DASHED} className={CURVE_STROKE} />}
          <path data-line="actual" d={path(actual) ?? ''} fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={CURVE_STROKE} />
          {actual.map((p, i) => (
            <circle key={i} data-session cx={x(p.at)} cy={y(p.score)} r={4} className="fill-brand-vivid" />
          ))}
          <text x={M.left} y={HEIGHT - 8} fontSize={TEXT} className="fill-ink-muted">
            {day(win.start)}
          </text>
          <text x={x(now.getTime())} y={HEIGHT - 8} textAnchor={keep ? 'middle' : 'end'} fontSize={TEXT} className="fill-ink-muted">
            Today
          </text>
          {keep && (
            <text x={width - M.right} y={HEIGHT - 8} textAnchor="end" fontSize={TEXT} className="fill-ink-muted">
              {day(xEnd)}
            </text>
          )}
        </svg>
      </div>
      <p className="sr-only">{summary}</p>
      <ul aria-label="Line styles" className="m-0 mt-2 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 text-sm text-ink-muted">
        {legend.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <svg aria-hidden="true" width={28} height={8} className="shrink-0">
              <line x1={2} x2={26} y1={4} y2={4} strokeWidth={item.width} strokeLinecap={item.dash ? 'butt' : 'round'} strokeDasharray={item.dash} className={CURVE_STROKE} />
            </svg>
            {item.label}
          </li>
        ))}
      </ul>
      {history.length < PROJECT_FROM && (
        <p className="mt-2 text-sm text-ink-muted" data-testid="building-profile-note">
          Building your profile ({history.length} of {PROJECT_FROM} sessions completed to unlock projections and practice style)
        </p>
      )}
    </figure>
  )
}
