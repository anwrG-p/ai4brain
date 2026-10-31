import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PillarRadar } from './PillarRadar'
import { pillarScores, type PillarId, type PillarScore } from './pillars'

const score = (s: number | null): PillarScore => ({ score: s, uncertainty: 10, coverage: s === null ? 0 : 1, proxies: [] })
const scores = (v: Record<PillarId, number | null>) =>
  Object.fromEntries(Object.entries(v).map(([k, s]) => [k, score(s)])) as Record<PillarId, PillarScore>

describe('PillarRadar', () => {
  it('labels every axis with the plain pillar name and a whole number, or "Not measured yet"', () => {
    const { container } = render(<PillarRadar scores={scores({ focus: 61.6, agility: 40, impulse: null, memory: 75, visual: 20 })} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.textContent).toContain('Focus &Strategy62')
    expect(svg.textContent).toContain('ImpulseControlNot measured yet')
    expect(container.querySelectorAll('circle')).toHaveLength(4) // no point for the missing pillar
    const table = screen.getByRole('table', { name: 'Your five skills, out of 100' })
    expect(within(table).getByRole('row', { name: 'Impulse Control Not measured yet' })).toBeInTheDocument()
    expect(within(table).getByRole('row', { name: 'Deep Memory 75' })).toBeInTheDocument()
  })

  it('draws no shape with fewer than three scores, and shows nothing as zero', () => {
    const { container } = render(<PillarRadar scores={pillarScores({})} />)
    expect(container.querySelectorAll('circle')).toHaveLength(0)
    expect(container.querySelector('svg')!.textContent).not.toMatch(/\d/)
  })

  it('blurred: the graphic is blurred and the table is not rendered', () => {
    const { container } = render(<PillarRadar blurred scores={scores({ focus: 1, agility: 2, impulse: 3, memory: 4, visual: 5 })} />)
    expect(container.querySelector('figure')).toHaveAttribute('data-blurred', 'true')
    expect(container.querySelector('svg')).toHaveClass('blur-md')
    expect(screen.queryByRole('table')).toBeNull()
  })
})
