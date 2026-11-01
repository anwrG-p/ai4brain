import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { FULL_PAGE_CSS } from './testUtils'

// SHOTS_DIR sends the screenshots to a scratch folder instead of the docs.
const SCREENSHOT_DIR = process.env.SHOTS_DIR ?? path.resolve(process.cwd(), '../docs/ui/screenshots')

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]

async function checkViewports(page: Page, theme: 'light' | 'dark') {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp)
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `Horizontal overflow at ${vp.width}px (${theme})`).toBe(false)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations, `axe at ${vp.width}px (${theme})`).toEqual([])
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `14-settings-${theme}-${vp.width}.png`), fullPage: true, style: FULL_PAGE_CSS })
  }
}

test.describe('Page 14: Settings (/settings)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('theme and reduce motion only; axe light and dark; no overflow at 375/768/1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/settings', { waitUntil: 'networkidle' })
    await expect(page.locator('main').getByRole('radio')).toHaveCount(2)
    await expect(page.getByRole('switch', { name: 'Reduce motion' })).toBeVisible()
    // The whole page fits above the fold, so every word in <main> counts.
    const words = await page.evaluate(() => (document.querySelector('main')?.innerText ?? '').split(/\s+/).filter(Boolean).length)
    expect(words).toBeLessThanOrEqual(60)
    await checkViewports(page, 'light')

    await page.getByRole('radio', { name: 'Dark (Night Lab)' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await checkViewports(page, 'dark')

    const motion = page.getByRole('switch', { name: 'Reduce motion' })
    await motion.click()
    await expect(motion).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true')
    await page.getByRole('radio', { name: 'Light (Playful Lab)' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  test('theme radios: one Tab stop, arrow keys choose; the motion row is a ≥44 px target', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/settings', { waitUntil: 'networkidle' })
    const light = page.getByRole('radio', { name: 'Light (Playful Lab)' })
    const dark = page.getByRole('radio', { name: 'Dark (Night Lab)' })
    await light.focus()
    await page.keyboard.press('ArrowRight')
    await expect(dark).toBeFocused()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.keyboard.press('Tab') // leaves the group in one step
    const motion = page.getByRole('switch', { name: 'Reduce motion' })
    await expect(motion).toBeFocused()
    const box = await motion.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    await page.keyboard.press('Space')
    await expect(motion).toHaveAttribute('aria-checked', 'true')
  })

  test('"Mood guess" (on) and "Colour-blind friendly colours" (off) are stored on this device', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'networkidle' })
    const mood = page.getByRole('switch', { name: 'Mood guess' })
    const cvd = page.getByRole('switch', { name: 'Colour-blind friendly colours' })
    await expect(mood).toHaveAttribute('aria-checked', 'true')
    await expect(cvd).toHaveAttribute('aria-checked', 'false')
    await mood.click()
    await cvd.click()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('switch', { name: 'Mood guess' })).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByRole('switch', { name: 'Colour-blind friendly colours' })).toHaveAttribute('aria-checked', 'true')
  })

  test('with colour-blind friendly colours on, Color Clash uses blue, yellow, red and black on the light plate', async ({ page }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem('synapsetwin_prefs_v1', JSON.stringify({ version: 1, moodGuess: true, moodNoticeSeen: true, cvdSafe: true })),
    )
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/task/inhibition_control?schema=stroop', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Begin' }).click()
    const answers = page.getByRole('region', { name: 'Color Clash' }).getByRole('button')
    await expect(answers).toHaveText(['blue (1)', 'yellow (2)', 'red (3)', 'black (4)'])
    await expect(page.locator('[data-stroop-plate]')).toBeVisible()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  })
})
