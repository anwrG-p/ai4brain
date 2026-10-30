import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DESIGN_SYSTEM_CONTRAST_PAIRS } from './token-metadata'

// check-contrast.mjs reads only token-metadata.ts, so this keeps the metadata and the CSS in sync.
// Read from disk: Vitest's CSS handling turns `tokens.css?raw` into an empty string.
const read = (rel: string) => readFileSync(path.resolve(__dirname, rel), 'utf8').replace(/\r\n/g, '\n')
const tokensCss = read('tokens.css')
const mainSrc = read('../main.tsx')

function block(selectorStart: string): string {
  const start = tokensCss.indexOf(selectorStart)
  expect(start, `${selectorStart} block`).toBeGreaterThanOrEqual(0)
  return tokensCss.slice(start, tokensCss.indexOf('}', start))
}

function colorVars(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  for (const m of css.matchAll(/(--color-[a-z-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    vars.set(m[1]!, m[2]!.toUpperCase())
  }
  return vars
}

function metadataHex(theme: 'light' | 'dark', name: string): string {
  for (const p of DESIGN_SYSTEM_CONTRAST_PAIRS) {
    if (p.theme !== theme) continue
    if (p.fgName === name) return p.fgHex.toUpperCase()
    if (p.bgName === name) return p.bgHex.toUpperCase()
  }
  throw new Error(`no ${theme} metadata pair uses ${name}`)
}

const light = colorVars(block(':root,\n[data-theme="light"]'))
const dark = colorVars(block('[data-theme="dark"] {'))
const theme = colorVars(block('@theme {'))

describe('tokens.css', () => {
  it.each(['--color-canvas', '--color-surface', '--color-ink', '--color-brand'])(
    'light %s matches token-metadata',
    (name) => {
      expect(light.get(name)).toBe(metadataHex('light', name))
    },
  )

  it.each(['--color-canvas', '--color-surface', '--color-ink', '--color-brand'])(
    'dark %s matches token-metadata',
    (name) => {
      expect(dark.get(name)).toBe(metadataHex('dark', name))
    },
  )

  // Every --color-* hex the contrast script audits must be the one the CSS ships.
  const metadataColors = DESIGN_SYSTEM_CONTRAST_PAIRS.flatMap((p) => [
    [p.id, p.theme, p.fgName, p.fgHex] as const,
    [p.id, p.theme, p.bgName, p.bgHex] as const,
  ]).filter(([, , name]) => name.startsWith('--color-'))

  it.each(metadataColors)('%s: %s %s matches tokens.css', (_id, theme, name, hex) => {
    const css = theme === 'light' ? light : dark
    expect(css.get(name)).toBe(hex.toUpperCase())
  })

  it('keeps @theme colours equal to the light block', () => {
    expect(theme.size).toBeGreaterThanOrEqual(20)
    for (const [name, hex] of theme) {
      expect(light.get(name), name).toBe(hex)
    }
  })

  it('has no Delius font left', () => {
    expect(tokensCss).not.toMatch(/Delius/)
    expect(mainSrc).not.toMatch(/Delius/)
  })
})
