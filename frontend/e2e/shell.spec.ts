import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'
import { closeJudgeMode, openJudgeMode } from './testUtils'

// Screenshots go to SHOTS_DIR when set, else to the test's own output folder (never docs/).
const shot = (name: string) => path.join(process.env.SHOTS_DIR ?? test.info().outputPath(), name)

const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

const setTheme = async (page: Page, theme: 'light' | 'dark') => {
  const toDark = page.getByRole('button', { name: 'Switch to Dark (Night Lab)' })
  if (theme === 'dark' && (await toDark.count())) await toDark.click()
  if (theme === 'light' && !(await toDark.count())) await page.getByRole('button', { name: 'Switch to Light (Playful Lab)' }).click()
}

test.describe('App shell (ticket 09a)', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [375, 768, 1440]) {
      test(`shell at ${width}px, ${theme}: 4 nav items, axe clean, no overflow`, async ({ page }) => {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
        await page.goto('/train', { waitUntil: 'networkidle' })
        await setTheme(page, theme)

        const nav = page.getByRole('navigation', { name: width >= 1024 ? 'Main' : 'Tabs' })
        await expect(nav).toBeVisible()
        await expect(nav.getByRole('link')).toHaveText(['Home', 'Train', 'Loti', 'You'])
        await expect(page.getByTestId('page-progress-badge')).toHaveCount(0)
        await expect(page.getByRole('region', { name: 'Judge tools' })).toHaveCount(0)

        const body = (await page.locator('body').innerText()) ?? ''
        expect(body).not.toMatch(/v1\/|QUEST|JSON|SAT-JEPA/)

        const axe = await new AxeBuilder({ page }).analyze()
        expect(axe.violations).toEqual([])
        expect(await noOverflow(page)).toBe(true)

        await page.goto('/dashboard', { waitUntil: 'networkidle' })
        await setTheme(page, theme) // a full load starts in the default theme
        await page.screenshot({ path: shot(`shell-${width}-${theme}.png`) })
      })
    }
  }

  test('/ shows none of the technical clutter, and keeps its minimal chrome', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1, name: "Hi, I'm Loti." })).toBeVisible()
    await expect(page.getByRole('navigation')).toHaveCount(0)
    expect(await page.locator('body').innerText()).not.toMatch(/v1\/|QUEST|JSON|SAT-JEPA/)
  })

  test('judge controls: absent without ?judge=1, present with it, remembered for the tab, off with ?judge=0', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/task/working_memory', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 2, name: 'Memory Gauntlet' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Evaluator controls' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Simulate Tab-Blur Pause/ })).toHaveCount(0)

    await openJudgeMode(page)
    const tools = page.getByRole('complementary', { name: 'Evaluator controls' })
    await expect(tools).toBeVisible()
    await expect(tools.getByRole('group', { name: 'Task runner stage switcher' })).toBeVisible()
    await expect(tools.getByRole('group', { name: 'Cognitive dimension preset' })).toBeVisible()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])

    // Remembered: a plain in-app URL keeps judge mode on.
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    await expect(page.getByRole('region', { name: 'Judge tools' })).toBeVisible()
    await page.screenshot({ path: shot('judge-tools-1440.png'), fullPage: true })

    await closeJudgeMode(page)
    await expect(page.getByRole('region', { name: 'Judge tools' })).toHaveCount(0)
  })

  for (const [from, to] of [
    ['/onboarding', '/'],
    ['/assessment', '/train'],
    ['/plan', '/train'],
    ['/goals', '/dashboard'],
    ['/brain-twin', '/dashboard'],
    ['/design-system', '/dashboard'],
    ['/dimensions/working_memory', '/you'],
    ['/auth', '/'],
  ] as const) {
    test(`${from} redirects to ${to}`, async ({ page }) => {
      await page.goto(from, { waitUntil: 'networkidle' })
      await expect(page).toHaveURL(new RegExp(`${to === '/' ? '/$' : to}$`))
    })
  }

  test('an unknown route is a plain page with one way home; axe clean in both themes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/no-such-page', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1, name: "This page isn't here." })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go home' })).toBeVisible()
    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme)
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
      expect(await noOverflow(page)).toBe(true)
    }
  })
})
