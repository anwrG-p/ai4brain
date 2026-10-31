import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../state/useAppStore'
import { App } from '../App'

async function renderWelcome() {
  window.history.pushState({}, '', '/')
  render(<App />)
  await screen.findByRole('heading', { level: 1, name: "Hi, I'm Loti." }, { timeout: 5000 })
  const main = document.querySelector('main')
  if (!main) throw new Error('no <main> on /')
  return main
}

describe('Welcome (/): Loti, one button, one link', () => {
  beforeEach(() => {
    useAppStore.getState().resetDemoState()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    act(() => useAppStore.getState().setReducedMotion(false))
  })

  it('shows Loti with one bubble', async () => {
    const main = await renderWelcome()
    expect(within(main).getByRole('img', { name: /Loti/ })).toBeInTheDocument()
    expect(within(main).getByText('Want to see how your mind works today? It takes about 5 minutes.')).toBeInTheDocument()
  })

  it('has exactly one primary button, Start, and one other control', async () => {
    const main = await renderWelcome()
    const controls = Array.from(main.querySelectorAll('a, button'))
    const primary = controls.filter((el) => /(^|\s)bg-brand(\s|$)/.test(el.className))
    expect(primary.map((el) => el.textContent?.trim())).toEqual(['Start'])
    expect(controls.map((el) => el.textContent?.trim())).toEqual(['Start', 'I already have an account'])
  })

  it('keeps the visible copy to 40 words or fewer', async () => {
    const main = await renderWelcome()
    // The word reveal draws an aria-hidden copy beside the screen-reader text: count each word once.
    const copy = main.cloneNode(true) as HTMLElement
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove())
    const words = (copy.textContent ?? '').split(/\s+/).filter(Boolean)
    expect(words.length).toBeLessThanOrEqual(40)
  })

  it('keeps the header to the logo and the theme toggle', async () => {
    await renderWelcome()
    const header = screen.getByRole('banner')
    expect(within(header).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/'])
    expect(within(header).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Switch to Dark (Night Lab)'])
    expect(screen.queryByRole('contentinfo')).toBeNull()
    expect(screen.queryByTestId('page-progress-badge')).toBeNull()
  })

  it('Start goes to the baseline', async () => {
    await renderWelcome()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(await screen.findByText('1 of 5', { exact: false })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/baseline')
    await screen.findByRole('heading', { name: 'Logic Web' }) // the first exercise has loaded
  })

  it('"I already have an account" opens the login sheet: guest only, no Google without a client id', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    await renderWelcome()
    const link = screen.getByRole('button', { name: 'I already have an account' })
    link.focus() // fireEvent.click does not move focus
    fireEvent.click(link)
    const sheet = screen.getByRole('dialog')
    expect(sheet).toHaveFocus()
    expect(within(sheet).getByRole('button', { name: 'Continue as guest' })).toBeInTheDocument()
    expect(screen.queryByTestId('google-signin')).toBeNull()
    expect(within(sheet).queryByText(/Save your answers/)).toBeNull() // no consent step from here
    fireEvent.keyDown(sheet, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'I already have an account' })).toHaveFocus()
  })

  it('shows the Google sign-in box when VITE_GOOGLE_CLIENT_ID is set', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client.apps.googleusercontent.com')
    await renderWelcome()
    fireEvent.click(screen.getByRole('button', { name: 'I already have an account' }))
    expect(screen.getByTestId('google-signin')).toBeInTheDocument()
  })

  // Motion pass (ticket 07b, spec R8).
  it('reveals the bubble word by word on screen, with the full text in the DOM for screen readers from the start', async () => {
    const main = await renderWelcome()
    const line = 'Want to see how your mind works today? It takes about 5 minutes.'
    expect(screen.getByRole('heading', { level: 1, name: "Hi, I'm Loti." })).toBeInTheDocument()
    expect(within(main).getByText(line)).toHaveClass('sr-only')
    const shown = main.querySelectorAll('[aria-hidden="true"] .anim-word')
    expect(Array.from(shown, (w) => w.textContent).join(' ')).toBe(`Hi, I'm Loti. ${line}`)
    expect(within(main).getByRole('img', { name: /Loti/ }).closest('.anim-rise')).not.toBeNull()
  })

  it('Start: Loti turns happy, the page leaves, then the baseline opens', async () => {
    const main = await renderWelcome()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(within(main).getByRole('img', { name: 'Loti is happy' })).toBeInTheDocument()
    expect(main.querySelector('.anim-page-exit')).not.toBeNull()
    expect(window.location.pathname).toBe('/') // the exit plays first (300 ms at most)
    expect(await screen.findByText('1 of 5', { exact: false })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/baseline')
    await screen.findByRole('heading', { name: 'Logic Web' }) // the first exercise has loaded
  })

  it('reduced motion: nothing animates and Start goes at once', async () => {
    act(() => useAppStore.getState().setReducedMotion(true))
    const main = await renderWelcome()
    expect(main.querySelector('[class*="anim-"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(window.location.pathname).toBe('/baseline')
    await screen.findByRole('heading', { name: 'Logic Web' })
  })

  const eyeX = (main: HTMLElement) =>
    Number(within(main).getByRole('img', { name: /Loti/ }).querySelector('ellipse[rx="6"][ry="8"]')!.getAttribute('cx'))
  const finePointer = (reduce: boolean) =>
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('pointer: fine') || (reduce && query.includes('reduce')),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )

  it("Loti's eyes follow a mouse pointer", async () => {
    finePointer(false)
    const main = await renderWelcome()
    const x0 = eyeX(main)
    act(() => void fireEvent.mouseMove(window, { clientX: 2000, clientY: 0 }))
    expect(eyeX(main)).toBeGreaterThan(x0)
  })

  it("reduced motion: Loti's eyes stay still", async () => {
    finePointer(true)
    const main = await renderWelcome()
    const x0 = eyeX(main)
    act(() => void fireEvent.mouseMove(window, { clientX: 2000, clientY: 0 }))
    expect(eyeX(main)).toBe(x0)
  })

  it("touch (no fine pointer): Loti's eyes stay still", async () => {
    const main = await renderWelcome() // jsdom has no matchMedia: treated as no fine pointer
    const x0 = eyeX(main)
    act(() => void fireEvent.mouseMove(window, { clientX: 2000, clientY: 0 }))
    expect(eyeX(main)).toBe(x0)
  })
})
