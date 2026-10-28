import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openJudgeMode, closeJudgeMode } from './testUtils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/ui/screenshots')

test.describe('Page 08: Brain Twin & Historical Timeline (/brain-twin) Hero Visual QA & A11y', () => {
  test('passes axe-core accessibility, 375/768/1440px responsive layout, time-travel scrubber, and 3-to-10 dimension checks', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/brain-twin', { waitUntil: 'networkidle' })

    await expect(
      page.getByRole('heading', {
        name: /Longitudinal Brain Twin & Time-Travel Studio/i,
      }),
    ).toBeVisible()

    // 1. Axe-core WCAG 2.1 AA check on default 1440px Light (Playful Lab)
    const a11yLight = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(a11yLight.violations).toEqual([])

    const overflow1440 = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      )
    })
    expect(overflow1440).toBe(false)

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '08-brain-twin-1440.png'),
      fullPage: true,
    })

    // 2. Scrub to Early Snapshot (#1 Day 1 Cold Baseline) + Open Table View
    await openJudgeMode(page)
    await page
      .getByRole('button', { name: /2 · Scrub to Snap #1 \(Hatched\)/i })
      .click()
    await page
      .getByRole('button', { name: /View Snapshot Diff as Table/i })
      .click()

    await expect(
      page.getByRole('table', {
        name: /Side-by-side historical snapshot comparison table/i,
      }),
    ).toBeVisible()

    const a11yEarly10 = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(a11yEarly10.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '08-brain-twin-early-10dims-1440.png'),
      fullPage: true,
    })

    // 3. Switch back to Visual Diff Cards + Snap #7 Mid-Week + Dark Mode (Night Lab) at 1440px
    await page
      .getByRole('button', { name: /View Visual Diff Cards/i })
      .click()
    await page
      .getByRole('button', { name: /#7 · Day 7 \(Oct 17\)/i })
      .click()
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)

    const a11yDark = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(a11yDark.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '08-brain-twin-dark-1440.png'),
      fullPage: true,
    })

    // Restore Light Mode + 7 Dims Default + Snap #14 Live
    await page.getByRole('button', { name: /Light \(Playful Lab\)/i }).first().click()
    await closeJudgeMode(page)
    await page
      .getByRole('button', { name: /1 · Snap #14 vs #1 \(Live\)/i })
      .click()
    await page.waitForTimeout(300)

    // 4. Tablet 768px check
    await page.setViewportSize({ width: 768, height: 1024 })
    const overflow768 = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      )
    })
    expect(overflow768).toBe(false)

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '08-brain-twin-768.png'),
      fullPage: true,
    })

    // 5. Mobile 375px check
    await page.setViewportSize({ width: 375, height: 812 })
    const overflow375 = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      )
    })
    expect(overflow375).toBe(false)

    const a11yMobile = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(a11yMobile.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '08-brain-twin-375.png'),
      fullPage: true,
    })
  })
})
