import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFS, useDevicePrefs } from '../../../state/devicePrefs'
import { useAppStore } from '../../../state/useAppStore'
import { useEmilyStore } from '../../../state/useEmilyStore'
import { Loti, type LotiPose } from './Loti'
import { Momo, MomoFromStore, EMOTION_TO_MOOD, type MomoMood } from './Momo'
import { CHARACTER_PX } from './shared'

const LOTI_POSES: LotiPose[] = ['idle', 'talk', 'think', 'happy', 'wave', 'low']
const MOODS: MomoMood[] = ['calm', 'happy', 'tired', 'frustrated', 'focused']

const ANIM = '[class*="char-anim-"]'

function expectCleanSvg(container: HTMLElement) {
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('svg')).not.toBeNull()
  const html = container.innerHTML
  expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  expect(html).not.toMatch(/\brgba?\(|\bhsla?\(/i)
  // Flat line art: no clay gradients, sheen, filters or contact shadows.
  expect(container.querySelector('radialGradient, linearGradient, filter')).toBeNull()
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
    expect(container.innerHTML).toContain('stroke="var(--char-line)"')
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

  it('is still when idle or low and animates only on events', () => {
    const { container, rerender } = render(<Loti pose="idle" />)
    expect(container.querySelector(ANIM)).toBeNull()
    rerender(<Loti pose="low" />)
    expect(container.querySelector(ANIM)).toBeNull()
    rerender(<Loti pose="talk" />)
    expect(container.querySelector('.char-anim-talk')).not.toBeNull()
    rerender(<Loti pose="happy" />)
    expect(container.querySelector('.char-anim-pulse')).not.toBeNull()
    rerender(<Loti pose="wave" />)
    expect(container.querySelector('.char-anim-wave')).not.toBeNull()
  })

  it.each(['sm', 'md', 'lg', 'xl'] as const)('renders the %s figure at its exact pixel width', (size) => {
    expect(CHARACTER_PX).toEqual({ sm: 48, md: 96, lg: 144, xl: 192 })
    const { unmount } = render(<Loti pose="idle" size={size} />)
    expect(screen.getByRole('img').getAttribute('width')).toBe(String(CHARACTER_PX[size]))
    unmount()
    render(
      <>
        <Momo celebrate size={size} />
        <Momo mood="calm" size={size} />
      </>,
    )
    for (const svg of screen.getAllByRole('img')) {
      expect(svg.getAttribute('width')).toBe(String(CHARACTER_PX[size]))
    }
  })

  it('has no <title>, so no native hover tooltip', () => {
    const { container } = render(<Loti pose="wave" />)
    expect(container.querySelector('title')).toBeNull()
  })

  it('happy and wave have the thriving look (blush); low has closed eyes', () => {
    const blush = (pose: LotiPose) => {
      const { container, unmount } = render(<Loti pose={pose} />)
      const n = container.querySelectorAll('ellipse[fill="var(--char-blush)"][rx="5.5"]').length
      unmount()
      return n
    }
    expect(blush('happy')).toBe(2)
    expect(blush('wave')).toBe(2)
    expect(blush('idle')).toBe(0)
    expect(blush('low')).toBe(0)
    const { container } = render(<Loti pose="low" />)
    expect(container.querySelector('ellipse[fill="var(--char-face)"]')).toBeNull()
  })
})

describe('Momo, the dolphin', () => {
  it.each(MOODS)('renders the %s mood as a labelled SVG image', (mood) => {
    const { container } = render(<Momo mood={mood} size="sm" />)
    expect(screen.getByRole('img', { name: new RegExp(`momo.*${mood}`, 'i') })).toBeInTheDocument()
    expectCleanSvg(container)
  })

  it('celebrates with one leap and splash marks', () => {
    const { container } = render(<Momo celebrate size="md" />)
    expect(screen.getByRole('img', { name: /momo.*good job/i })).toBeInTheDocument()
    expect(container.querySelector('.char-anim-leap')).not.toBeNull()
    expect(container.querySelector('.char-anim-splash')).not.toBeNull()
    expectCleanSvg(container)
  })

  it('shows each mood by face, fin and posture, not by colour alone', () => {
    const shape = (mood: MomoMood) => {
      const { container, unmount } = render(<Momo mood={mood} />)
      const posture = container.querySelector('[transform^="translate"]')!
      const drawing = posture.outerHTML.replace(/var\(--char-[a-z-]+\)/g, '')
      unmount()
      return drawing
    }
    expect(new Set(MOODS.map(shape)).size).toBe(MOODS.length)
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

  it('MomoFromStore follows useEmilyStore once the mood guess is active (opted in, notice seen)', () => {
    useDevicePrefs.setState({ moodGuess: true, moodNoticeSeen: true })
    act(() => useEmilyStore.getState().setManualEmotion('fatigued'))
    render(<MomoFromStore size="md" />)
    expect(screen.getByRole('img', { name: /momo.*tired/i })).toBeInTheDocument()
    act(() => useEmilyStore.getState().setManualEmotion('energized'))
    expect(screen.getByRole('img', { name: /momo.*happy/i })).toBeInTheDocument()
    // Switched off: a still, neutral picture that reads nothing from the store.
    act(() => useDevicePrefs.setState({ moodGuess: false }))
    expect(screen.getByRole('img', { name: 'Momo' })).toBeInTheDocument()
    act(() => useEmilyStore.getState().reset())
    useDevicePrefs.setState(DEFAULT_PREFS)
  })

  it('MomoFromStore with default prefs (opt-in, off) is neutral whatever the store holds', () => {
    useDevicePrefs.setState(DEFAULT_PREFS)
    act(() => useEmilyStore.getState().setManualEmotion('frustrated'))
    render(<MomoFromStore size="md" />)
    expect(screen.getByRole('img', { name: 'Momo' })).toBeInTheDocument()
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
      <Momo celebrate />
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

// Spec R8: the one idle a character may have, opt-in; and a gaze the page can steer.
describe('Loti idle and gaze (ticket 07b)', () => {
  it('is still by default; `alive` adds the blink only (the breath lives on an HTML wrapper, LotiSays)', () => {
    const still = render(<Loti pose="idle" />)
    expect(still.container.querySelector('.char-anim-blink')).toBeNull()
    still.unmount()
    const { container } = render(<Loti pose="idle" alive />)
    expect(container.querySelector('[class*="breathe"]')).toBeNull()
    expect(container.querySelector('.char-anim-blink')).not.toBeNull()
  })

  it('tokens.css keeps no SVG breath and no override for it', () => {
    const css = readFileSync(path.resolve(__dirname, '../../../styles/tokens.css'), 'utf8')
    expect(css).not.toMatch(/char-breathe|char-anim-breathe/)
  })

  it('drops the idle under reduced motion', () => {
    act(() => useAppStore.getState().setReducedMotion(true))
    const { container } = render(<Loti pose="idle" alive />)
    expect(container.querySelector(ANIM)).toBeNull()
  })

  it('`look` moves both eyes', () => {
    const { container } = render(<Loti pose="idle" look={[2, -1]} />)
    const eyes = [...container.querySelectorAll('ellipse[fill="var(--char-face)"]')].map((e) => [e.getAttribute('cx'), e.getAttribute('cy')])
    expect(eyes).toEqual([
      ['68', '49'],
      ['96', '49'],
    ])
  })
})
