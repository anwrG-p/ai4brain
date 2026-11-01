import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PastResults, TIME_OF_DAY_MIN_SESSIONS, heatBin, partOfDay, timeOfDay } from './PastResults'
import type { TaskScores } from './pillars'
import type { SessionRecord } from './sessionStore'

const WEEK = 7 * 86_400_000
const NOW = Date.parse('2026-10-28T12:00:00') // a Wednesday
const five = (s: number): TaskScores => ({
  OSPAN: { score: s, trials: 20 },
  OTS_Planning: { score: s, trials: 5 },
  FluidMatrices: { score: s, trials: 10 },
  UFOV_SOA: { score: s, trials: 10 },
  MST_LDI: { score: s, trials: 30 },
})
const weeks = (n: number): SessionRecord[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, at: new Date(NOW - (n - 1 - i) * WEEK).toISOString(), inputs: five(20 + i * 15) }))

describe('PastResults', () => {
  it('lists results per exercise when there are fewer than 20 cells, with no heatmap', () => {
    render(<PastResults sessions={weeks(2)} />)
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText(/^0$/)).toBeNull() // no legend
    const list = screen.getByRole('list', { name: 'Past results' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(within(list).getByText('Memory Gauntlet').closest('li')).toHaveTextContent('Memory Gauntlet20, 35')
  })

  it('shows a sky-to-coral heatmap with a numeric legend and the value printed in every cell, from 20 cells', () => {
    const { container } = render(<PastResults sessions={weeks(4)} />)
    const grid = screen.getByRole('grid', { name: 'Past results by week' })
    expect(within(grid).getAllByRole('rowheader')).toHaveLength(5)
    const legend = screen.getByRole('list', { name: 'Score scale' })
    expect(within(legend).getAllByRole('listitem')).toHaveLength(5)
    for (const t of ['0', '20', '40', '60', '80', '100']) expect(within(legend).getByText(t)).toBeInTheDocument()
    const cells = container.querySelectorAll('td[data-value]')
    expect(cells).toHaveLength(20)
    for (const c of cells) {
      expect(c.className).toMatch(/\bheat-[0-4]\b/)
      // Printed on screen (the step's own text colour keeps it >= 4.5:1), not screen-reader only.
      expect(c.textContent).toBe(c.getAttribute('data-value'))
      expect(c.querySelector('.sr-only')).toBeNull()
    }
    expect(container.innerHTML).not.toMatch(/red|danger/)
  })

  // Review fix: one tab stop for the whole grid (roving tabindex), arrows move between cells. The
  // tab stop starts on the latest week, where the weeks open (ticket 10).
  it('is one tab stop, starting at the latest week: arrow keys, Home and End move a roving tabindex', () => {
    const { container } = render(<PastResults sessions={weeks(4)} />)
    const cells = () => [...container.querySelectorAll<HTMLElement>('[role="gridcell"]')]
    expect(cells().filter((c) => c.tabIndex === 0)).toEqual([cells()[3]])
    act(() => cells()[3]!.focus())
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(cells()[2])
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cells()[6]) // 4 weeks a row: row 2, week 3
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(cells()[7])
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(document.activeElement).toBe(cells()[4])
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' }) // stays on the first row
    expect(document.activeElement).toBe(cells()[0])
    expect(cells().filter((c) => c.tabIndex === 0)).toEqual([cells()[0]])
  })

  it('keeps one tab stop when the data shrinks under it', () => {
    const { container, rerender } = render(<PastResults sessions={weeks(5)} />)
    const cells = () => [...container.querySelectorAll<HTMLElement>('[role="gridcell"]')]
    act(() => cells()[4]!.focus())
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' }) // the last row
    const fourExercises = weeks(5).map((s) => {
      const { MST_LDI: _drop, ...rest } = s.inputs as TaskScores
      return { ...s, inputs: rest }
    })
    rerender(<PastResults sessions={fourExercises} />)
    expect(cells()).toHaveLength(20)
    expect(cells().filter((c) => c.tabIndex === 0)).toEqual([cells()[19]])
  })

  // A new week moves the tab stop to it, unless the user is in the grid; the echo never goes stale.
  describe('when a new week arrives', () => {
    const plusWeek = () => [...weeks(4), { id: 'new', at: new Date(NOW + WEEK).toISOString(), inputs: five(90) }]

    it('moves the tab stop to the latest week when focus is outside the grid', () => {
      const { container, rerender } = render(<PastResults sessions={weeks(4)} />)
      const cells = () => [...container.querySelectorAll<HTMLElement>('[role="gridcell"]')]
      act(() => cells()[3]!.focus())
      fireEvent.keyDown(document.activeElement!, { key: 'Home' }) // the stop is now week 1
      act(() => (document.activeElement as HTMLElement).blur())
      rerender(<PastResults sessions={plusWeek()} />)
      expect(cells().filter((c) => c.tabIndex === 0)).toEqual([cells()[4]]) // 5 weeks: row 1, week 5
      expect(container.querySelector('[data-focus-echo]')!.textContent).toBe('')
    })

    it('keeps the tab stop under a user who is in the grid, and clears the stale echo', () => {
      const { container, rerender } = render(<PastResults sessions={weeks(4)} />)
      const cells = () => [...container.querySelectorAll<HTMLElement>('[role="gridcell"]')]
      act(() => cells()[3]!.focus())
      fireEvent.keyDown(document.activeElement!, { key: 'Home' })
      expect(container.querySelector('[data-focus-echo]')!.textContent).not.toBe('')
      rerender(<PastResults sessions={plusWeek()} />)
      expect(cells().filter((c) => c.tabIndex === 0)).toEqual([cells()[0]])
      expect(container.querySelector('[data-focus-echo]')!.textContent).toBe('')
    })
  })

  // A focused cell is announced once: by its own name. The line under the grid shows it for sighted
  // keyboard users and is hidden from screen readers (no second, live announcement).
  it('names each cell for screen readers and echoes the focused one visually; hovering shows a tooltip', () => {
    const { container } = render(<PastResults sessions={weeks(4)} />)
    expect(container.querySelector('[aria-live]')).toBeNull()
    const echo = container.querySelector('[data-focus-echo]')!
    expect(echo).toHaveAttribute('aria-hidden', 'true')
    const [first, second] = container.querySelectorAll<HTMLElement>('td[data-value]')
    expect(first).toHaveAccessibleName(expect.stringMatching(/^Logic Web, week of \d+ \w+: 20$/))
    fireEvent.mouseEnter(second!)
    expect(echo.textContent).toBe('')
    expect(second).toHaveAttribute('title', expect.stringMatching(/^Logic Web, week of \d+ \w+: 35$/))
    fireEvent.focus(first!)
    expect(echo.textContent).toMatch(/^Logic Web, week of \d+ \w+: 20$/)
  })

  it('bins scores into five steps', () => {
    expect([0, 19.9, 20, 59, 80, 100].map(heatBin)).toEqual([0, 0, 1, 2, 4, 4])
  })

  // Review fix: on a phone the weeks scroll; say so, and open on the latest week.
  describe('when the weeks are wider than the box', () => {
    afterEach(() => vi.restoreAllMocks())

    it('shows "Scroll for earlier weeks" and starts at the latest week', () => {
      vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(500)
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300)
      const { container } = render(<PastResults sessions={weeks(4)} />)
      expect(screen.getByText('← Scroll for earlier weeks')).toBeInTheDocument()
      expect((container.querySelector('[data-scroller]') as HTMLElement).scrollLeft).toBe(500)
    })

    it('shows no hint when everything fits', () => {
      render(<PastResults sessions={weeks(4)} />)
      expect(screen.queryByText(/Scroll for earlier weeks/)).toBeNull()
    })
  })
})

describe('When you train (time of day, FE-14)', () => {
  // Local times, so the weekday and part of the day do not depend on the test machine's zone.
  const one = (local: string, s: number, id = local): SessionRecord => ({ id, at: new Date(local).toISOString(), inputs: five(s) })
  // Mon 26 Oct morning x2 (60, 80), Mon evening (40), Tue afternoon (50), Wed 00:30 (night: evening), Sat morning (90).
  const six = [
    one('2026-10-26T08:00:00', 60),
    one('2026-10-26T11:59:00', 80),
    one('2026-10-26T19:00:00', 40),
    one('2026-10-27T13:00:00', 50),
    one('2026-10-28T00:30:00', 30),
    one('2026-10-31T09:00:00', 90),
  ]

  it('parts of the day: morning 05-12, afternoon 12-17, evening the rest', () => {
    expect([4, 5, 11, 12, 16, 17, 23, 0].map(partOfDay)).toEqual([2, 0, 0, 1, 1, 2, 2, 2])
  })

  it('stays hidden below 6 sessions', () => {
    expect(timeOfDay(six.slice(0, 5))).toBeNull()
    render(<PastResults sessions={six.slice(0, 5)} />)
    expect(screen.queryByRole('grid', { name: 'When you train' })).toBeNull()
    expect(TIME_OF_DAY_MIN_SESSIONS).toBe(6)
  })

  it('from 6 sessions: weekday rows x morning/afternoon/evening, each cell printing the average score', () => {
    const slots = timeOfDay(six)!
    expect(slots).toHaveLength(7)
    expect(slots[0]).toEqual([{ sessions: 2, score: 70 }, { sessions: 0, score: null }, { sessions: 1, score: 40 }])
    expect(slots[1]![1]).toEqual({ sessions: 1, score: 50 })
    expect(slots[2]![2]).toEqual({ sessions: 1, score: 30 })
    expect(slots[5]![0]).toEqual({ sessions: 1, score: 90 })

    const { container } = render(<PastResults sessions={six} />)
    const grid = screen.getByRole('grid', { name: 'When you train' })
    expect(within(grid).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(within(grid).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Day', 'Morning', 'Afternoon', 'Evening'])
    const filled = grid.querySelectorAll('td[data-value]')
    expect([...filled].map((c) => c.textContent)).toEqual(['70', '40', '50', '30', '90'])
    for (const c of filled) expect(c.className).toMatch(/\bheat-[0-4]\b/)
    expect(within(grid).getByRole('gridcell', { name: 'Monday morning: 2 sessions, average 70' })).toBeInTheDocument()
    expect(within(grid).getByRole('gridcell', { name: 'Thursday evening: no session' })).toBeInTheDocument()
    expect(container.innerHTML).not.toMatch(/red|danger/)
  })

  it('is one tab stop with a roving tabindex; focus is announced once and echoed for sighted users', () => {
    render(<PastResults sessions={six} />)
    const grid = screen.getByRole('grid', { name: 'When you train' })
    const cells = () => [...grid.querySelectorAll<HTMLElement>('[role="gridcell"]')]
    expect(cells()).toHaveLength(21)
    expect(cells().filter((c) => c.tabIndex === 0)).toEqual([cells()[0]])
    act(() => cells()[0]!.focus())
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cells()[3])
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(cells()[5])
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' }) // stops at the edge
    expect(document.activeElement).toBe(cells()[5])
    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    expect(document.activeElement).toBe(cells()[3])
    expect(cells().filter((c) => c.tabIndex === 0)).toEqual([cells()[3]])
    const echo = grid.parentElement!.querySelector('[data-focus-echo]')!
    expect(echo).toHaveAttribute('aria-hidden', 'true')
    expect(echo).toHaveTextContent('Tuesday morning: no session')
    // Named once: the cell's own label, with no live region repeating it.
    expect(grid.parentElement!.querySelector('[aria-live]')).toBeNull()
  })
})
