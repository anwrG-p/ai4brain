import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import path from 'node:path'

/* INT-1 item 13: every exercise's instruction screen explains how to play, and stays within one
   phone screen (375 x 667) with "More about this" closed. Axe clean in light and dark. */

// Screenshots go to SHOTS_DIR when set, else to the test's own output folder (never docs/).
const shot = (name: string) => path.join(process.env.SHOTS_DIR ?? test.info().outputPath(), name)

const EXERCISES = [
  ['relational', 'visuospatial_planning_gf', 'Logic Web'],
  ['n_back', 'working_memory', 'Memory Gauntlet'],
  ['stroop', 'inhibition_control', 'Color Clash'],
  ['tower', 'visuospatial_planning_gf', 'Strategic Blueprint'],
  ['ufov', 'attention_networks', 'Perceptual Radar'],
  ['mst', 'episodic_pattern_separation', 'Precision Archive'],
  ['matrix', 'visuospatial_planning_gf', 'Pattern Puzzle'],
  ['mental_rotation', 'visuospatial_planning_gf', 'Shape Turn'],
  ['stop_signal', 'inhibition_control', 'Stop Light'],
  ['pal', 'episodic_pattern_separation', 'Pair Finder'],
  ['flanker', 'inhibition_control', 'Arrow Focus'],
] as const

test('the baseline opens on Logic Web’s instruction screen, also within one phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/baseline', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 2, name: 'Logic Web' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(667)
})

for (const [schema, dim, name] of EXERCISES) {
  test(`${name}: how to play fits one phone screen with More closed; axe clean in light and dark`, async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.addInitScript((t) => localStorage.setItem('synapsetwin_theme_v1', t), theme)
      for (const [width, height] of [[375, 667], [1440, 900]] as const) {
        await page.setViewportSize({ width, height })
        await page.goto(`/task/${dim}?schema=${schema}`, { waitUntil: 'networkidle' })
        await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
        await expect(page.getByRole('list', { name: 'How to play' }).getByRole('listitem')).not.toHaveCount(0)
        await expect(page.locator('details')).not.toHaveAttribute('open', '')
        if (width === 375) {
          expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height)
          const begin = await page.getByRole('button', { name: 'Begin' }).boundingBox()
          expect(begin!.y + begin!.height).toBeLessThanOrEqual(height)
        }
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
        await page.screenshot({ path: shot(`howto-${schema}-${theme}-${width}.png`) })
      }
    }
  })
}
