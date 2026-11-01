import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WaveformVisualizer } from './WaveformVisualizer'

describe('WaveformVisualizer', () => {
  it('renders aria-hidden audio visualizer with correct bar count', () => {
    const { container } = render(<WaveformVisualizer active={false} barCount={12} />)
    const el = container.firstElementChild as HTMLElement
    expect(el).toHaveAttribute('aria-hidden', 'true')
    const bars = el.querySelectorAll('span')
    expect(bars.length).toBe(12)
  })

  it('renders active bars when active is true', () => {
    const { container } = render(<WaveformVisualizer active={true} mode="speaking" barCount={10} />)
    const el = container.firstElementChild as HTMLElement
    const bars = el.querySelectorAll('span')
    expect(bars.length).toBe(10)
    // Check that some bars have height style
    const hasStyles = Array.from(bars).some((b) => b.getAttribute('style')?.includes('height'))
    expect(hasStyles).toBe(true)
  })
})
