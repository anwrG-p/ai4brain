import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openJudgeMode, closeJudgeMode } from './testUtils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/ui/screenshots')

test.describe('Page 11: Goals & Habit Contracts (/goals) Visual QA & A11y', () => {
  test('passes axe-core accessibility, 375/768/1440px responsive layout, streak protection, and Bayesian ETA tuning', async ({
    page,
  }) => {
    // 1. Desktop 1440px Light (Playful Lab) — Baseline Active State
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/goals', { waitUntil: 'networkidle' })

    await expect(
      page.getByRole('heading', {
        name: /Goals & Habit Contracts Studio/i,
        level: 1,
      }),
    ).toBeVisible()

    // Verify zero horizontal overflow at 1440px
    const overflow1440 = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      )
    })
    expect(overflow1440).toBe(false)

    // Run axe-core on 1440px Light
    const axeLight = await new AxeBuilder({ page }).analyze()
    expect(axeLight.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '11-goals-1440.png'),
      fullPage: true,
    })

    // 2. Engage Proactive Rest Day Streak Preservation
    const scheduleRestBtn = page
      .getByRole('button', { name: /Schedule Rest Day \(Zero Penalty\)/i })
      .first()
    await scheduleRestBtn.click()

    await expect(
      page.getByText(/Rest Day Active · Streak Safe/i).first(),
    ).toBeVisible()
    await expect(
      page.getByText(/Recovery preserves synaptic plasticity/i),
    ).toBeVisible()

    const axeRestProtected = await new AxeBuilder({ page }).analyze()
    expect(axeRestProtected.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '11-goals-rest-protected-1440.png'),
      fullPage: true,
    })

    // 3. Switch to Night Lab (Dark Theme) + Expand Accessible Table
    await openJudgeMode(page)
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)
    await page
      .getByRole('button', { name: /Show Contracts Table/i })
      .click()

    await expect(
      page.getByRole('table', {
        name: /Habit Contracts and Bayesian ETAs Table/i,
      }),
    ).toBeVisible()

    const axeDark = await new AxeBuilder({ page }).analyze()
    expect(axeDark.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '11-goals-dark-10dims-1440.png'),
      fullPage: true,
    })

    // Restore Light + 7 Dims for Tablet & Mobile checks
    await page.getByRole('button', { name: /Light \(Playful Lab\)/i }).first().click()
    await closeJudgeMode(page)
    await page.waitForTimeout(300)

    // 4. Tablet 768px
    await page.setViewportSize({ width: 768, height: 1024 })
    const overflow768 = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      )
    })
    expect(overflow768).toBe(false)

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '11-goals-768.png'),
      fullPage: true,
    })

    // 5. Mobile 375px
    await page.setViewportSize({ width: 375, height: 812 })
    const overflow375 = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      )
    })
    expect(overflow375).toBe(false)

    const axeMobile = await new AxeBuilder({ page }).analyze()
    expect(axeMobile.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '11-goals-375.png'),
      fullPage: true,
    })
  })
})
