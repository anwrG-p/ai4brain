import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { FULL_PAGE_CSS } from './testUtils'

const SCREENSHOT_DIR = process.env.SHOTS_DIR ?? path.resolve(process.cwd(), '../docs/ui/screenshots')

const VIEWPORTS = [
  { width: 1440, height: 900, label: '1440' },
  { width: 768, height: 1024, label: '768' },
  { width: 375, height: 812, label: '375' },
]

/** Words a sighted user sees in <main> above the fold: screen-reader-only and hidden text left out. */
function wordsAboveFold(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return 0
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    let words = 0
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement
      if (!el || el.closest('.sr-only, [aria-hidden="true"], svg')) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      const r = range.getBoundingClientRect()
      if (r.height === 0 || r.top >= window.innerHeight) continue
      words += (n.textContent ?? '').split(/\s+/).filter(Boolean).length
    }
    return words
  })
}

async function checkViewports(page: Page, theme: 'light' | 'dark') {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await expect(page.getByRole('heading', { level: 1, name: 'Talk with Loti' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `Horizontal overflow at ${vp.width}px (${theme})`).toBe(false)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations, `axe at ${vp.width}px (${theme})`).toEqual([])
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `coach-${theme === 'dark' ? 'dark-' : ''}${vp.label}.png`),
      fullPage: true, style: FULL_PAGE_CSS,
    })
  }
}

test.describe('Loti (/coach)', () => {
  test.use({ reducedMotion: 'reduce' })
  // A Wednesday afternoon with nothing measured, so Loti opens with "How was your day?" (no train nudge).
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-28T15:00:00'))
  })

  test('first load: one question with chips, at most 60 words above the fold', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/coach', { waitUntil: 'networkidle' })
    await expect(page.getByRole('log')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Reply to Loti' }).getByRole('button').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /start over/i })).toHaveCount(0)
    expect(await wordsAboveFold(page)).toBeLessThanOrEqual(60)
  })

  test('a pick adds the reply and the next bubble; axe light and dark; no overflow at 375/768/1440', async ({ page }) => {
    await page.goto('/coach', { waitUntil: 'networkidle' })
    const chips = page.getByRole('group', { name: 'Reply to Loti' })
    const first = chips.getByRole('button').first()
    const label = (await first.textContent())?.trim() ?? ''
    await first.click()
    await expect(page.getByRole('log').locator('[data-from="you"]').last()).toContainText(label)
    await expect(page.getByRole('button', { name: /start over/i })).toBeVisible()
    await checkViewports(page, 'light')

    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)
    await checkViewports(page, 'dark')
  })

  test('the talk survives a reload; Start over clears it', async ({ page }) => {
    await page.goto('/coach', { waitUntil: 'networkidle' })
    await page.getByRole('group', { name: 'Reply to Loti' }).getByRole('button').first().click()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('log').locator('[data-from="you"]')).toHaveCount(1)
    await page.getByRole('button', { name: /start over/i }).click()
    await expect(page.getByRole('log').locator('[data-from="you"]')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('group', { name: 'Reply to Loti' })).toBeVisible()
  })
})
