import { test, expect, type Page, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { FULL_PAGE_CSS } from './testUtils'

// Screenshots go to TRAIN_SHOTS_DIR when set, else to this test's own output folder (never docs/).
const shotPath = (testInfo: TestInfo, name: string) =>
  process.env.TRAIN_SHOTS_DIR ? path.join(process.env.TRAIN_SHOTS_DIR, name) : testInfo.outputPath(name)

const VIEWPORTS = [
  { width: 1440, height: 900, label: '1440' },
  { width: 768, height: 1024, label: '768' },
  { width: 375, height: 812, label: '375' },
]

// One finished session on this device (sessionStore's v1 shape), so the pillars show scores.
const SESSIONS = JSON.stringify({
  version: 1,
  sessions: [
    {
      id: 'e2e-1',
      at: '2026-10-30T10:00:00.000Z',
      inputs: {
        OSPAN: { score: 78, trials: 20 },
        OTS_Planning: { score: 66, trials: 4 },
        ANT_Conflict: { score: 61, trials: 24 },
        SST_SSRT: { score: 70, trials: 24, proxy: true },
        MST_LDI: { score: 52, trials: 30 },
        UFOV_SOA: { score: 34, trials: 20 },
        ANT_Orienting: { score: 41, trials: 20 },
      },
    },
  ],
})

async function seed(page: Page) {
  await page.addInitScript((value) => localStorage.setItem('synapsetwin_sessions_v1', value), SESSIONS)
}

/** Words a sighted user sees above the fold on the page (the shell's header is 09a's and left out):
    screen-reader-only and hidden text is left out, and a text node counts when any of it sits
    within the viewport. */
async function wordsAboveFold(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="train-page"]')
    if (!root) return Infinity
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let words = 0
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement
      if (!el || el.closest('.sr-only, [aria-hidden="true"]')) continue
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const rect = range.getBoundingClientRect()
      if (rect.height === 0 || rect.top >= window.innerHeight || rect.bottom <= 0) continue
      words += (node.textContent ?? '').split(/\s+/).filter(Boolean).length
    }
    return words
  })
}

async function checkViewports(page: Page, theme: 'light' | 'dark', testInfo: TestInfo) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await expect(page.getByRole('heading', { level: 1, name: 'Train' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `Horizontal overflow at ${vp.width}px (${theme})`).toBe(false)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations, `axe at ${vp.width}px (${theme})`).toEqual([])
    await page.screenshot({
      path: shotPath(testInfo, `09-train-${theme === 'dark' ? 'dark-' : ''}${vp.label}.png`),
      fullPage: true, style: FULL_PAGE_CSS,
    })
  }
}

test.describe('Train (/train)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('five pillars, one primary; axe light and dark; no overflow at 375/768/1440', async ({ page }, testInfo) => {
    await seed(page)
    await page.goto('/train', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(5)
    await expect(page.getByRole('img', { name: /Loti/ }).first()).toBeVisible()
    await checkViewports(page, 'light', testInfo)

    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)
    await checkViewports(page, 'dark', testInfo)
  })

  test('reduced motion: no entrance or press classes on the page', async ({ page }) => {
    await seed(page)
    await page.goto('/train', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1, name: 'Train' })).toBeVisible()
    await expect(page.locator('[data-testid="train-page"] [class*="anim-"]')).toHaveCount(0)
  })

  test('at most 60 words above the fold at 1440x900', async ({ page }) => {
    await seed(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    // The weakest pillar first, and the longest pillar (three exercises) first.
    for (const url of ['/train', '/train?pillar=focus']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      await expect(page.getByRole('heading', { level: 1, name: 'Train' })).toBeVisible()
      expect(await wordsAboveFold(page), url).toBeLessThanOrEqual(60)
    }
  })

  test('?pillar= puts that pillar first with focus; Start opens the runner', async ({ page }) => {
    await seed(page)
    await page.goto('/train?pillar=memory', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText('Deep Memory')
    const memory = page.getByRole('region', { name: 'Deep Memory' })
    await expect(memory).toBeFocused()
    // The focused section shows the focus-ring outline.
    expect(await memory.evaluate((el) => el.matches(':focus-visible') && getComputedStyle(el).outlineStyle)).toBe('solid')
    await page.getByRole('link', { name: 'Start Precision Archive' }).click()
    await expect(page).toHaveURL(/\/task\/episodic_pattern_separation\?schema=mst$/)
  })
})
