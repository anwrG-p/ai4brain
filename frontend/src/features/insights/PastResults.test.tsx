import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PastResults, heatBin } from './PastResults'
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
