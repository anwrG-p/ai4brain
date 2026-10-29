import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openJudgeMode, closeJudgeMode } from './testUtils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/ui/screenshots')

test.describe('Page 13: Privacy Center & Audit Log (/privacy) Visual QA & A11y', () => {
  test('passes axe-core accessibility, 375/768/1440px responsive layout, consent toggles, live inspector, and purge modal', async ({
    page,
  }) => {
    // 1. Desktop 1440px Light (Playful Lab) — Baseline State
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/privacy', { waitUntil: 'networkidle' })

    await expect(
      page.getByRole('heading', {
        name: /Privacy Center & Sovereign Audit Log/i,
        level: 1,
      }),
    ).toBeVisible()

    // Verify Hardware Lock Banner is prominently displayed
    await expect(
      page.getByText(/Non-Biometric Hardware Lock Active/i),
    ).toBeVisible()
    await expect(
      page.getByText(/Physically Disconnected/i),
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
      path: path.join(SCREENSHOT_DIR, '13-privacy-1440.png'),
      fullPage: true,
    })

    // 2. Reject All Optional Consent Action
    await page
      .getByRole('button', {
        name: /Reject All Optional/i,
      })
      .click()

    await expect(
      page.getByText(/Revoked/i).first(),
    ).toBeVisible()

    const axeRejected = await new AxeBuilder({ page }).analyze()
    expect(axeRejected.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '13-privacy-rejected-optional-1440.png'),
      fullPage: true,
    })

    // 3. Switch to Night Lab (Dark Theme) + Open Purge Modal
    await openJudgeMode(page)
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)

    await page
      .getByRole('button', {
        name: /Purge All Data/i,
      })
      .click()

    await expect(
      page.getByRole('heading', {
        name: /Confirm Irrevocable Data Purge/i,
      }),
    ).toBeVisible()

    const axeModal = await new AxeBuilder({ page }).analyze()
    expect(axeModal.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '13-privacy-dark-purge-modal-1440.png'),
      fullPage: true,
    })

    // Cancel modal to restore page view
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    // Restore Light + 7 Dims
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
      path: path.join(SCREENSHOT_DIR, '13-privacy-768.png'),
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
      path: path.join(SCREENSHOT_DIR, '13-privacy-375.png'),
      fullPage: true,
    })
  })
})
