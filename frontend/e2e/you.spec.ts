import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'

// SHOTS_DIR sends the screenshots to a scratch folder instead of the docs.
const SCREENSHOT_DIR = process.env.SHOTS_DIR ?? path.resolve(process.cwd(), '../docs/ui/screenshots')

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]

// Visible words in <main> above the fold: rendered text only, no sr-only or aria-hidden copies.
function wordsAboveFold(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return Infinity
    let n = 0
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement
      if (!el || el.closest('.sr-only, [aria-hidden="true"]')) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.top >= window.innerHeight || r.bottom <= 0) continue
      n += (walker.currentNode.textContent ?? '').split(/\s+/).filter(Boolean).length
    }
    return n
  })
}

async function checkViewports(page: Page, theme: 'light' | 'dark') {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `Horizontal overflow at ${vp.width}px (${theme})`).toBe(false)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations, `axe at ${vp.width}px (${theme})`).toEqual([])
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `you-${theme}-${vp.width}.png`), fullPage: true })
  }
}

test.describe('You (/you)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('name line and 4 rows; ≤60 words above the fold; axe light and dark; no overflow at 375/768/1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/you', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1, name: 'Guest' })).toBeVisible()
    const rows = page.getByRole('navigation', { name: 'You' }).getByRole('listitem')
    await expect(rows).toHaveText(['Privacy', 'Settings', 'How we calculate this', 'Sign in'])
    expect(await wordsAboveFold(page)).toBeLessThanOrEqual(60)
    await checkViewports(page, 'light')
    // The store is the theme's source of truth; the header toggle belongs to 09a.
    await page.evaluate(() => (window as any).__appStore.getState().setTheme('dark'))
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await checkViewports(page, 'dark')
  })

  test('the Privacy row opens /privacy', async ({ page }) => {
    await page.goto('/you', { waitUntil: 'networkidle' })
    await page.getByRole('navigation', { name: 'You' }).getByRole('link', { name: 'Privacy' }).click()
    await expect(page).toHaveURL(/\/privacy$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible()
  })
})
