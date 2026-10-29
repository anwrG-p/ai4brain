import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openJudgeMode, closeJudgeMode } from './testUtils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/ui/screenshots')

test.describe('Page 12: AI Collaboration Score (/collaboration) Visual QA & A11y', () => {
  test('passes axe-core accessibility, 375/768/1440px responsive layout, simulator actions, and dynamic weights', async ({
    page,
  }) => {
    // 1. Desktop 1440px Light (Playful Lab) — Baseline State
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/collaboration', { waitUntil: 'networkidle' })

    await expect(
      page.getByRole('heading', {
        name: /AI Collaboration Score Deep-Dive/i,
        level: 1,
      }),
    ).toBeVisible()

    await expect(
      page.getByRole('heading', {
        name: /Signature #5: AI Collaboration Score/i,
        level: 2,
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
      path: path.join(SCREENSHOT_DIR, '12-collaboration-1440.png'),
      fullPage: true,
    })

    // 2. Trigger Action Simulator: Audit + Autonomy + Honor Rest Day
    await page
      .getByRole('button', { name: /Audit "Why This\?" Trail/i })
      .click()
    await page
      .getByRole('button', { name: /Self-Select Practice Drill/i })
      .click()
    await page
      .getByRole('button', { name: /Honor Rest Day \/ Non-Bio Lock/i })
      .click()

    await expect(page.getByText(/Simulated Action Active/i)).toBeVisible()
    await expect(
      page.getByText(/Responsible pacing detected!/i),
    ).toBeVisible()

    const axeSimulated = await new AxeBuilder({ page }).analyze()
    expect(axeSimulated.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '12-collaboration-simulated-1440.png'),
      fullPage: true,
    })

    // 3. Switch to Night Lab (Dark Theme) + Dynamic Weights + Tables Expanded
    await openJudgeMode(page)
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)
    await page
      .getByRole('button', { name: /Dynamic Archetype Weights/i })
      .click()
    await page
      .getByRole('button', { name: /Show Accessible Score Table/i })
      .click()
    await page
      .getByRole('button', { name: /Inspect Longitudinal Table Region/i })
      .click()

    await expect(
      page.getByRole('table', {
        name: /Collaboration Score Sub-dimension Breakdown/i,
      }),
    ).toBeVisible()

    await expect(
      page.getByRole('table', {
        name: /Longitudinal Collaboration Score History/i,
      }),
    ).toBeVisible()

    const axeDark = await new AxeBuilder({ page }).analyze()
    expect(axeDark.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '12-collaboration-dark-1440.png'),
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
      path: path.join(SCREENSHOT_DIR, '12-collaboration-768.png'),
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
      path: path.join(SCREENSHOT_DIR, '12-collaboration-375.png'),
      fullPage: true,
    })
  })
})
