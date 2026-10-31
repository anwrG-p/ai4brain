import { useState } from 'react'
import { HEATMAP_MIN_CELLS, exerciseWeeks } from './dashboard'
import type { SessionRecord } from './sessionStore'

/* Past results, behind "Further explore my training" (Dashboard doc: the heatmap "goes more in
   detail into the historical test results"). Exercise x week. From 20 filled cells a heatmap in five
   steps from pale sky to deep coral (never red; heat-* in tokens.css), each cell edged in
   border-strong, with a numeric legend, the value on hover and on focus, and the number as text in
   every cell for screen readers. Fewer cells: a plain list. */

const STEPS = 5
const TICKS = [0, 20, 40, 60, 80, 100]

export const heatBin = (score: number) => Math.min(STEPS - 1, Math.max(0, Math.floor(score / (100 / STEPS))))

const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export function PastResults({ sessions }: { sessions: readonly SessionRecord[] }) {
  const { weeks, rows, cells } = exerciseWeeks(sessions)
  const [active, setActive] = useState<string | null>(null)

  if (!rows.length) return <p className="text-base text-ink-muted">Your results will show here after a session.</p>

  if (cells < HEATMAP_MIN_CELLS) {
    return (
      <ul aria-label="Past results" className="m-0 list-none space-y-1 p-0 text-base text-ink">
        {rows.map((r) => (
          <li key={r.schema} className="flex justify-between gap-4">
            <span>{r.name}</span>
            <span className="tabular-nums text-ink-muted">
              {r.values
                .filter((v): v is number => v !== null)
                .map((v) => Math.round(v))
                .join(', ')}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table aria-label="Past results by week" className="border-separate border-spacing-1 text-sm text-ink">
          <thead>
            <tr>
              <td />
              {weeks.map((w) => (
                <th key={w} scope="col" className="px-1 text-center font-medium whitespace-nowrap text-ink-muted">
                  {day(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.schema}>
                <th scope="row" className="pr-2 text-left font-medium whitespace-nowrap">
                  {r.name}
                </th>
                {r.values.map((v, i) => {
                  if (v === null) return <td key={i} className="h-8 min-w-11 rounded-sm border border-border" />
                  const label = `${r.name}, week of ${day(weeks[i]!)}: ${Math.round(v)}`
                  return (
                    <td
                      key={i}
                      data-value={Math.round(v)}
                      tabIndex={0}
                      title={label}
                      onFocus={() => setActive(label)}
                      onMouseEnter={() => setActive(label)}
                      className={`focus-ring heat-${heatBin(v)} h-8 min-w-11 rounded-sm border border-border-strong`}
                    >
                      <span className="sr-only">{Math.round(v)}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p aria-live="polite" className="mt-2 min-h-6 text-sm text-ink">
        {active}
      </p>
      <ul aria-label="Score scale" className="relative m-0 mt-2 flex w-60 list-none p-0 pb-6 text-sm text-ink-muted">
        {Array.from({ length: STEPS }, (_, k) => (
          <li key={k} className="flex-1">
            <span aria-hidden="true" className={`heat-${k} block h-3 border border-border-strong ${k ? 'border-l-0' : 'rounded-l-sm'} ${k === STEPS - 1 ? 'rounded-r-sm' : ''}`} />
            <span className="absolute top-4 -translate-x-1/2 tabular-nums" style={{ left: `${k * 20}%` }}>
              {TICKS[k]}
            </span>
            {k === STEPS - 1 && <span className="absolute top-4 right-0 translate-x-1/2 tabular-nums">{TICKS[STEPS]}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
