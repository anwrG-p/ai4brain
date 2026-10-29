import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { openJudgeMode, closeJudgeMode } from './testUtils'

const SCREENSHOT_DIR = path.resolve(process.cwd(), '../docs/ui/screenshots')

test.describe('Page 02: Onboarding & Consent (/onboarding) Visual QA & A11y', () => {
  test('passes axe-core accessibility, 375/768/1440px responsive layout, and 3-step consent verification', async ({
    page,
  }) => {
    // 1. Desktop 1440px Light (Playful Lab — Step 1 Wizard)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/onboarding', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading', {
        name: /Configure your cognitive twin on your own terms/i,
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
      path: path.join(SCREENSHOT_DIR, '02-onboarding-1440.png'),
      fullPage: true,
    })

    // 2. Desktop 1440px — All 3 Steps Expanded
    await openJudgeMode(page)
    await page.getByRole('button', { name: 'View All 3 Steps' }).click()
    await expect(
      page.getByRole('heading', {
        name: /Granular Telemetry Consent & Mandatory Non-Biometric Lock/i,
      }),
    ).toBeVisible()

    const axeAllSteps = await new AxeBuilder({ page }).analyze()
    expect(axeAllSteps.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-onboarding-all-steps-1440.png'),
      fullPage: true,
    })

    // 3. Dark Mode (Night Lab) at 1440px + axe-core check
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)
    const axeDark = await new AxeBuilder({ page }).analyze()
    expect(axeDark.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-onboarding-dark-1440.png'),
      fullPage: true,
    })

    // Switch back to Light & 7 Dims Default for Tablet & Mobile captures
    await page.getByRole('button', { name: /Light \(Playful Lab\)/i }).first().click()
    await closeJudgeMode(page)
    await page.waitForTimeout(300)

    // 4. Tablet 768px
    await page.setViewportSize({ width: 768, height: 1024 })
    const hasOverflow768 = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    )
    expect(hasOverflow768).toBe(false)
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-onboarding-768.png'),
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
      path: path.join(SCREENSHOT_DIR, '02-onboarding-375.png'),
      fullPage: true,
    })
  })
})
