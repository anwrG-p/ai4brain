import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openJudgeMode, closeJudgeMode } from './testUtils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/ui/screenshots')

test.describe('Page 10: Plan & Adaptive Exercises (/plan) Visual QA & A11y', () => {
  test('passes axe-core accessibility, 375/768/1440px responsive layout, rest-first pacing, and 3-to-10 dimension checks', async ({
    page,
  }) => {
    // 1. Desktop 1440px Light (Playful Lab) — Thursday Active Plan
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/plan', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading', {
        name: /Adaptive Training Plan & Staircase Curriculum/i,
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
      path: path.join(SCREENSHOT_DIR, '10-plan-1440.png'),
      fullPage: true,
    })

    // 2. Switch to 2 · ☾ Rest-First Pacing (Wednesday Recovery Day)
    await page
      .getByRole('button', { name: /2 · ☾ Rest-First Pacing/i })
      .click()
    await expect(
      page.getByText(/Scheduled Recovery & Memory Consolidation Day/i),
    ).toBeVisible()
    await expect(
      page.getByText(/Streak Protected \(Zero Penalty\)/i),
    ).toBeVisible()

    const axeRestPacing = await new AxeBuilder({ page }).analyze()
    expect(axeRestPacing.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '10-plan-rest-pacing-1440.png'),
      fullPage: true,
    })

    // 3. Switch to Night Lab (Dark Theme) + Lvl 5 Staircase
    await openJudgeMode(page)
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)
    await page
      .getByRole('button', { name: /1 · Active Plan/i })
      .click()
    await page
      .getByRole('button', { name: 'Lvl 5', exact: true })
      .click()

    await expect(
      page.getByText(/Level 5 · Peak Attentional Stretch/i),
    ).toBeVisible()

    const axeDark = await new AxeBuilder({ page }).analyze()
    expect(axeDark.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '10-plan-dark-10dims-1440.png'),
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
      path: path.join(SCREENSHOT_DIR, '10-plan-768.png'),
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
      path: path.join(SCREENSHOT_DIR, '10-plan-375.png'),
      fullPage: true,
    })
  })
})
