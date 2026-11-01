import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { openJudgeMode, FULL_PAGE_CSS } from './testUtils'

// Screenshots go to SHOTS_DIR when set, else to the test's own output folder (never docs/).
const shot = (name: string) => path.join(process.env.SHOTS_DIR ?? test.info().outputPath(), name)
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
const axeClean = async (page: Page) => expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

test.describe('Task runner (/task/:dimId), reached from Train', () => {
  test('instruction, trial, pause and result: consumer copy only, axe clean, no overflow at 1440/768/375', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/task/episodic_pattern_separation', { waitUntil: 'networkidle' })

    // The consumer name only; the research name is gone (U5).
    await expect(page.getByRole('heading', { level: 2, name: 'Precision Archive' })).toBeVisible()
    await expect(page.getByText(/Mnemonic Similarity Task/i)).toHaveCount(0)
    await expect(page.getByRole('complementary', { name: 'Evaluator controls' })).toHaveCount(0)
    await axeClean(page)

    await page.getByRole('button', { name: 'Begin' }).click()
    await expect(page.getByRole('region', { name: 'Precision Archive' })).toBeVisible()
    await axeClean(page)

    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { level: 1, name: 'Paused' })).toBeVisible()
    await axeClean(page)
    await page.getByRole('button', { name: 'Resume' }).click()
    await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible()

    for (const [w, h] of [[768, 1024], [375, 812]] as const) {
      await page.setViewportSize({ width: w, height: h })
      expect(await noOverflow(page)).toBe(true)
    }
  })

  test('judge mode: Simulate Tab-Blur pauses, the summary is one line and "Back to Train"; dark is axe clean', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/task/episodic_pattern_separation', { waitUntil: 'networkidle' })
    await openJudgeMode(page)
    await page.getByRole('button', { name: 'Begin' }).click()
    await expect(page.getByRole('region', { name: 'Precision Archive' })).toBeVisible()

    await page.getByRole('button', { name: 'Simulate Tab-Blur Pause' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Paused' })).toBeVisible()

    await page.getByRole('button', { name: 'Block Summary' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Precision Archive' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to Train' })).toBeVisible()
    await axeClean(page)

    await page.getByRole('button', { name: /Dark \(Night Lab\)/ }).click()
    await axeClean(page)
    await page.screenshot({ path: shot('task-summary-dark-1440.png'), fullPage: true, style: FULL_PAGE_CSS })

    await page.getByRole('button', { name: 'Back to Train' }).click()
    await expect(page).toHaveURL(/\/train$/)
  })
})
