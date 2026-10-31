import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../../state/useAppStore'
import { useEmilyStore } from '../../../state/useEmilyStore'
import { Mascot, type MascotState } from '../brand/Mascot'
import { Dolphin, type DolphinPose } from './Dolphin'
import { Loti, type LotiPose } from './Loti'
import { Momo, MomoFromStore, EMOTION_TO_MOOD, type MomoMood } from './Momo'

const LOTI_POSES: LotiPose[] = ['idle', 'talk', 'think', 'happy', 'wave']
const DOLPHIN_POSES: DolphinPose[] = ['swim-in', 'cheer']
const MOODS: MomoMood[] = ['calm', 'happy', 'tired', 'frustrated', 'focused']

const ANIM = '[class*="char-anim-"]'

function expectCleanSvg(container: HTMLElement) {
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('svg')).not.toBeNull()
  const html = container.innerHTML
  expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  expect(html).not.toMatch(/\brgba?\(|\bhsla?\(/i)
}

function mockReducedMotionQuery(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: matches && query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  act(() => useAppStore.getState().setReducedMotion(false))
})

describe('Loti', () => {
  it.each(LOTI_POSES)('renders the %s pose as a labelled SVG image', (pose) => {
    const { container } = render(<Loti pose={pose} size="md" />)
    expect(screen.getByRole('img', { name: /loti/i })).toBeInTheDocument()
    expectCleanSvg(container)
  })

  it('gives each pose its own label', () => {
    const labels = LOTI_POSES.map((pose) => {
      const { unmount } = render(<Loti pose={pose} />)
      const label = screen.getByRole('img').getAttribute('aria-label')
      unmount()
      return label
    })
    expect(new Set(labels).size).toBe(LOTI_POSES.length)
  })

  it('uses the title prop as its label', () => {
    render(<Loti pose="idle" title="Loti says hello" />)
    expect(screen.getByRole('img', { name: 'Loti says hello' })).toBeInTheDocument()
  })

  it('is still when idle and animates only on events', () => {
    const { container, rerender } = render(<Loti pose="idle" />)
    expect(container.querySelector(ANIM)).toBeNull()
    rerender(<Loti pose="talk" />)
    expect(container.querySelector('.char-anim-talk')).not.toBeNull()
    rerender(<Loti pose="happy" />)
    expect(container.querySelector('.char-anim-pulse')).not.toBeNull()
    rerender(<Loti pose="wave" />)
    expect(container.querySelector('.char-anim-wave')).not.toBeNull()
  })

  it.each(['sm', 'md', 'lg', 'xl'] as const)('sizes the %s figure', (size) => {
    render(<Loti pose="idle" size={size} />)
    const svg = screen.getByRole('img')
    expect(Number(svg.getAttribute('width'))).toBeGreaterThan(0)
  })
})

describe('Dolphin', () => {
  it.each(DOLPHIN_POSES)('renders the %s pose as a labelled SVG image', (pose) => {
    const { container } = render(<Dolphin pose={pose} size="lg" />)
    expect(screen.getByRole('img', { name: /dolphin/i })).toBeInTheDocument()
    expectCleanSvg(container)
  })

  it('plays one entrance or one hop', () => {
    const { container, rerender } = render(<Dolphin pose="swim-in" />)
    expect(container.querySelector('.char-anim-swim-in')).not.toBeNull()
    rerender(<Dolphin pose="cheer" />)
    expect(container.querySelector('.char-anim-hop')).not.toBeNull()
  })
})

describe('Momo', () => {
  it.each(MOODS)('renders the %s mood as a labelled SVG image', (mood) => {
    const { container } = render(<Momo mood={mood} size="sm" />)
    expect(screen.getByRole('img', { name: new RegExp(`momo.*${mood}`, 'i') })).toBeInTheDocument()
    expectCleanSvg(container)
  })

  it('paints frustrated with the amber tint, never red', () => {
    const { container } = render(<Momo mood="frustrated" />)
    const html = container.innerHTML
    expect(html).toContain('--char-amber')
    expect(html).not.toMatch(/danger|red/i)
  })

  it('maps every emotion in the store onto a mood', () => {
    expect(EMOTION_TO_MOOD).toEqual({
      calm_flow: 'calm',
      energized: 'happy',
      frustrated: 'frustrated',
      hesitant: 'focused',
      fatigued: 'tired',
    })
  })

  it('MomoFromStore follows useEmilyStore', () => {
    act(() => useEmilyStore.getState().setManualEmotion('fatigued'))
    render(<MomoFromStore size="md" />)
    expect(screen.getByRole('img', { name: /momo.*tired/i })).toBeInTheDocument()
    act(() => useEmilyStore.getState().setManualEmotion('energized'))
    expect(screen.getByRole('img', { name: /momo.*happy/i })).toBeInTheDocument()
    act(() => useEmilyStore.getState().reset())
  })
})

describe('reduced motion', () => {
  const animated = () => (
    <>
      <Loti pose="talk" />
      <Loti pose="happy" />
      <Loti pose="wave" />
      <Loti pose="think" />
      <Dolphin pose="swim-in" />
      <Dolphin pose="cheer" />
      <Momo mood="happy" />
    </>
  )

  it('animates by default', () => {
    const { container } = render(animated())
    expect(container.querySelectorAll(ANIM).length).toBeGreaterThanOrEqual(7)
  })

  it('drops every animation class under the app reduced-motion setting', () => {
    act(() => useAppStore.getState().setReducedMotion(true))
    const { container } = render(animated())
    expect(container.querySelector(ANIM)).toBeNull()
  })

  it('drops every animation class under prefers-reduced-motion', () => {
    mockReducedMotionQuery(true)
    const { container } = render(animated())
    expect(container.querySelector(ANIM)).toBeNull()
  })

  it('locks the animation classes in CSS for reduced motion and timed trials', () => {
    const css = readFileSync(path.resolve(__dirname, '../../../styles/tokens.css'), 'utf8')
    const lock = css.slice(css.indexOf('/* characters: motion lock */'))
    expect(lock).toMatch(/prefers-reduced-motion: reduce/)
    expect(lock).toMatch(/\[data-reduced-motion="true"\] \[class\*="char-anim-"\]/)
    expect(lock).toMatch(/\[data-timed-trial="true"\] \[class\*="char-anim-"\]/)
    expect(lock).toMatch(/animation: none !important/)
  })
})

describe('Mascot wrapper', () => {
  const STATES: [MascotState, RegExp][] = [
    ['idle', /loti/i],
    ['hello', /waving/i],
    ['curious', /thinking/i],
    ['thinking', /thinking/i],
    ['celebrate', /happy/i],
    ['rest', /loti/i],
    ['calm-shrug', /loti/i],
  ]

  it.each(STATES)('renders Loti for the %s state', (state, label) => {
    const { container } = render(<Mascot state={state} size="md" showSpeechBubble={false} />)
    expect(screen.getByRole('img', { name: label })).toBeInTheDocument()
    expectCleanSvg(container)
  })

  it('renders nothing visible for the hidden state', () => {
    const { container } = render(<Mascot state="hidden" />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('keeps the speech bubble API', () => {
    render(<Mascot state="thinking" message="Let me look at that." />)
    expect(screen.getByText('Let me look at that.')).toBeInTheDocument()
    expect(screen.getByText(/State: thinking/i)).toBeInTheDocument()
  })
})
