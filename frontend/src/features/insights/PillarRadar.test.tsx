import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NOT_MEASURED, PillarRadar } from './PillarRadar'
import { pillarScores, type PillarId, type PillarScore } from './pillars'

const score = (s: number | null): PillarScore => ({ score: s, uncertainty: 10, coverage: s === null ? 0 : 1, proxies: [] })
const scores = (v: Record<PillarId, number | null>) =>
  Object.fromEntries(Object.entries(v).map(([k, s]) => [k, score(s)])) as Record<PillarId, PillarScore>
const SOME = scores({ focus: 61.6, agility: 40, impulse: null, memory: 75, visual: 20 })

describe('PillarRadar', () => {
  it('labels every axis with the plain pillar name and a whole number, or "—" when not measured', () => {
    const { container } = render(<PillarRadar scores={SOME} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.textContent).toContain('Focus &Strategy62')
    expect(svg.textContent).toContain('ImpulseControl—')
    expect(svg.textContent).not.toContain(NOT_MEASURED)
    expect(container.querySelectorAll('circle')).toHaveLength(4) // no point for the missing pillar
    const table = screen.getByRole('table', { name: 'Your five skills, out of 100' })
    expect(within(table).getByRole('row', { name: `Impulse Control ${NOT_MEASURED}` })).toBeInTheDocument()
    // The table carries the range (user decision, 2026-10-31); the radar keeps one number per pillar.
    expect(within(table).getByRole('row', { name: 'Deep Memory 75 · likely 65–85' })).toBeInTheDocument()
    expect(svg.textContent).not.toContain('likely')
  })

  it('clamps the table range to 0–100', () => {
    render(<PillarRadar scores={{ ...SOME, visual: { score: 4, uncertainty: 12, coverage: 1, proxies: [] } }} />)
    expect(screen.getByRole('row', { name: 'Visual Radar 4 · likely 0–16' })).toBeInTheDocument()
  })

  it('draws every label at 14 px or more (phones included)', () => {
    const { container } = render(<PillarRadar scores={SOME} improved={['memory', 'agility']} />)
    const sized = container.querySelectorAll('svg [font-size]')
    expect(sized.length).toBeGreaterThan(10)
    for (const el of sized) expect(Number(el.getAttribute('font-size'))).toBeGreaterThanOrEqual(14)
  })

  it('draws no shape with fewer than three scores, and shows nothing as zero', () => {
    const { container } = render(<PillarRadar scores={pillarScores({})} />)
    expect(container.querySelectorAll('circle')).toHaveLength(0)
    expect(container.querySelector('svg')!.textContent).not.toMatch(/\d/)
  })

  it('tags "Real improvement" in coral only on the pillars given, and says it in the table', () => {
    const { container } = render(<PillarRadar scores={SOME} improved={['memory']} />)
    const tags = [...container.querySelectorAll('svg [data-real-improvement]')]
    expect(tags).toHaveLength(1)
    expect(tags[0]!.getAttribute('data-real-improvement')).toBe('memory')
    expect(tags[0]!.textContent?.replace(/\s+/g, ' ')).toBe('Real improvement')
    expect(tags[0]).toHaveClass('fill-accent-strong')
    expect(screen.getByRole('row', { name: 'Deep Memory 75 · likely 65–85, real improvement' })).toBeInTheDocument()
  })

  it('"View as table" shows the 5-row table (and hides it again); without the prop the table stays screen-reader only', () => {
    const { unmount } = render(<PillarRadar scores={SOME} />)
    expect(screen.queryByRole('button', { name: 'View as table' })).toBeNull()
    expect(screen.getByRole('table')).toHaveClass('sr-only')
    unmount()

    render(<PillarRadar scores={SOME} tableToggle />)
    const link = screen.getByRole('button', { name: 'View as table' })
    expect(link).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('table')).toHaveClass('sr-only')
    fireEvent.click(link)
    const table = screen.getByRole('table')
    expect(table).not.toHaveClass('sr-only')
    expect(within(table).getAllByRole('row')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Hide table' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('grows the shape from the centre only when asked', () => {
    const { container, rerender } = render(<PillarRadar scores={SOME} />)
    expect(container.querySelector('.anim-radar-grow')).toBeNull()
    rerender(<PillarRadar scores={SOME} grow />)
    expect(container.querySelector('.anim-radar-grow polygon')).not.toBeNull()
  })

  it('blurred: the graphic is blurred, there is no toggle and the table is not rendered', () => {
    const { container } = render(<PillarRadar blurred tableToggle scores={scores({ focus: 1, agility: 2, impulse: 3, memory: 4, visual: 5 })} />)
    expect(container.querySelector('figure')).toHaveAttribute('data-blurred', 'true')
    expect(container.querySelector('svg')).toHaveClass('blur-md')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
