import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DESIGN_SYSTEM_CONTRAST_PAIRS } from './token-metadata'

// check-contrast.mjs reads only token-metadata.ts, so this keeps the metadata and the CSS in sync.
// Read from disk: Vitest's CSS handling turns `tokens.css?raw` into an empty string.
const read = (rel: string) => readFileSync(path.resolve(__dirname, rel), 'utf8').replace(/\r\n/g, '\n')
const tokensCss = read('tokens.css')
const mainSrc = read('../main.tsx')
const pkg = JSON.parse(read('../../package.json')) as { dependencies: Record<string, string> }

function block(selectorStart: string): string {
  const start = tokensCss.indexOf(selectorStart)
  expect(start, `${selectorStart} block`).toBeGreaterThanOrEqual(0)
  return tokensCss.slice(start, tokensCss.indexOf('}', start))
}

// Every audited custom property (--color-*, --pillar-*, --dim-*) with a 6-digit hex value.
function hexVars(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  for (const m of css.matchAll(/(--(?:color|pillar|dim)-[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
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

const lightBlock = block(':root,\n[data-theme="light"]')
const darkBlock = block('[data-theme="dark"] {')
const themeBlock = block('@theme {')
const light = hexVars(lightBlock)
const dark = hexVars(darkBlock)
const theme = hexVars(themeBlock)

const PILLARS = ['--pillar-focus', '--pillar-agility', '--pillar-impulse', '--pillar-memory', '--pillar-visual']

describe('tokens.css palette', () => {
  it.each(['--color-canvas', '--color-surface', '--color-ink', '--color-brand', '--color-accent'])(
    'light %s matches token-metadata',
    (name) => {
      expect(light.get(name)).toBe(metadataHex('light', name))
    },
  )

  it.each(['--color-canvas', '--color-surface', '--color-ink', '--color-brand', '--color-accent'])(
    'dark %s matches token-metadata',
    (name) => {
      expect(dark.get(name)).toBe(metadataHex('dark', name))
    },
  )

  it('ships the brand v2 sky canvas, surface and ink', () => {
    expect(light.get('--color-canvas')).toBe('#FFFFFF')
    expect(light.get('--color-ink')).toBe('#0F2233')
    expect(dark.get('--color-canvas')).toBe('#162621')
    expect(dark.get('--color-surface')).toBe('#122130')
    expect(light.get('--color-accent')).toBe('#F2876B')
  })

  // Every hex the contrast script audits must be the one the CSS ships.
  const metadataColors = DESIGN_SYSTEM_CONTRAST_PAIRS.flatMap((p) => [
    [p.id, p.theme, p.fgName, p.fgHex] as const,
    [p.id, p.theme, p.bgName, p.bgHex] as const,
  ])

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

  it.each(PILLARS)('%s exists in both themes and is audited at >= 3:1 on surface', (name) => {
    expect(light.get(name), `light ${name}`).toMatch(/^#[0-9A-F]{6}$/)
    expect(dark.get(name), `dark ${name}`).toMatch(/^#[0-9A-F]{6}$/)
    for (const t of ['light', 'dark'] as const) {
      const pair = DESIGN_SYSTEM_CONTRAST_PAIRS.find(
        (p) => p.theme === t && p.fgName === name && p.bgName === '--color-surface',
      )
      expect(pair, `${t} ${name} on surface`).toBeDefined()
      expect(pair!.minRequired).toBe(3.0)
    }
  })

  // Anti-slop rule 1: no purple or violet anywhere in the token file.
  it('has no purple or violet colour', () => {
    const colours: [string, number, number, number][] = []
    for (const m of tokensCss.matchAll(/#([0-9A-Fa-f]{6})\b/g)) {
      const h = m[1]!
      colours.push([m[0], parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)])
    }
    for (const m of tokensCss.matchAll(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/g)) {
      colours.push([m[0], Number(m[1]), Number(m[2]), Number(m[3])])
    }
    expect(colours.length).toBeGreaterThan(50)
    for (const [src, r, g, b] of colours) {
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max - min < 40) continue // near-grey
      const d = max - min
      const hue =
        max === r ? (60 * ((g - b) / d) + 360) % 360 : max === g ? 60 * ((b - r) / d) + 120 : 60 * ((r - g) / d) + 240
      expect(hue >= 240 && hue <= 320, `${src} has hue ${hue.toFixed(0)}`).toBe(false)
    }
  })
})

describe('tokens.css shape and elevation', () => {
  // Anti-slop rules 1, 2 and 9: gradients only inside the clay token, never backdrop blur.
  // The one exception is the classroom board's dot grid on #root (a dot pattern, not a colour wash).
  const DOT_GRID = /background-image: radial-gradient\(color-mix\(.*\) 1\.2px, transparent 1\.2px\);/
  it('has no gradient outside the clay token and the dot grid, and no backdrop-filter', () => {
    const offending = tokensCss
      .split('\n')
      .filter((line) => /(linear|radial)-gradient/.test(line) && !/^\s*--clay[a-z-]*:/.test(line) && !DOT_GRID.test(line))
    expect(offending).toEqual([])
    expect(tokensCss).not.toMatch(/backdrop-filter/)
  })

  it('uses the clay radii and one soft elevation', () => {
    for (const css of [themeBlock, lightBlock]) {
      expect(css).toMatch(/--radius-md:\s*14px;/)
      expect(css).toMatch(/--radius-lg:\s*20px;/)
      expect(css).toMatch(/--radius-xl:\s*24px;/)
      expect(css).toMatch(/--radius-pill:\s*9999px;/)
    }
    expect(lightBlock).toMatch(/--shadow-elevation:\s*0 6px 20px rgb\(30 111 168 \/ 0?\.08\);/)
    expect(darkBlock).toMatch(/--shadow-elevation:\s*none;/)
    expect(lightBlock).toMatch(/--clay:\s*[^;]*inset/)
    expect(darkBlock).toMatch(/--clay:\s*[^;]*inset/)
  })

  it('makes .tactile-btn a 44 px pill and .tactile-card use the single elevation', () => {
    const btn = tokensCss.slice(tokensCss.indexOf('  .tactile-btn {'))
    const btnRule = btn.slice(0, btn.indexOf('}'))
    expect(btnRule).toMatch(/min-height:\s*44px;/)
    expect(btnRule).toMatch(/border-radius:\s*var\(--radius-pill\);/)
    const card = tokensCss.slice(tokensCss.indexOf('  .tactile-card {'))
    expect(card.slice(0, card.indexOf('}'))).toMatch(/box-shadow:\s*var\(--shadow-elevation\);/)
  })

  it('has no backdrop-blur utility anywhere in src', () => {
    expect(srcHits(/backdrop-blur|backdrop-filter/)).toEqual([])
  })

  // brand-vivid (3.50:1) and the coral fill (2.48:1 on white) fail as text; coral text and
  // milestone marks use --color-accent-strong. Fills under their ink and bg-* are fine.
  it('never uses brand-vivid as text or the coral fill as text, stroke or fill', () => {
    const banned = /\btext-brand-vivid\b|\b(?:text|stroke|fill)-accent\b(?!-)/
    for (const bad of ['hover:text-accent', 'stroke-accent', 'fill-accent/50', 'text-brand-vivid']) {
      expect(bad).toMatch(banned)
    }
    for (const ok of ['text-accent-strong', 'text-accent-ink', 'bg-accent', 'stroke-brand-vivid']) {
      expect(ok).not.toMatch(banned)
    }
    expect(srcHits(banned)).toEqual([])
  })
})

function srcHits(pattern: RegExp): string[] {
  const hits: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.(tsx?|css)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        const m = readFileSync(full, 'utf8').match(pattern)
        if (m) hits.push(`${path.relative(path.resolve(__dirname, '..'), full)}: ${m[0]}`)
      }
    }
  }
  walk(path.resolve(__dirname, '..'))
  return hits
}

describe('tokens.css fonts', () => {
  it('sets Quicksand for display and Inter for UI in @theme and :root', () => {
    for (const css of [themeBlock, lightBlock]) {
      expect(css).toMatch(/--font-display:\s*'Quicksand'/)
      expect(css).toMatch(/--font-sans:\s*'Inter'/)
    }
  })

  it('imports Quicksand 600/700 and Inter 400/500/600 only', () => {
    for (const w of [600, 700]) expect(mainSrc).toContain(`@fontsource/quicksand/${w}.css`)
    for (const w of [400, 500, 600]) expect(mainSrc).toContain(`@fontsource/inter/${w}.css`)
    expect(mainSrc).not.toMatch(/@fontsource\/(quicksand\/(400|500)|inter\/700)/)
  })

  it('has no Lexend, Delius or Fredoka left', () => {
    for (const src of [tokensCss, mainSrc]) expect(src).not.toMatch(/Lexend|lexend|Delius|delius|Fredoka|fredoka/)
    const deps = Object.keys(pkg.dependencies)
    expect(deps).toContain('@fontsource/quicksand')
    expect(deps).toContain('@fontsource/inter')
    expect(deps.filter((d) => /lexend|delius|fredoka/.test(d))).toEqual([])
  })

  // Allow-list: .font-display is Inter unless the element carries a size of 20 px or more.
  // jsdom applies the unlayered rules (its cascade skips non-"screen" @media blocks, so the
  // responsive sizes are asserted as text below).
  describe('Quicksand only from 20 px (fails safe)', () => {
    const start = tokensCss.indexOf('/* font-display allow-list: start */')
    const end = tokensCss.indexOf('/* font-display allow-list: end */')
    // The base-layer heading default (Inter) comes first, as in the real cascade (layers lose to unlayered).
    const headingBase = /^ {2}h1,\n {2}h2,\n[\s\S]*?\}/m.exec(tokensCss)?.[0] ?? ''
    const rules = headingBase + '\n' + tokensCss.slice(start, end)

    function fontOf(tag: string, className: string): string {
      const style = document.createElement('style')
      style.textContent = rules
      document.head.appendChild(style)
      const el = document.createElement(tag)
      el.className = className
      document.body.appendChild(el)
      const font = getComputedStyle(el).fontFamily
      el.remove()
      style.remove()
      return font
    }

    it('has the allow-list block and no class-substring deny-list', () => {
      expect(start).toBeGreaterThan(0)
      expect(end).toBeGreaterThan(start)
      expect(headingBase).toMatch(/font-family:\s*var\(--font-sans\)/)
      expect(tokensCss).not.toMatch(/:not\(\[class\*=/)
    })

    it.each([
      ['span', 'font-display text-sm hover:text-brand'],
      ['span', 'font-display'],
      ['span', 'font-display text-lg'],
      ['p', 'font-display text-lg sm:text-2xl'],
      ['h3', 'font-display text-base font-bold'],
      ['h1', ''],
      ['h2', 'text-lg'],
    ])('<%s class="%s"> is Inter', (tag, cls) => {
      expect(fontOf(tag, cls)).toBe('var(--font-sans)')
    })

    it.each([
      ['h1', 'font-display text-3xl sm:text-4xl'],
      ['span', 'font-display text-xl'],
      ['h2', 'text-2xl'],
      ['h3', 'text-xl hover:text-brand'],
    ])('<%s class="%s"> is Quicksand', (tag, cls) => {
      expect(fontOf(tag, cls)).toBe('var(--font-display)')
    })

    it('switches responsive sizes of 20 px and up to Quicksand at their breakpoint only', () => {
      for (const [bp, width] of [['sm', '40rem'], ['md', '48rem'], ['lg', '64rem']] as const) {
        const media = rules.slice(rules.indexOf(`@media (width >= ${width})`))
        expect(media, `${bp} block`).toMatch(new RegExp(`\\.${bp}\\\\:text-xl`))
        expect(media).toMatch(new RegExp(`\\.${bp}\\\\:text-4xl`))
      }
    })
  })

  it('sets numbers in Inter with tabular numerals', () => {
    const rule = tokensCss.slice(tokensCss.indexOf('.font-mono-tabular {'))
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/font-family:\s*var\(--font-sans\);[\s\S]*tabular-nums/)
  })
})
