import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openJudgeMode, closeJudgeMode } from './testUtils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/ui/screenshots')

test.describe('Page 03: Assessment Hub (/assessment) Visual QA & A11y', () => {
  test('passes axe-core accessibility, 375/768/1440px responsive layout, table toggle, and 3-to-10 dimension checks', async ({
    page,
  }) => {
    // 1. Desktop 1440px Light (Playful Lab — Calibrated Queue)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/assessment', { waitUntil: 'networkidle' })

    await expect(
      page.getByRole('heading', {
        name: /Calibrate your cognitive twin—2-minute adaptive micro-tasks/i,
      }),
    ).toBeVisible()

    const a11yLight = await new AxeBuilder({ page }).analyze()
    expect(a11yLight.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-assessment-hub-1440.png'),
      fullPage: true,
    })

    // 2. Hatched Priority Queue + Open Payload JSON + Table Toggle
    await openJudgeMode(page)
    await page
      .getByRole('button', { name: /Hatched Priority Queue \(Salma/i })
      .click()
    await page.getByRole('button', { name: /Inspect Payload JSON/i }).click()
    await page
      .getByRole('button', { name: /View Task Queue as Table/i })
      .click()

    await expect(
      page.getByRole('table', {
        name: /Assessment Hub cognitive task queue table/i,
      }),
    ).toBeVisible()

    const a11yTable = await new AxeBuilder({ page }).analyze()
    expect(a11yTable.violations).toEqual([])

    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIR,
        '03-assessment-hub-10dims-table-1440.png',
      ),
      fullPage: true,
    })

    // 3. Dark Theme (Night Lab) @ 1440px (Switch back to Cards)
    await page
      .getByRole('button', { name: /View Modules as Cards/i })
      .click()
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)

    const a11yDark = await new AxeBuilder({ page }).analyze()
    expect(a11yDark.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-assessment-hub-dark-1440.png'),
      fullPage: true,
    })

    // Reset back to Light + Calibrated Queue for Tablet & Mobile checks
    await page.getByRole('button', { name: /Light \(Playful Lab\)/i }).first().click()
    await closeJudgeMode(page)
    await page
      .getByRole('button', { name: /Calibrated Queue \(Youssef/i })
      .click()
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
      path: path.join(SCREENSHOT_DIR, '03-assessment-hub-768.png'),
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
      path: path.join(SCREENSHOT_DIR, '03-assessment-hub-375.png'),
      fullPage: true,
    })
  })
})
