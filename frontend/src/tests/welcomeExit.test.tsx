import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from '../App'
import { useAppStore } from '../state/useAppStore'

/* Welcome → Baseline while the Baseline page's code is still loading (a slow network): Welcome must
   stay on screen, not fade out to a blank page, and take no keys or clicks while it leaves. The
   Baseline module is held back here until the test lets it load. */

const chunk = vi.hoisted(() => {
  let release = () => {}
  const ready = new Promise<void>((r) => (release = r))
  return { ready, release: () => release() }
})

vi.mock('../pages/BaselinePage', async () => {
  await chunk.ready
  return { default: () => <h1>Baseline stub</h1> }
})

beforeEach(() => useAppStore.getState().resetDemoState())
afterEach(() => act(() => useAppStore.getState().setReducedMotion(false)))

async function renderWelcome() {
  window.history.pushState({}, '', '/')
  render(<App />)
  await screen.findByRole('heading', { level: 1, name: "Hi, I'm Loti." }, { timeout: 5000 })
  return document.querySelector('main')!
}

it('reduced motion: Start goes at once, and Welcome stays visible but inert until the baseline has loaded', async () => {
  act(() => useAppStore.getState().setReducedMotion(true))
  const main = await renderWelcome()
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  expect(window.location.pathname).toBe('/baseline')
  expect(within(main).getByRole('heading', { level: 1, name: "Hi, I'm Loti." })).toBeInTheDocument()
  expect(main.querySelector('[inert]')).not.toBeNull()
})

it('motion: the exit waits for the baseline code, so the screen is never blank', async () => {
  // Nothing has released the module yet: it is still loading.
  const main = await renderWelcome()
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  expect(within(main).getByRole('img', { name: 'Loti is happy' })).toBeInTheDocument()
  expect(main.querySelector('[inert]')).not.toBeNull()
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400)) // longer than the exit
  })
  expect(main.querySelector('.anim-page-exit')).toBeNull() // not faded out while nothing is ready
  expect(window.location.pathname).toBe('/')

  await act(async () => chunk.release())
  expect(await screen.findByRole('heading', { level: 1, name: 'Baseline stub' })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/baseline')
})
