import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const THEME_KEY_LITERAL = 'synapsetwin_theme_v1'

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

/* No flash of the light theme on reload: index.html applies the stored theme before the first paint,
   before any module loads. Its inline script runs here against the same storage key. */
describe('theme before paint (index.html)', () => {
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!)
  const run = () => new Function(inline[0] ?? 'throw new Error("no inline script")')()

  it('has one inline script in <head>, before the app module', () => {
    expect(inline).toHaveLength(1)
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('</head>'))
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('src="/src/main.tsx"'))
    expect(html).toContain(THEME_KEY_LITERAL)
  })

  it('applies a stored dark theme, and keeps light otherwise', () => {
    localStorage.setItem(THEME_KEY_LITERAL, 'dark')
    run()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    document.documentElement.setAttribute('data-theme', 'light')
    localStorage.setItem(THEME_KEY_LITERAL, 'purple')
    run()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(run).not.toThrow()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  })

  it('uses the store key', async () => {
    expect((await import('../state/useAppStore')).THEME_KEY).toBe(THEME_KEY_LITERAL)
  })
})
