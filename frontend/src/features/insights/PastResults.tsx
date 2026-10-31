import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { HEATMAP_MIN_CELLS, exerciseWeeks, type ExerciseRow } from './dashboard'
import type { SessionRecord } from './sessionStore'

/* Past results, behind "Further explore my training" (Dashboard doc: the heatmap "goes more in
   detail into the historical test results"). Exercise x week. From 20 filled cells a heatmap in five
   steps from pale sky to deep coral (never red; heat-* in tokens.css), each cell edged in
   border-strong and printing its value in the step's own text colour (>= 4.5:1), with a numeric
   legend. One tab stop: a grid with a roving tabindex (arrows, Home, End) that starts on the latest
   week. Each cell is named for screen readers (announced once, on focus); a line under the grid
   echoes the focused cell for sighted keyboard users and is hidden from screen readers. Hovering
   only shows a tooltip. On a narrow screen the weeks scroll, starting at the latest, with a "Scroll
   for earlier weeks" hint. Fewer cells: a plain list. */

const STEPS = 5
const TICKS = [0, 20, 40, 60, 80, 100]

export const heatBin = (score: number) => Math.min(STEPS - 1, Math.max(0, Math.floor(score / (100 / STEPS))))

const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export function PastResults({ sessions }: { sessions: readonly SessionRecord[] }) {
  const { weeks, rows, cells } = exerciseWeeks(sessions)

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

  return <Heatmap weeks={weeks} rows={rows} />
}

function Heatmap({ weeks, rows }: { weeks: number[]; rows: ExerciseRow[] }) {
  // The tab stop opens where the weeks open: the latest week. Clamped on render, so a smaller
  // grid (fewer rows or weeks) still has exactly one tab stop.
  const [pos, setPos] = useState<[number, number]>([0, weeks.length - 1])
  const at: [number, number] = [Math.min(pos[0], rows.length - 1), Math.min(pos[1], weeks.length - 1)]
  const [said, setSaid] = useState('')
  const [scrolls, setScrolls] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLTableElement>(null)

  // Open on the latest week (and keep it there through a resize until the user scrolls), and say when
  // the weeks scroll.
  const userScrolled = useRef(false)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const check = () => {
      if (!userScrolled.current) el.scrollLeft = el.scrollWidth
      setScrolls(el.scrollWidth > el.clientWidth + 1)
    }
    check()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [weeks.length])

  // New data: the echo under the grid would describe an old value, so it clears. A new week moves
  // the tab stop to it (where the weeks open), unless the user is moving around in the grid.
  const sig = `${weeks.join()}|${rows.map((r) => `${r.schema}:${r.values.join()}`).join()}`
  const seen = useRef({ sig, weeks: weeks.length })
  useLayoutEffect(() => {
    const before = seen.current
    if (before.sig === sig) return
    seen.current = { sig, weeks: weeks.length }
    setSaid('')
    if (weeks.length > before.weeks && !grid.current?.contains(document.activeElement)) setPos(([r]) => [r, weeks.length - 1])
  }, [sig, weeks.length])

  const label = (r: number, c: number) => {
    const v = rows[r]!.values[c]
    return `${rows[r]!.name}, week of ${day(weeks[c]!)}: ${v === null || v === undefined ? 'no session' : Math.round(v)}`
  }
  const move = (r: number, c: number) => {
    const next: [number, number] = [Math.min(rows.length - 1, Math.max(0, r)), Math.min(weeks.length - 1, Math.max(0, c))]
    setPos(next)
    grid.current?.querySelector<HTMLElement>(`[data-cell="${next[0]}-${next[1]}"]`)?.focus()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const [r, c] = at
    const to: Record<string, [number, number]> = {
      ArrowRight: [r, c + 1],
      ArrowLeft: [r, c - 1],
      ArrowDown: [r + 1, c],
      ArrowUp: [r - 1, c],
      Home: [r, 0],
      End: [r, weeks.length - 1],
    }
    const target = to[e.key]
    if (!target) return
    e.preventDefault()
    move(...target)
  }

  return (
    <div>
      {scrolls && <p className="mb-1 text-sm text-ink-muted">← Scroll for earlier weeks</p>}
      <div ref={scroller} data-scroller onScroll={(e) => (userScrolled.current = e.currentTarget.scrollLeft + e.currentTarget.clientWidth < e.currentTarget.scrollWidth - 1)} className="overflow-x-auto">
        <table ref={grid} role="grid" aria-label="Past results by week" onKeyDown={onKeyDown} className="border-separate border-spacing-1 text-sm text-ink">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-canvas">
                <span className="sr-only">Exercise</span>
              </th>
              {weeks.map((w) => (
                <th key={w} scope="col" className="px-1 text-center font-medium whitespace-nowrap text-ink-muted">
                  {day(w)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={row.schema}>
                {/* Sticky, so a scrolled phone view still names each row. */}
                <th scope="row" className="sticky left-0 z-10 bg-canvas pr-2 text-left font-medium whitespace-nowrap">
                  {row.name}
                </th>
                {row.values.map((v, c) => {
                  const here = at[0] === r && at[1] === c
                  const common = {
                    role: 'gridcell',
                    'data-cell': `${r}-${c}`,
                    'aria-label': label(r, c),
                    tabIndex: here ? 0 : -1,
                    onFocus: () => {
                      setPos([r, c])
                      setSaid(label(r, c))
                    },
                  }
                  if (v === null) {
                    return (
                      <td key={c} {...common} className="focus-ring h-9 min-w-11 rounded-sm border border-border" />
                    )
                  }
                  return (
                    <td
                      key={c}
                      {...common}
                      data-value={Math.round(v)}
                      title={label(r, c)}
                      className={`focus-ring heat-${heatBin(v)} h-9 min-w-11 rounded-sm border border-border-strong text-center font-semibold tabular-nums`}
                    >
                      {Math.round(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p data-focus-echo aria-hidden="true" className="mt-2 min-h-6 text-sm text-ink">
        {said}
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
