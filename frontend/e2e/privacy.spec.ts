import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { FULL_PAGE_CSS } from './testUtils'

// SHOTS_DIR sends the screenshots to a scratch folder instead of the docs.
const SCREENSHOT_DIR = process.env.SHOTS_DIR ?? path.resolve(process.cwd(), '../docs/ui/screenshots')

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]

const NOT_CHOSEN = 'Not chosen yet. Your answers stay on this device.'

async function setTheme(page: Page, theme: 'light' | 'dark') {
  // The store is the theme's source of truth; the header toggle belongs to 09a.
  await page.evaluate((t) => (window as any).__appStore.getState().setTheme(t), theme)
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
}

async function checkViewports(page: Page, theme: 'light' | 'dark') {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp)
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `Horizontal overflow at ${vp.width}px (${theme})`).toBe(false)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations, `axe at ${vp.width}px (${theme})`).toEqual([])
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `13-privacy-${theme}-${vp.width}.png`), fullPage: true, style: FULL_PAGE_CSS })
  }
}

test.describe('Page 13: Privacy (/privacy)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('consent line, one sentence, Delete my data; ≤60 words; axe light and dark; no overflow at 375/768/1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/privacy', { waitUntil: 'networkidle' })
    await expect(page.getByTestId('consent-line')).toHaveText(NOT_CHOSEN)
    await expect(page.getByText('We record answer timing and accuracy only. No camera, no microphone.')).toBeVisible()
    await expect(page.getByText(/JSON|receipt|never collected|SHA256/i)).toHaveCount(0)
    // The whole page fits above the fold, so every word in <main> counts.
    const words = await page.evaluate(() => (document.querySelector('main')?.innerText ?? '').split(/\s+/).filter(Boolean).length)
    expect(words).toBeLessThanOrEqual(60)
    await checkViewports(page, 'light')
    await setTheme(page, 'dark')
    await checkViewports(page, 'dark')
  })

  test('Choose shows two equal choices; the line follows the choice', async ({ page }) => {
    await page.goto('/privacy', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Choose' }).click()
    const save = page.getByRole('button', { name: 'Save my answers' })
    const keep = page.getByRole('button', { name: 'Keep them on this device only' })
    expect(await save.getAttribute('class')).toBe(await keep.getAttribute('class'))
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await keep.click()
    await expect(page.getByTestId('consent-line')).toHaveText('Your answers are kept on this device only.')
    await page.getByRole('button', { name: 'Change' }).click()
    await page.getByRole('button', { name: 'Save my answers' }).click()
    await expect(page.getByTestId('consent-line')).toHaveText('Your answers are saved.')
  })

  test('Export my data downloads one JSON file with every device key', async ({ page }) => {
    await page.goto('/privacy', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Choose' }).click()
    await page.getByRole('button', { name: 'Keep them on this device only' }).click()
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export my data' }).click()])
    expect(download.suggestedFilename()).toMatch(/^my-data-\d{4}-\d{2}-\d{2}\.json$/)
    const file = await download.path()
    const data = JSON.parse(await readFile(file, 'utf8'))
    expect(Object.keys(data.localStorage).sort()).toEqual(
      ['aura_uid', 'synapsetwin_consent_v1', 'synapsetwin_goals_v1', 'synapsetwin_sessions_v1', 'synapsetwin_telemetry_queue_v2'],
    )
    expect(data.localStorage.synapsetwin_consent_v1).toBe('denied')
    // Loti's talk comes from its store (INT-1), not a raw sessionStorage key.
    expect(data.lotiTalk).toEqual({ turns: [], current: null })
    expect(data.app).toHaveProperty('userProfile')
    expect(data.app).toHaveProperty('theme')
  })

  test('Delete my data asks first, then deletes; keeps the theme; axe on the dialog in both themes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/privacy', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Delete my data' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete your data?' })
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13-privacy-delete-light-375.png') })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    await setTheme(page, 'dark')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: 'Delete my data' }).click()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13-privacy-delete-dark-1440.png') })
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('Deleted from this device.')).toBeVisible()
    await expect(page.getByTestId('consent-line')).toHaveText(NOT_CHOSEN)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark') // a preference, not data
  })
})
