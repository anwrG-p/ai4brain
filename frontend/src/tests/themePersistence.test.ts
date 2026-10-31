import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/* The theme survives a reload (localStorage). Each test loads a fresh copy of the store module, as a
   page load would. */
const load = async () => (await import('../state/useAppStore')).useAppStore

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  document.documentElement.setAttribute('data-theme', 'light')
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('theme persistence', () => {
  it('a chosen theme is there again after a reload', async () => {
    ;(await load()).getState().toggleTheme()
    vi.resetModules()
    document.documentElement.setAttribute('data-theme', 'light') // a fresh page
    const store = await load()
    expect(store.getState().theme).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('starts light with nothing stored, or with a value that is not a theme', async () => {
    expect((await load()).getState().theme).toBe('light')
    vi.resetModules()
    localStorage.setItem('synapsetwin_theme_v1', 'purple')
    expect((await load()).getState().theme).toBe('light')
  })

  it('works without storage: blocked reads and writes fall back to light and do not throw', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const store = await load()
    expect(store.getState().theme).toBe('light')
    expect(() => store.getState().setTheme('dark')).not.toThrow()
    expect(store.getState().theme).toBe('dark')
  })
})
