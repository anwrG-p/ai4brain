import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { openJudgeMode, closeJudgeMode } from './testUtils'

const SCREENSHOT_DIR = path.resolve(process.cwd(), '../docs/ui/screenshots')

test.describe('Page 06: Dashboard (/dashboard) Hero Visual QA & A11y', () => {
  test('passes axe-core accessibility, 375/768/1440px responsive layout, and 3-to-10 dimension checks', async ({
    page,
  }) => {
    // 1. Desktop 1440px Light (Playful Lab — Calibrated 7 Dims)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading', {
        name: /Good morning|Your evolving cognitive twin/i,
      }),
    ).toBeVisible()

    const hasOverflow1440 = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(hasOverflow1440).toBe(false)

    const axeLight = await new AxeBuilder({ page }).analyze()
    expect(axeLight.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-dashboard-1440.png'),
      fullPage: true,
    })

    // 2. Desktop 1440px — Low-Confidence Hatched (Salma)
    await openJudgeMode(page)
    const salmaBtn = page.getByRole('button', { name: /Low-Conf Hatched \(Salma/i })
    await salmaBtn.click()
    await expect(salmaBtn).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(350)

    const axeHatched = await new AxeBuilder({ page }).analyze()
    expect(axeHatched.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-dashboard-10dims-hatched-1440.png'),
      fullPage: true,
    })

    // 3. Dark Mode (Night Lab) at 1440px + axe-core check
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(350)
    const axeDark = await new AxeBuilder({ page }).analyze()
    expect(axeDark.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-dashboard-dark-1440.png'),
      fullPage: true,
    })

    // Switch back to Light & 7 Dims Calibrated for Tablet & Mobile captures
    await page.getByRole('button', { name: /Light \(Playful Lab\)/i }).first().click()
    await closeJudgeMode(page)
    await page
      .getByRole('button', { name: /Calibrated Twin \(Youssef/i })
      .click()
    await page.waitForTimeout(350)

    // 4. Tablet 768px
    await page.setViewportSize({ width: 768, height: 1024 })
    const hasOverflow768 = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(hasOverflow768).toBe(false)
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-dashboard-768.png'),
      fullPage: true,
    })

    // 5. Mobile 375px
    await page.setViewportSize({ width: 375, height: 812 })
    const hasOverflow375 = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(hasOverflow375).toBe(false)
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '06-dashboard-375.png'),
      fullPage: true,
    })
  })
})
