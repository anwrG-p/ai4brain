import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

/* Ticket F-B: Stop Light, Pair Finder and Arrow Focus. Each is reached from Train under its pillar,
   runs its block (pause on Escape included), is axe clean in light and dark with no overflow at
   375 / 768 / 1440, and plays through to the end card and the result line. Page clock: the blocks
   are long (200, 20+ and 96 trials), so the test jumps time instead of waiting it out. */

const shot = (name: string) => path.join(process.env.SHOTS_DIR ?? test.info().outputPath(), name)
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
const axeClean = async (page: Page) => expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
const setTheme = (page: Page, theme: 'light' | 'dark') => page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)

const EXERCISES = [
  { schema: 'stop_signal', name: 'Stop Light', pillar: 'Impulse Control' },
  { schema: 'pal', name: 'Pair Finder', pillar: 'Deep Memory' },
  { schema: 'flanker', name: 'Arrow Focus', pillar: 'Mental Agility' },
] as const

async function openFromTrain(page: Page, name: string, pillar: string) {
  await page.goto('/train', { waitUntil: 'networkidle' })
  const section = page.getByRole('region', { name: pillar })
  await section.getByRole('link', { name: `Start ${name}` }).click()
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
}

const endCard = (page: Page) => page.getByText('Nice work')

// The arrow exercises: jump past the cross, press ←, until the end card (a press during a cross is
// ignored and the next jump catches the trial).
async function playArrows(page: Page, schema: string) {
  let signShot = false
  for (let k = 0; k < 1200 && !(await endCard(page).isVisible()); k++) {
    await page.clock.runFor(600) // past the cross
    await page.clock.runFor(400) // 400 ms into the arrow: a stop sign with a shorter delay is up
    // Stop Light: one picture of a stop sign (shape and word), then answer as usual.
    // The sign stays mounted, hidden; it counts once it is visible.
    if (!signShot && (await page.locator('[data-stop-sign]').isVisible())) {
      await expect(page.getByText('Stop', { exact: true })).toBeVisible()
      await page.screenshot({ path: shot(`${schema}-stop-sign-375.png`) })
      signShot = true
    }
    await page.keyboard.press('ArrowLeft')
  }
  if (schema === 'stop_signal') expect(signShot).toBe(true)
}

// Pair Finder, played right: note each studied shape's box, then tap that box when it is asked for.
async function playPairs(page: Page) {
  const boxOf = new Map<string, string>()
  const prompt = page.getByText('Which box held this shape?')
  for (let k = 0; k < 600 && !(await endCard(page).isVisible()); k++) {
    if (await prompt.isVisible()) {
      const pattern = await page.locator('section [data-pattern]').first().getAttribute('data-pattern')
      const box = boxOf.get(pattern!)
      expect(box, `studied shape ${pattern}`).toBeDefined()
      await page.getByRole('button', { name: `Box ${Number(box) + 1}` }).click()
      continue
    }
    const open = page.locator('[data-open]')
    if (await open.count()) {
      const pattern = await open.locator('[data-pattern]').getAttribute('data-pattern')
      boxOf.set(pattern!, (await open.getAttribute('data-box'))!)
    }
    await page.clock.runFor(500)
  }
}

for (const { schema, name, pillar } of EXERCISES) {
  test.describe(name, () => {
    test('from Train: how to play, the running block (axe light and dark, no overflow at 1440/768/375), Escape pauses', async ({ page }) => {
      await page.clock.install() // time flows; runFor jumps it
      await page.setViewportSize({ width: 1440, height: 900 })
      await openFromTrain(page, name, pillar)
      await expect(page).toHaveURL(new RegExp(`schema=${schema}`))
      await expect(page.getByText(`Trains: ${pillar}`)).toBeVisible()
      await axeClean(page)

      await page.getByRole('button', { name: 'Begin' }).click()
      await expect(page.getByRole('region', { name })).toBeVisible()
      await expect(page.getByRole('progressbar', { name: 'Progress' })).toBeVisible()
      for (const [w, h] of [[1440, 900], [768, 1024], [375, 667]] as const) {
        await page.setViewportSize({ width: w, height: h })
        for (const theme of ['light', 'dark'] as const) {
          await setTheme(page, theme)
          await axeClean(page)
          expect(await noOverflow(page)).toBe(true)
          await page.screenshot({ path: shot(`${schema}-trial-${theme}-${w}.png`) })
        }
      }
      // The answer controls are large tap targets: at least 56 px tall for the arrows, 64 px boxes.
      await setTheme(page, 'light')
      if (schema === 'pal') await page.clock.runFor(30_000) // past the study, to the boxes
      const first = page.getByRole('region', { name }).getByRole('button').first()
      const box = await first.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(schema === 'pal' ? 64 : 56)

      await page.keyboard.press('Escape')
      await expect(page.getByRole('heading', { level: 1, name: 'Paused' })).toBeVisible()
      await axeClean(page)
      await page.getByRole('button', { name: 'Resume' }).click()
      await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible()
    })

    test('plays through to the end card and the result line', async ({ page }) => {
      test.setTimeout(240_000)
      await page.clock.install()
      await page.setViewportSize({ width: 375, height: 667 })
      await openFromTrain(page, name, pillar)
      await page.getByRole('button', { name: 'Begin' }).click()
      await expect(page.getByRole('region', { name })).toBeVisible()
      if (schema === 'pal') await playPairs(page)
      else await playArrows(page, schema)
      await expect(endCard(page)).toBeVisible()
      await page.getByRole('button', { name: 'Continue' }).click()
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
      await expect(page.getByText(/Accuracy \d+% · \d+ ms\. Added to your progress\./)).toBeVisible()
      if (schema === 'pal') await expect(page.getByText(/Accuracy 100%/)).toBeVisible() // played right
      await axeClean(page)
      await page.screenshot({ path: shot(`${schema}-result-375.png`) })
    })
  })
}
