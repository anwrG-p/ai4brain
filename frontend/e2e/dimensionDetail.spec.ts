import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openJudgeMode, closeJudgeMode } from './testUtils'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/ui/screenshots')

test.describe('Page 07: Dimension Detail (/dimensions/:dimId) Visual QA & A11y', () => {
  test('passes axe-core accessibility, 375/768/1440px responsive layout, hatched (<60%) state, and 3-to-10 dimension checks', async ({
    page,
  }) => {
    // 1. Desktop 1440px Light (Playful Lab) — Working Memory (Solid Band)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dimensions/working_memory', { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading', { name: /WM · Working Memory/i, level: 1 }),
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
      path: path.join(SCREENSHOT_DIR, '07-dimension-detail-1440.png'),
      fullPage: true,
    })

    // 2. Switch to 2 · ⚡ Hatched (<60% CI) (Episodic Pattern Separation)
    await openJudgeMode(page)
    await page
      .getByRole('button', { name: /2 · ⚡ Hatched \(<60% CI\)/i })
      .click()
    await expect(
      page.getByRole('heading', {
        name: /EP · Episodic Pattern Separation/i,
        level: 1,
      }),
    ).toBeVisible()
    await expect(
      page.getByText(/Diagonal SVG Hatching Active/i),
    ).toBeVisible()

    const axeHatched10 = await new AxeBuilder({ page }).analyze()
    expect(axeHatched10.violations).toEqual([])

    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIR,
        '07-dimension-detail-hatched-10dims-1440.png',
      ),
      fullPage: true,
    })

    // 3. Switch to Night Lab (Dark Theme) + Visuospatial Planning & Gf
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await page.waitForTimeout(300)
    await page
      .getByRole('button', { name: /1 · Converged Solid/i })
      .click()
    await page
      .getByRole('button', { name: /VP · Visuospatial Planning/i })
      .click()
    await page.waitForTimeout(300)

    const axeDark = await new AxeBuilder({ page }).analyze()
    expect(axeDark.violations).toEqual([])

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '07-dimension-detail-dark-1440.png'),
      fullPage: true,
    })

    // Restore Light + 7 Dims + WM for Tablet & Mobile checks
    await page.getByRole('button', { name: /Light \(Playful Lab\)/i }).first().click()
    await closeJudgeMode(page)
    await page
      .getByRole('button', { name: /WM · Working Memory/i })
      .click()
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
      path: path.join(SCREENSHOT_DIR, '07-dimension-detail-768.png'),
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
      path: path.join(SCREENSHOT_DIR, '07-dimension-detail-375.png'),
      fullPage: true,
    })
  })
})
