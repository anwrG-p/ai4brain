import { test, expect, type Page, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { FULL_PAGE_CSS } from './testUtils'

/* The new-user flow (ticket 07): Welcome → the six-exercise baseline → Results (blur, Momo,
   consent, un-blur). This build has no VITE_GOOGLE_CLIENT_ID, so "See my results" opens straight on
   the consent choice (no sign-in step).

   Test hook: `?fast=1` (see src/features/flow/baseline.ts) shortens each exercise: fewer trials and
   short time limits. It needs mock tasks and a test build: playwright.config.ts builds with
   VITE_E2E=1 into dist-e2e; a normal build ignores the query. The exercises still run for real and
   record real events. Logic Web, Memory Gauntlet, Color Clash and Strategic Blueprint finish on
   their own once started (Tower needs its move prediction first); Perceptual Radar and Precision
   Archive wait for answers, which this spec gives with the keyboard. Welcome passes its query
   string on to /baseline.

   Screenshots go to $FLOW_SHOT_DIR when set, else to the test's output folder. */

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]

async function shot(page: Page, info: TestInfo, name: string) {
  const dir = process.env.FLOW_SHOT_DIR
  await page.screenshot({ path: dir ? path.join(dir, `${name}.png`) : info.outputPath(`${name}.png`), fullPage: true, style: FULL_PAGE_CSS })
}

async function noAxeViolations(page: Page, where: string) {
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations, where).toEqual([])
}

// Overflow and axe at each width; with a name, also a phone screenshot.
async function checkViewports(page: Page, where: string, info?: TestInfo, name?: string) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `overflow at ${vp.width}px (${where})`).toBe(false)
    await noAxeViolations(page, `${where} at ${vp.width}px`)
    if (info && name && vp.width === 375) await shot(page, info, `${name}-375`)
  }
  await page.setViewportSize(VIEWPORTS[0]!)
}

// Records every telemetry POST; answers like the server ({"accepted": n}).
async function recordPosts(page: Page) {
  const posts: { user_id: string }[][] = []
  await page.route('**/v1/telemetry/event', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '[]') as { user_id: string }[]
    posts.push(body)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accepted: body.length }) })
  })
  return posts
}

async function begin(page: Page, step: number, name: string) {
  await expect(page.getByText(`${step} of 6`)).toBeVisible()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await page.getByRole('button', { name: 'Begin' }).click()
}

const finish = (page: Page) => page.getByRole('button', { name: 'Continue' }).click({ timeout: 30_000 })

async function runBaseline(page: Page, info: TestInfo, theme: string) {
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page).toHaveURL(/\/baseline\?fast=1$/)

  await expect(page.getByRole('heading', { name: 'Logic Web' })).toBeVisible()
  await shot(page, info, `07-baseline-instruction-${theme}`)
  await checkViewports(page, `baseline instruction (${theme})`, info, `07-baseline-instruction-${theme}`)
  await begin(page, 1, 'Logic Web')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible({ timeout: 30_000 })
  await checkViewports(page, `baseline end card (${theme})`, info, `07-baseline-end-${theme}`)
  await finish(page)

  await begin(page, 2, 'Memory Gauntlet')
  await finish(page)

  await begin(page, 3, 'Color Clash')
  await finish(page)

  await begin(page, 4, 'Strategic Blueprint')
  const tower = page.getByRole('region', { name: 'Strategic Blueprint' })
  await tower.getByRole('spinbutton').fill('5')
  await tower.getByRole('button', { name: 'Start' }).click()
  await finish(page)

  await begin(page, 5, 'Perceptual Radar')
  await expect(page.getByRole('group', { name: 'Your answer' })).toBeVisible({ timeout: 10_000 })
  await page.keyboard.press('a')
  await page.keyboard.press('1')
  await finish(page)

  await begin(page, 6, 'Precision Archive')
  const cont = page.getByRole('button', { name: 'Continue' })
  for (let k = 0; k < 60 && !(await cont.isVisible()); k++) {
    await page.keyboard.press('1')
    await page.waitForTimeout(250)
  }
  await finish(page)
  await expect(page).toHaveURL(/\/results$/)
}

async function openConsent(page: Page, info: TestInfo, theme: string) {
  await page.getByRole('button', { name: 'See my results' }).click()
  const sheet = page.getByRole('dialog')
  // R4 and rule 14: no client id in this build, so no sign-in step and nothing Google-shaped.
  await expect(sheet.getByRole('heading', { name: 'Your choices' })).toBeFocused()
  // Consent per purpose (research #6): two equal switches, both off until chosen.
  for (const name of ['Save my answers to improve my training', "Let Loti use AI to reply when it's available"])
    await expect(sheet.getByRole('switch', { name })).toHaveAttribute('aria-checked', 'false')
  await expect(sheet.getByRole('button', { name: 'Continue as guest' })).toHaveCount(0)
  await expect(page.getByTestId('google-signin')).toHaveCount(0)
  await shot(page, info, `07-results-consent-${theme}`)
  await checkViewports(page, `consent (${theme})`, info, `07-results-consent-${theme}`)
  return sheet
}

async function expectBlurredResults(page: Page, info: TestInfo, theme: string) {
  await expect(page.getByRole('heading', { level: 1, name: 'Your results are ready' })).toBeVisible()
  await expect(page.locator('figure[data-blurred="true"]')).toBeVisible()
  await expect(page.getByRole('img', { name: /Momo/ })).toBeVisible()
  await expect(page.getByText('Good job! You finished all six.')).toBeVisible()
  await shot(page, info, `07-results-blurred-${theme}`)
  await checkViewports(page, `results blurred (${theme})`, info, `07-results-blurred-${theme}`)
}

test.describe('Flow: Welcome → Baseline → Results', () => {
  test.setTimeout(180_000)

  test('light: nothing is sent before consent; "Save my answers to improve my training" sends the held events with this user_id', async ({ page }, info) => {
    const posts = await recordPosts(page)
    await page.goto('/?fast=1', { waitUntil: 'networkidle' })
    await shot(page, info, '07-welcome-light')
    await runBaseline(page, info, 'light')

    await expectBlurredResults(page, info, 'light')
    expect(posts, 'no POST before consent').toHaveLength(0)

    const sheet = await openConsent(page, info, 'light')
    await sheet.getByRole('switch', { name: 'Save my answers to improve my training' }).click()
    expect(posts, 'a switch alone decides nothing').toHaveLength(0)
    await sheet.getByRole('button', { name: 'Continue' }).click()
    await expect.poll(() => posts.length).toBeGreaterThan(0)
    const uid = await page.evaluate(() => localStorage.getItem('aura_uid'))
    const events = posts.flat()
    expect(events.length).toBeGreaterThan(0)
    expect(new Set(events.map((e) => e.user_id))).toEqual(new Set([uid]))

    await expect(page.locator('figure[data-blurred="false"]')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Your results' })).toBeVisible()
    await shot(page, info, '07-results-clear-light')
    await checkViewports(page, 'results clear (light)', info, '07-results-clear-light')

    await page.getByRole('button', { name: 'Go to my space' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('dark: Continue with both switches off sends nothing and still shows the results', async ({ page }, info) => {
    const posts = await recordPosts(page)
    await page.goto('/?fast=1', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).click()
    await shot(page, info, '07-welcome-dark')
    await runBaseline(page, info, 'dark')

    await expectBlurredResults(page, info, 'dark')
    const sheet = await openConsent(page, info, 'dark')
    await sheet.getByRole('button', { name: 'Continue' }).click()

    await expect(page.locator('figure[data-blurred="false"]')).toBeVisible()
    await shot(page, info, '07-results-clear-dark')
    await checkViewports(page, 'results clear (dark)')
    await page.waitForTimeout(2500) // longer than the tracker's flush period
    expect(posts).toHaveLength(0)
    expect(await page.evaluate(() => localStorage.getItem('synapsetwin_telemetry_queue_v2'))).toBeNull()
  })
})
