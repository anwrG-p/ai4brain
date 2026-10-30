import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { CellsView, GlyphView, PolyView } from './svg'

const HEX_OR_FN = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/

test('GlyphView draws count shapes with a readable label', () => {
  render(<GlyphView glyph={{ shape: 'triangle', count: 2, color: 'blue', rotation_deg: 0 }} />)
  const svg = screen.getByLabelText('2 blue triangles')
  expect(svg.tagName).toBe('svg')
  expect(svg.querySelectorAll('polygon')).toHaveLength(2)
})

test('GlyphView uses the singular for one shape', () => {
  render(<GlyphView glyph={{ shape: 'circle', count: 1, color: 'red', rotation_deg: 0 }} />)
  expect(screen.getByLabelText('1 red circle').querySelectorAll('circle')).toHaveLength(1)
})

test.each(['red', 'green', 'blue', 'yellow'])('GlyphView paints %s with a token, not the raw name', (color) => {
  const { container } = render(<GlyphView glyph={{ shape: 'square', count: 1, color, rotation_deg: 0 }} />)
  const fill = container.querySelector('rect')!.getAttribute('fill')!
  expect(fill).toMatch(/^var\(--[a-z0-9-]+\)$/)
  expect(fill).not.toBe('var(--color-ink)')
})

const fillOf = (color: string) => {
  const { container, unmount } = render(<GlyphView glyph={{ shape: 'square', count: 1, color, rotation_deg: 0 }} />)
  const fill = container.querySelector('rect')!.getAttribute('fill')!
  unmount()
  return fill
}

test('the four glyph colour names map to pairwise distinct tokens', () => {
  const fills = ['red', 'green', 'blue', 'yellow'].map(fillOf)
  expect(new Set(fills).size).toBe(4)
})

// --color-reward is 1.55:1 on the light surface; --dim-5 clears WCAG 1.4.11's 3:1 in both themes.
test('yellow glyphs use --dim-5 for graphical contrast', () => {
  expect(fillOf('yellow')).toBe('var(--dim-5)')
})

test('GlyphView maps an unknown colour name to the ink token, keeps the name in the label, and emits no hex', () => {
  const { container } = render(
    <GlyphView glyph={{ shape: 'diamond', count: 3, color: 'chartreuse', rotation_deg: 45 }} />,
  )
  const svg = screen.getByLabelText('3 chartreuse diamonds')
  const polys = svg.querySelectorAll('polygon')
  expect(polys).toHaveLength(3)
  for (const p of polys) expect(p.getAttribute('fill')).toBe('var(--color-ink)')
  expect(container.innerHTML).not.toMatch(HEX_OR_FN)
  expect(container.innerHTML).not.toContain('chartreuse"')
})

test('PolyView draws one line per edge and one circle per node', () => {
  const poly = {
    points: [[0, 0], [1, 0], [0.5, 1]] as [number, number][],
    edges: [[0, 1], [1, 2]] as [number, number][],
  }
  const { container } = render(<PolyView poly={poly} size={100} />)
  const svg = container.querySelector('svg')!
  expect(svg.getAttribute('width')).toBe('100')
  expect(svg.querySelectorAll('line')).toHaveLength(2)
  expect(svg.querySelectorAll('circle')).toHaveLength(3)
})

test('CellsView draws one rect per cell inside a rotated, mirrored group, with token colours only', () => {
  const cells: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1]]
  const { container } = render(<CellsView cells={cells} angle_deg={90} mirrored />)
  expect(container.querySelectorAll('rect')).toHaveLength(4)
  const g = container.querySelector('g')!.getAttribute('transform')!
  expect(g).toContain('rotate(90')
  expect(g).toContain('scale(-1 1)')
  for (const r of container.querySelectorAll('rect')) {
    expect(r.getAttribute('fill')).toBe('currentColor')
    expect(r.getAttribute('stroke')).toMatch(/^var\(--color-[a-z-]+\)$/)
  }
})

test('PolyView with no points (and edges to missing points) renders without NaN', () => {
  const poly = { points: [] as [number, number][], edges: [[0, 1]] as [number, number][] }
  const { container } = render(<PolyView poly={poly} label="Test shape" />)
  const svg = screen.getByLabelText('Test shape')
  expect(svg.getAttribute('viewBox')).not.toMatch(/NaN|Infinity/)
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  expect(svg.querySelectorAll('line')).toHaveLength(0)
})
