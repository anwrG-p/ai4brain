import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openJudgeMode, closeJudgeMode } from './testUtils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/ui/screenshots')

test.describe('Page 09: AI Coach (/coach) Hero Visual QA & A11y', () => {
  test('passes axe-core accessibility, 375/768/1440px responsive layout, deterministic fallback, and 3-to-10 dimension checks', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/coach', { waitUntil: 'networkidle' })

    await expect(
      page.getByRole('heading', {
        name: /Explainable AI Coach & Cognitive Strategy Studio/i,
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
      path: path.join(SCREENSHOT_DIR, '09-ai-coach-1440.png'),
      fullPage: true,
    })

    // 2. Deterministic Rule Fallback + Test Guardrail Interception
    await openJudgeMode(page)
    await page
      .getByRole('button', { name: /2 · ⚙ Rule Fallback/i })
      .click()
    await page
      .getByRole('button', { name: /Test Guardrail Interception/i })
      .click()

    await expect(
      page.getByText(/Intercepted \(3 Rules\)/i),
    ).toBeVisible()

    const a11yFallback10 = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(a11yFallback10.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '09-ai-coach-fallback-10dims-1440.png'),
      fullPage: true,
    })

    // 3. Switch to Rest-First Pacing + Dark Mode (Night Lab) at 1440px
    await page
      .getByRole('button', { name: /Showing Guardrail Interception Demo/i })
      .click()
    await page
      .getByRole('button', { name: /3 · ☾ Rest-First Pacing/i })
      .click()
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)

    const a11yDark = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(a11yDark.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '09-ai-coach-dark-1440.png'),
      fullPage: true,
    })

    // Restore Light Mode + 7 Dims Default + Live Grounded
    await page.getByRole('button', { name: /Light \(Playful Lab\)/i }).first().click()
    await closeJudgeMode(page)
    await page
      .getByRole('button', { name: /1 · Live Grounded/i })
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
      path: path.join(SCREENSHOT_DIR, '09-ai-coach-768.png'),
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
      path: path.join(SCREENSHOT_DIR, '09-ai-coach-375.png'),
      fullPage: true,
    })
  })
})
