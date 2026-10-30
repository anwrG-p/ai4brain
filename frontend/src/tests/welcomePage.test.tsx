import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../state/useAppStore'
import { App } from '../App'

async function renderWelcome() {
  window.history.pushState({}, '', '/')
  render(<App />)
  await screen.findByRole('heading', { name: /Let's map how your mind works/i }, { timeout: 5000 })
  const main = document.querySelector('main')
  if (!main) throw new Error('no <main> on /')
  return main
}

describe('Welcome (/) Calm & Clean', () => {
  beforeEach(() => {
    useAppStore.getState().resetDemoState()
  })

  it('shows no decorative mascot image', async () => {
    const main = await renderWelcome()
    expect(main.querySelectorAll('img')).toHaveLength(0)
    expect(main.querySelectorAll('img[aria-hidden="true"], [aria-hidden="true"] img')).toHaveLength(0)
  })

  it('has exactly one primary-styled button or link', async () => {
    const main = await renderWelcome()
    const primary = Array.from(main.querySelectorAll('a, button')).filter((el) =>
      /(^|\s)bg-brand(\s|$)/.test(el.className),
    )
    expect(primary.map((el) => el.textContent?.trim())).toEqual(['Start my 2-minute baseline'])
  })

  it('keeps the visible copy under 140 words', async () => {
    const main = await renderWelcome()
    const clone = main.cloneNode(true) as HTMLElement
    clone.querySelectorAll('details').forEach((d) => d.remove())
    const words = (clone.textContent ?? '').split(/\s+/).filter(Boolean)
    expect(words.length).toBeLessThan(140)
  })

  it('links the privacy line to the methodology page', async () => {
    await renderWelcome()
    expect(screen.getByText(/Private by design: no camera, no microphone, no biometrics\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /methodology/i })).toHaveAttribute('href', '/methodology')
    expect(screen.getByRole('link', { name: /^Sign in$/ })).toHaveAttribute('href', '/auth')
  })
})
