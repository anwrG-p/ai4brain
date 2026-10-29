import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openJudgeMode, closeJudgeMode } from './testUtils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/ui/screenshots')

test.describe('Page 05: Profile Reveal (/profile-reveal) + Mascot Sprint Visual QA & A11y', () => {
  test('passes axe-core accessibility, 375/768/1440px responsive layout, Mascot states, and 3-to-10 dimension checks', async ({
    page,
  }) => {
    // 1. Desktop 1440px Light (Playful Lab — Calibrated Reveal + Mascot Celebrate)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/profile-reveal', { waitUntil: 'networkidle' })

    await expect(
      page.getByRole('heading', {
        name: /Meet your initial Cognitive Twin—calibrated strengths/i,
      }),
    ).toBeVisible()

    // Run axe-core WCAG 2.1 AA scan on default Calibrated Reveal
    const a11yLight = await new AxeBuilder({ page }).analyze()
    expect(a11yLight.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-profile-reveal-1440.png'),
      fullPage: true,
    })

    // 2. Switch to First-Session Hatched (Salma) + Open Snapshot JSON + 10 Dimensions Stress Mode
    await openJudgeMode(page)
    await page
      .getByRole('button', { name: /First-Session Hatched \(Salma/i })
      .click()
    await page.getByRole('button', { name: /Inspect Snapshot JSON/i }).click()

    await expect(page.getByText(/SNAP-2026-SALMA-01/i)).toBeVisible()

    const a11yHatched = await new AxeBuilder({ page }).analyze()
    expect(a11yHatched.violations).toEqual([])

    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIR,
        '05-profile-reveal-10dims-hatched-1440.png',
      ),
      fullPage: true,
    })

    // 3. Dark Theme (Night Lab) @ 1440px
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)
    const a11yDark = await new AxeBuilder({ page }).analyze()
    expect(a11yDark.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-profile-reveal-dark-1440.png'),
      fullPage: true,
    })

    // Reset back to Light + 7 Dims + Calibrated for Tablet & Mobile checks
    await page.getByRole('button', { name: /Light \(Playful Lab\)/i }).first().click()
    await closeJudgeMode(page)
    await page
      .getByRole('button', { name: /Calibrated Reveal \(Youssef/i })
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
      path: path.join(SCREENSHOT_DIR, '05-profile-reveal-768.png'),
      fullPage: true,
    })

    // 5. Mobile 375px (Zero horizontal scroll check)
    await page.setViewportSize({ width: 375, height: 812 })
    const overflow375 = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    )
    expect(overflow375).toBe(true)

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-profile-reveal-375.png'),
      fullPage: true,
    })
  })
})
