import { test, expect, type Page, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'

/* Welcome (/). Screenshots go to $FLOW_SHOT_DIR when set, else to the test's output folder (never
   into the repo). This build has no VITE_GOOGLE_CLIENT_ID, so there is no sign-in link (rule 14). */

const VIEWPORTS = [
  { width: 1440, height: 900, label: '1440' },
  { width: 768, height: 1024, label: '768' },
  { width: 375, height: 812, label: '375' },
]

async function shot(page: Page, info: TestInfo, name: string) {
  const dir = process.env.FLOW_SHOT_DIR
  await page.screenshot({ path: dir ? path.join(dir, `${name}.png`) : info.outputPath(`${name}.png`), fullPage: true })
}

async function checkViewports(page: Page, info: TestInfo, theme: 'light' | 'dark', motion: string) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await expect(page.getByRole('heading', { level: 1, name: "Hi, I'm Loti." })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `Horizontal overflow at ${vp.width}px (${theme}, ${motion})`).toBe(false)
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations, `axe at ${vp.width}px (${theme}, ${motion})`).toEqual([])
    await shot(page, info, `01-welcome-${motion}-${theme}-${vp.label}`)
  }
}

// Every animation that ends has ended (the entrance, the words, Start); Loti's breath and blink loop
// for ever and are left out.
async function animationsSettled(page: Page) {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity)
      .every((a) => a.playState === 'finished'),
  )
}

async function checkThemes(page: Page, info: TestInfo, motion: string) {
  await expect(page.getByRole('img', { name: /Loti/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'I already have an account' })).toHaveCount(0)
  await checkViewports(page, info, 'light', motion)

  await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
  await page.waitForTimeout(300)
  await checkViewports(page, info, 'dark', motion)
}

test.describe('Page 01: Welcome (/), reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('Loti and one Start button; axe light and dark; no overflow at 375/768/1440', async ({ page }, info) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await checkThemes(page, info, 'still')
  })
})

test.describe('Page 01: Welcome (/), motion on', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('after the entrance settles: axe light and dark; no overflow at 375/768/1440', async ({ page }, info) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await animationsSettled(page)
    await checkThemes(page, info, 'motion')
  })
})
