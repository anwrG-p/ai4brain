import { expect, test, type Page } from '@playwright/test'

/* Need-to-know only (rule 13), counted the way a user meets it: every visible word above the fold,
   the shell included (logo, tabs, theme toggle, footer), not just <main>. The page specs keep their
   own <main> budgets; this one guards against the chrome creeping up. Home and Train run with a few
   saved sessions, their fullest everyday state. */

const DAY = 86_400_000
const inputs = (k: number) =>
  Object.fromEntries(
    Object.entries({ OSPAN: 58, OTS_Planning: 52, FluidMatrices: 60, ANT_Conflict: 44, MST_LDI: 40, UFOV_SOA: 64 }).map(([id, s]) => [
      id,
      { score: s + 2 * k, trials: 40 },
    ]),
  )
const sessions = (n: number) =>
  Array.from({ length: n }, (_, k) => ({ id: `seed-${k}`, at: new Date(Date.now() - ((n - 1 - k) * 7 + 1) * DAY).toISOString(), inputs: inputs(k) }))

function visibleWords(page: Page) {
  return page.evaluate(() => {
    let n = 0
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement
      // What the eye reads: aria-hidden text still counts (Welcome's word-by-word line is drawn
      // aria-hidden beside a screen-reader copy); visually hidden text does not.
      if (!el || el.closest('.sr-only, script, style')) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || r.top >= window.innerHeight || r.bottom <= 0) continue
      const css = getComputedStyle(el)
      if (css.visibility === 'hidden' || css.opacity === '0') continue
      n += (walker.currentNode.textContent ?? '').split(/\s+/).filter(Boolean).length
    }
    return n
  })
}

// Page budget (spec: about 60 above the fold, Welcome 40) plus the shell's own words.
const PAGES = [
  { url: '/', name: 'Welcome', heading: "Hi, I'm Loti.", budget: 50, seed: 0 },
  { url: '/dashboard', name: 'Home', heading: null, budget: 75, seed: 4 },
  { url: '/train', name: 'Train', heading: 'Train', budget: 75, seed: 1 },
  { url: '/coach', name: 'Loti', heading: null, budget: 75, seed: 0 },
  { url: '/you', name: 'You', heading: 'Guest', budget: 75, seed: 0 },
] as const

test.describe('Word budget with the shell (rule 13)', () => {
  test.use({ reducedMotion: 'reduce' })

  for (const p of PAGES) {
    for (const [width, height] of [[1440, 900], [375, 812]] as const) {
      test(`${p.name} at ${width}px: at most ${p.budget} visible words above the fold, shell included`, async ({ page }) => {
        if (p.seed) {
          const value = JSON.stringify({ version: 1, sessions: sessions(p.seed) })
          await page.addInitScript((v) => window.localStorage.setItem('synapsetwin_sessions_v1', v), value)
        }
        await page.setViewportSize({ width, height })
        await page.goto(p.url, { waitUntil: 'networkidle' })
        await expect(page.getByRole('heading', { level: 1, ...(p.heading ? { name: p.heading } : {}) })).toBeVisible()
        await page.waitForTimeout(300) // Welcome reveals its line word by word; reduced motion shows it at once
        const n = await visibleWords(page)
        test.info().annotations.push({ type: 'words', description: `${p.name} ${width}: ${n}` })
        expect(n).toBeLessThanOrEqual(p.budget)
      })
    }
  }
})
