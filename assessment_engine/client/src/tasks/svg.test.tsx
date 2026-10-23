import { render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { cleanup } from '@testing-library/react'
import { CellsView, GlyphView, PolyView } from './svg'

afterEach(cleanup)

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

test('PolyView draws one line per edge and one circle per node', () => {
  const poly = { points: [[0, 0], [1, 0], [0.5, 1]] as [number, number][], edges: [[0, 1], [1, 2]] as [number, number][] }
  const { container } = render(<PolyView poly={poly} size={100} />)
  const svg = container.querySelector('svg')!
  expect(svg.getAttribute('width')).toBe('100')
  expect(svg.querySelectorAll('line')).toHaveLength(2)
  expect(svg.querySelectorAll('circle')).toHaveLength(3)
})

test('CellsView draws one rect per cell inside a rotated, mirrored group', () => {
  const cells: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1]]
  const { container } = render(<CellsView cells={cells} angle_deg={90} mirrored />)
  expect(container.querySelectorAll('rect')).toHaveLength(4)
  const g = container.querySelector('g')!.getAttribute('transform')!
  expect(g).toContain('rotate(90')
  expect(g).toContain('scale(-1 1)')
})
