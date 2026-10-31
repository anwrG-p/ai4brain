import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// SHOTS_DIR lets a local run write its screenshots elsewhere.
const SCREENSHOT_DIR = process.env.SHOTS_DIR ?? path.resolve(process.cwd(), '../docs/ui/screenshots')

const TOPICS = [
  'The 5 pillars and their exercises',
  'How a pillar score is built',
  'Brain areas',
  'Your progress curve',
  'Real improvement',
]

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]

/** Words in <main> whose text is on screen in the first viewport. */
async function wordsAboveFold(page: Page): Promise<number> {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return Infinity
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    let count = 0
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      // A closed <details> keeps its body laid out under content-visibility: hidden.
      if (!node.parentElement?.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const r = range.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || r.top >= window.innerHeight || r.bottom <= 0) continue
      count += (node.textContent ?? '').split(/\s+/).filter(Boolean).length
    }
    return count
  })
}

/** Text blocks in <main> (p, li, dd) that run past 2 lines, as "lines: start of text". */
async function longBlocks(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('main p, main li, main dd'))
      .filter((el) => el.checkVisibility())
      .map((el) => {
        const cs = getComputedStyle(el)
        const lh = cs.lineHeight === 'normal' ? parseFloat(cs.fontSize) * 1.2 : parseFloat(cs.lineHeight)
        const content = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
        return { lines: Math.round(content / lh), text: (el.textContent ?? '').trim().slice(0, 60) }
      })
      .filter((b) => b.lines > 2)
      .map((b) => `${b.lines}: ${b.text}`),
  )
}

async function setAll(page: Page, open: boolean) {
  for (const name of TOPICS) {
    const details = page.locator('main details').filter({ has: page.getByRole('heading', { level: 2, name }) })
    if ((await details.evaluate((d) => (d as HTMLDetailsElement).open)) !== open) {
      await details.locator('summary').click()
    }
  }
}

async function checkViewports(page: Page, theme: 'light' | 'dark', state: 'closed' | 'open') {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp)
    await expect(page.getByRole('heading', { level: 1, name: 'How we calculate this' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `horizontal overflow at ${vp.width}px (${theme}, ${state})`).toBe(false)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations, `axe at ${vp.width}px (${theme}, ${state})`).toEqual([])
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `15-methodology-${theme}-${state}-${vp.width}.png`),
      fullPage: true,
    })
  }
}

test.describe('How we calculate this (/methodology)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('plain intro, five closed topics, at most 60 words above the fold at 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/methodology', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1, name: 'How we calculate this' })).toBeVisible()
    await expect(page.getByText('Real improvement means a change bigger than normal day-to-day noise.')).toBeVisible()
    const details = page.locator('main details')
    await expect(details).toHaveCount(TOPICS.length)
    for (let i = 0; i < TOPICS.length; i++) {
      await expect(details.nth(i).getByRole('heading', { level: 2 })).toHaveText(TOPICS[i]!)
      expect(await details.nth(i).evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false)
    }
    await expect(page.getByRole('table', { name: 'Weights per pillar' })).toBeHidden()
    const words = await wordsAboveFold(page)
    expect(words).toBeGreaterThan(30) // the counter sees the heading, intro and topic titles
    expect(words).toBeLessThanOrEqual(60)
  })

  test('axe light and dark at 375/768/1440, topics closed and open; no overflow', async ({ page }) => {
    await page.goto('/methodology', { waitUntil: 'networkidle' })
    await checkViewports(page, 'light', 'closed')
    await setAll(page, true)
    await expect(page.getByRole('table', { name: 'Weights per pillar' })).toBeVisible()
    // Rule 13: no paragraph past 2 lines, even with every topic open (checked at 1440).
    await page.setViewportSize({ width: 1440, height: 900 })
    expect(await longBlocks(page)).toEqual([])
    await checkViewports(page, 'light', 'open')

    await setAll(page, false)
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await checkViewports(page, 'dark', 'closed')
    await setAll(page, true)
    await checkViewports(page, 'dark', 'open')
  })
})
