import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
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
  return (
    <>
      <ByWeek sessions={sessions} />
      <TimeOfDay sessions={sessions} />
    </>
  )
}

function ByWeek({ sessions }: { sessions: readonly SessionRecord[] }) {
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

/* When you train (FE-14): weekday x morning / afternoon / evening, local time. Each cell prints the
   average score of the sessions finished then (the mean of each session's exercise scores, 0-100),
   in the same five heat steps as the weekly heatmap; empty slots stay blank. Shown only from
   TIME_OF_DAY_MIN_SESSIONS sessions: fewer would read as a pattern that isn't there. The same
   accessibility as the weekly heatmap: one tab stop with a roving tabindex (arrows, Home, End), each
   cell named once on focus, and an aria-hidden echo line for sighted keyboard users. Seven rows of
   three columns fit a phone without scrolling. */

export const TIME_OF_DAY_MIN_SESSIONS = 6
export const PARTS = ['Morning', 'Afternoon', 'Evening'] as const
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

/** 05:00-11:59 morning, 12:00-16:59 afternoon, the rest (night too) evening. */
export const partOfDay = (hour: number): 0 | 1 | 2 => (hour >= 5 && hour < 12 ? 0 : hour >= 12 && hour < 17 ? 1 : 2)

export type TimeSlot = { sessions: number; score: number | null }

/** 7 weekdays (Monday first) x 3 parts of the day; null below the session minimum. A session with no
    scored input counts as a session but adds no score. */
export function timeOfDay(sessions: readonly SessionRecord[]): TimeSlot[][] | null {
  if (sessions.length < TIME_OF_DAY_MIN_SESSIONS) return null
  const acc = WEEKDAYS.map(() => PARTS.map(() => ({ sessions: 0, sum: 0, scored: 0 })))
  for (const s of sessions) {
    const at = new Date(s.at)
    const cell = acc[(at.getDay() + 6) % 7]![partOfDay(at.getHours())]!
    cell.sessions += 1
    const scores = Object.values(s.inputs).map((i) => i.score)
    if (scores.length) {
      cell.sum += scores.reduce((a, b) => a + b, 0) / scores.length
      cell.scored += 1
    }
  }
  return acc.map((row) => row.map((c) => ({ sessions: c.sessions, score: c.scored ? c.sum / c.scored : null })))
}

function TimeOfDay({ sessions }: { sessions: readonly SessionRecord[] }) {
  const slots = timeOfDay(sessions)
  const [pos, setPos] = useState<[number, number]>([0, 0])
  const [said, setSaid] = useState('')
  const grid = useRef<HTMLTableElement>(null)
  const headId = useId()
  if (!slots) return null

  const label = (r: number, c: number) => {
    const { sessions: n, score } = slots[r]![c]!
    const when = `${WEEKDAYS[r]} ${PARTS[c]!.toLowerCase()}`
    if (!n) return `${when}: no session`
    return `${when}: ${n} ${n === 1 ? 'session' : 'sessions'}${score === null ? '' : `, average ${Math.round(score)}`}`
  }
  const move = (r: number, c: number) => {
    const next: [number, number] = [Math.min(WEEKDAYS.length - 1, Math.max(0, r)), Math.min(PARTS.length - 1, Math.max(0, c))]
    setPos(next)
    grid.current?.querySelector<HTMLElement>(`[data-cell="${next[0]}-${next[1]}"]`)?.focus()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const [r, c] = pos
    const to: Record<string, [number, number]> = {
      ArrowRight: [r, c + 1],
      ArrowLeft: [r, c - 1],
      ArrowDown: [r + 1, c],
      ArrowUp: [r - 1, c],
      Home: [r, 0],
      End: [r, PARTS.length - 1],
    }
    const target = to[e.key]
    if (!target) return
    e.preventDefault()
    move(...target)
  }

  return (
    <section aria-labelledby={headId} className="mt-6">
      <h4 id={headId} className="mb-2 text-base font-semibold text-ink">
        When you train
      </h4>
      <table ref={grid} role="grid" aria-labelledby={headId} onKeyDown={onKeyDown} className="border-separate border-spacing-1 text-sm text-ink">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Day</span>
            </th>
            {PARTS.map((p) => (
              <th key={p} scope="col" className="px-1 text-center font-medium text-ink-muted">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((row, r) => (
            <tr key={WEEKDAYS[r]}>
              <th scope="row" className="pr-2 text-left font-medium whitespace-nowrap">
                {WEEKDAYS[r]!.slice(0, 3)}
              </th>
              {row.map((slot, c) => {
                const common = {
                  role: 'gridcell',
                  'data-cell': `${r}-${c}`,
                  'aria-label': label(r, c),
                  tabIndex: pos[0] === r && pos[1] === c ? 0 : -1,
                  onFocus: () => {
                    setPos([r, c])
                    setSaid(label(r, c))
                  },
                }
                if (slot.score === null) {
                  return <td key={c} {...common} className="focus-ring h-9 min-w-16 rounded-sm border border-border" />
                }
                return (
                  <td
                    key={c}
                    {...common}
                    data-value={Math.round(slot.score)}
                    title={label(r, c)}
                    className={`focus-ring heat-${heatBin(slot.score)} h-9 min-w-16 rounded-sm border border-border-strong text-center font-semibold tabular-nums`}
                  >
                    {Math.round(slot.score)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p data-focus-echo aria-hidden="true" className="mt-2 min-h-6 text-sm text-ink">
        {said}
      </p>
    </section>
  )
}
