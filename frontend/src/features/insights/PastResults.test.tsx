import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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

  it('shows a sky-to-coral heatmap with a numeric legend from 20 cells', () => {
    const { container } = render(<PastResults sessions={weeks(4)} />)
    const table = screen.getByRole('table', { name: 'Past results by week' })
    expect(within(table).getAllByRole('rowheader')).toHaveLength(5)
    const legend = screen.getByRole('list', { name: 'Score scale' })
    expect(within(legend).getAllByRole('listitem')).toHaveLength(5)
    for (const t of ['0', '20', '40', '60', '80', '100']) expect(within(legend).getByText(t)).toBeInTheDocument()
    const cells = container.querySelectorAll('td[data-value]')
    expect(cells).toHaveLength(20)
    for (const c of cells) expect(c.className).toMatch(/\bheat-[0-4]\b/)
    expect(container.innerHTML).not.toMatch(/red|danger/)
  })

  it('reads a cell\'s value on focus and on hover, and keeps it as text for screen readers', () => {
    const { container } = render(<PastResults sessions={weeks(4)} />)
    const cell = container.querySelector('td[data-value]') as HTMLElement
    expect(cell).toHaveAttribute('tabindex', '0')
    expect(cell.querySelector('.sr-only')).toHaveTextContent('20')
    fireEvent.focus(cell)
    expect(screen.getByText(/^Logic Web, week of \d+ \w+: 20$/)).toBeInTheDocument()
    const other = container.querySelectorAll('td[data-value]')[1] as HTMLElement
    fireEvent.mouseEnter(other)
    expect(screen.getByText(/^Logic Web, week of \d+ \w+: 35$/)).toBeInTheDocument()
  })

  it('bins scores into five steps', () => {
    expect([0, 19.9, 20, 59, 80, 100].map(heatBin)).toEqual([0, 0, 1, 2, 4, 4])
  })
})
