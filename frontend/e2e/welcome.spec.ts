import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'

const SCREENSHOT_DIR = path.resolve(process.cwd(), '../docs/ui/screenshots')

const VIEWPORTS = [
  { width: 1440, height: 900, label: '1440' },
  { width: 768, height: 1024, label: '768' },
  { width: 375, height: 812, label: '375' },
]

async function checkViewports(page: Page, theme: 'light' | 'dark') {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await expect(page.getByRole('heading', { level: 1, name: "Hi, I'm Loti." })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `Horizontal overflow at ${vp.width}px (${theme})`).toBe(false)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations, `axe at ${vp.width}px (${theme})`).toEqual([])
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `01-welcome-${theme === 'dark' ? 'dark-' : ''}${vp.label}.png`),
      fullPage: true,
    })
  }
}

test.describe('Page 01: Welcome (/)', () => {
  // The entrance fades text in over ~1.3 s; axe would read its contrast mid-fade. Pinned here as well
  // as in playwright.config.ts, so the checks always see the page at rest.
  test.use({ reducedMotion: 'reduce' })

  test('Loti, one Start button, one link; axe light and dark; no overflow at 375/768/1440', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.getByRole('img', { name: /Loti/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'I already have an account' })).toBeVisible()
    await checkViewports(page, 'light')

    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)
    await checkViewports(page, 'dark')
  })

  test('"I already have an account" opens the login sheet; Escape closes it', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'I already have an account' }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('button', { name: 'Continue as guest' })).toBeVisible()
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations).toEqual([])
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
  })
})
