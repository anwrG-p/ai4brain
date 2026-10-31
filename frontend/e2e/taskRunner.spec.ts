import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openJudgeMode, closeJudgeMode } from './testUtils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/ui/screenshots')

test.describe('Page 04: Task Runner (/task/:dimId) Hero Visual QA & A11y', () => {
  test('passes axe-core accessibility, 375/768/1440px responsive layout, Tab-Blur Auto-Pause, and 3-to-10 dimension checks', async ({
    page,
  }) => {
    // 1. Desktop 1440px Light (Playful Lab — Active Timed Trial + Live Telemetry Stream)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/task/episodic_pattern_separation', {
      waitUntil: 'networkidle',
    })

    await expect(
      page.getByRole('heading', {
        name: /Mnemonic Similarity Task/i,
      }),
    ).toBeVisible()

    // Instruction screen (jsPsych-style): consumer name, keycaps, one Begin.
    await expect(page.getByRole('heading', { name: 'Precision Archive' })).toBeVisible()
    const a11yIntro = await new AxeBuilder({ page }).analyze()
    expect(a11yIntro.violations).toEqual([])

    // Begin → 500 ms fixation → the trial area with its progress dots.
    await page.getByRole('button', { name: 'Begin' }).click()
    await expect(page.getByRole('region', { name: 'Precision Archive' })).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Progress' })).toBeVisible()

    const a11yRunning = await new AxeBuilder({ page }).analyze()
    expect(a11yRunning.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-task-runner-1440.png'),
      fullPage: true,
    })

    // 2. Test Tab-Blur Auto-Pause + Post-Block Completion Summary
    await openJudgeMode(page)
    await page
      .getByRole('button', { name: /Simulate Tab-Blur Pause/i })
      .click()

    await expect(
      page.getByRole('heading', {
        name: /Trial Auto-Paused — Focus Left Window/i,
      }),
    ).toBeVisible()

    const a11yPaused = await new AxeBuilder({ page }).analyze()
    expect(a11yPaused.violations).toEqual([])

    // Switch to Post-Block Summary (Mascot Celebrate + WhyThisPanel)
    await page
      .getByRole('button', { name: /4 · ✓ Block Summary/i })
      .click()

    const a11ySummary = await new AxeBuilder({ page }).analyze()
    expect(a11ySummary.violations).toEqual([])

    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIR,
        '04-task-runner-completed-10dims-1440.png',
      ),
      fullPage: true,
    })

    // 3. Dark Theme (Night Lab) @ 1440px (Switch back to Active Trial on Stroop IC)
    await page.getByRole('button', { name: /■ IC/i }).click()
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)

    const a11yDark = await new AxeBuilder({ page }).analyze()
    expect(a11yDark.violations).toEqual([])

    // Dark trial area: the Stroop word in its ink (stroop-red is its own token pair).
    await page.getByRole('button', { name: 'Begin' }).click()
    await expect(page.getByRole('region', { name: 'Color Clash' })).toBeVisible()
    const a11yDarkTrial = await new AxeBuilder({ page }).analyze()
    expect(a11yDarkTrial.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-task-runner-dark-1440.png'),
      fullPage: true,
    })

    // Reset back to Light + 7 Dims + EP Active Trial for Tablet & Mobile checks
    await page.getByRole('button', { name: /Light \(Playful Lab\)/i }).first().click()
    await closeJudgeMode(page)
    await page.getByRole('button', { name: /⬢ EP/i }).click()
    await page.waitForTimeout(300)

    // 4. Tablet 768px
    await page.setViewportSize({ width: 768, height: 1024 })
    const overflow768 = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(overflow768).toBe(true)

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-task-runner-768.png'),
      fullPage: true,
    })

    // 5. Mobile 375px
    await page.setViewportSize({ width: 375, height: 812 })
    const overflow375 = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(overflow375).toBe(true)

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-task-runner-375.png'),
      fullPage: true,
    })
  })
})
