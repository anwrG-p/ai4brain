import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CURVE_EMPTY, DASHED, ProgressCurve, PROJECT_FROM } from './ProgressCurve'

const DAY = 86_400_000
const NOW = new Date('2026-10-31T12:00:00')
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY).toISOString()
const hist = (...scores: number[]) => scores.map((score, i) => ({ at: at(2 * (scores.length - i)), score }))
const legendItems = () => within(screen.getByRole('list', { name: 'Line styles' })).getAllByRole('listitem')

/* User decision (2026-10-31): the real curve plus one dashed "If you keep training" line, shown from
   the 3rd session; no "If you pause" line and no idle decay. */
describe('ProgressCurve', () => {
  it('shows Loti\'s empty-state line, and no chart, before the first session', () => {
    const { container } = render(<ProgressCurve history={[]} now={NOW} />)
    expect(screen.getByText(CURVE_EMPTY)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Loti/ })).toBeInTheDocument()
    expect(container.querySelector('[data-line]')).toBeNull()
  })

  it('before the 3rd session: the real points only, no projection, a one-item legend', () => {
    expect(PROJECT_FROM).toBe(3)
    for (const h of [hist(40), hist(40, 44)]) {
      const { container, unmount } = render(<ProgressCurve history={h} now={NOW} />)
      expect(container.querySelector('[data-line="actual"]')).not.toBeNull()
      expect(container.querySelectorAll('[data-session]')).toHaveLength(h.length)
      expect(container.querySelector('[data-line="keep"]')).toBeNull()
      expect(container.querySelector('[stroke-dasharray]')).toBeNull()
      expect(legendItems().map((li) => li.textContent)).toEqual(['Your score'])
      unmount()
    }
  })

  it('from the 3rd session: the solid real line and one dashed "If you keep training" line; no dotted line', () => {
    const { container } = render(<ProgressCurve history={hist(40, 44, 47)} now={NOW} />)
    const actual = container.querySelector('[data-line="actual"]')!
    expect(actual).not.toHaveAttribute('stroke-dasharray')
    expect(actual.getAttribute('d')).toMatch(/C/) // monotone: a smooth cubic, not straight segments
    expect(container.querySelector('[data-line="keep"]')).toHaveAttribute('stroke-dasharray', DASHED)
    expect(container.querySelector('[data-line="pause"]')).toBeNull()
    // The only dashed thing in the chart is the projection.
    expect(container.querySelectorAll('figure > div [stroke-dasharray]')).toHaveLength(1)
    expect(legendItems().map((li) => li.textContent)).toEqual(['Your score', 'If you keep training'])
    expect(legendItems()[1]!.querySelector('line')).toHaveAttribute('stroke-dasharray', DASHED)
    expect(legendItems()[0]!.querySelector('line')).not.toHaveAttribute('stroke-dasharray')
    expect(container.textContent).not.toMatch(/pause/i)
  })

  it('has no confidence band and no toggle', () => {
    const { container } = render(<ProgressCurve history={hist(40, 44, 47)} now={NOW} />)
    expect(container.querySelector('[data-uncertainty-band]')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  // Review fix: a per-pillar goal on the overall curve could look met on the day it is set, or be met
  // by another skill. Goals show against their own pillar instead (Home, "Further explore" and the table).
  it('has no goal marker', () => {
    const { container } = render(<ProgressCurve history={hist(40, 44, 47)} now={NOW} />)
    expect(container.querySelector('[data-goal]')).toBeNull()
    expect(container.textContent).not.toMatch(/goal/i)
  })

  // Review fix: the coral milestone applied pillar-level RCI settings to the overall score; removed.
  it('has no coral mark: every session dot is sky', () => {
    const { container } = render(<ProgressCurve history={hist(40, 45, 55, 60)} now={NOW} />)
    expect(container.querySelectorAll('[class*="accent"]')).toHaveLength(0)
    expect(container.querySelector('[data-milestone]')).toBeNull()
    const dots = container.querySelectorAll('[data-session]')
    expect(dots).toHaveLength(4)
    for (const d of dots) expect(d).toHaveClass('fill-brand-vivid')
  })

  it('summarises the chart for screen readers', () => {
    const { rerender } = render(<ProgressCurve history={hist(41, 50, 55)} now={NOW} />)
    const summary = screen.getByText(/Your score went from 41 to 55 over 3 sessions\./)
    expect(summary).toHaveClass('sr-only')
    expect(summary.textContent).toMatch(/If you keep training, about \d+ by \d+ \w+\.$/)
    rerender(<ProgressCurve history={hist(41)} now={NOW} />)
    expect(screen.getByText('Your score: 41 after 1 session.')).toHaveClass('sr-only')
  })
  it('displays "Building your profile" note before 3 sessions', () => {
    const { rerender } = render(<ProgressCurve history={hist(40)} now={NOW} />)
    expect(screen.getByTestId('building-profile-note')).toHaveTextContent('Building your profile (1 of 3 sessions completed to unlock projections and practice style)')
    rerender(<ProgressCurve history={hist(40, 44)} now={NOW} />)
    expect(screen.getByTestId('building-profile-note')).toHaveTextContent('Building your profile (2 of 3 sessions completed to unlock projections and practice style)')
    rerender(<ProgressCurve history={hist(40, 44, 48)} now={NOW} />)
    expect(screen.queryByTestId('building-profile-note')).toBeNull()
  })
})
