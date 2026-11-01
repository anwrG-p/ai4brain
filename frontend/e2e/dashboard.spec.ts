import { test, expect, type Page, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'node:path'
import { FULL_PAGE_CSS } from './testUtils'

/* Home (/dashboard, ticket 08). The session store is seeded before the app loads (localStorage
   'synapsetwin_sessions_v1', the same shape the baseline writes), with 0, 1, 4 and 6 sessions a
   week apart. For each: axe in light and dark and no horizontal overflow at 375, 768 and 1440 px;
   "Further explore my training" is opened and checked too (with 6 sessions it holds the heatmap).

   Screenshots go to $DASH_SHOT_DIR when set, else to the test's output folder. */

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]
const DAY = 86_400_000

/** Session k: each pillar has its own level and slow growth (+2 a week); Deep Memory grows +5 a
    week, so from the 4th session it is the one "Real improvement" (+15, RCI >= 1.96). */
function inputs(k: number) {
  const at = (base: number, step = 2) => ({ score: base + step * k, trials: 40 })
  return {
    OSPAN: at(58),
    OTS_Planning: at(52),
    FluidMatrices: at(60),
    ANT_Conflict: at(44),
    DCCS_SwitchCost: at(50),
    ErrorRecovery: at(48),
    SST_SSRT: { ...at(36), proxy: true },
    OTS_Execution: at(42),
    MST_LDI: at(40, 5),
    UFOV_SOA: at(64),
    ANT_Orienting: at(70),
  }
}

/** n sessions a week apart, the last yesterday; rising scores. */
function sessions(n: number) {
  return Array.from({ length: n }, (_, k) => ({
    id: `seed-${k}`,
    at: new Date(Date.now() - ((n - 1 - k) * 7 + 1) * DAY).toISOString(),
    inputs: inputs(k),
  }))
}

async function seed(page: Page, n: number) {
  const value = JSON.stringify({ version: 1, sessions: sessions(n) })
  await page.addInitScript((v) => window.localStorage.setItem('synapsetwin_sessions_v1', v), value)
}

async function shot(page: Page, info: TestInfo, name: string) {
  const dir = process.env.DASH_SHOT_DIR
  await page.screenshot({ path: dir ? path.join(dir, `${name}.png`) : info.outputPath(`${name}.png`), fullPage: true, style: FULL_PAGE_CSS })
}

async function checkViewports(page: Page, where: string, info: TestInfo, name: string) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp)
    // The charts redraw at the new width on the next ResizeObserver callback.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))))
    await page.waitForTimeout(100)
    await expect(page.getByRole('heading', { level: 1, name: /^Hi, / })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `overflow at ${vp.width}px (${where})`).toBe(false)
    // body clips x overflow (tokens.css), so the check above cannot see clipped content: also no
    // element of the page may reach past the viewport, except inside a deliberate scroller.
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter((el) => !el.closest('.overflow-x-auto, .sr-only') && el.getBoundingClientRect().right > window.innerWidth + 1)
        .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}`.slice(0, 80)),
    )
    expect(clipped, `content past the viewport at ${vp.width}px (${where})`).toEqual([])
    const axe = await new AxeBuilder({ page }).analyze()
    expect(axe.violations, `axe at ${vp.width}px (${where})`).toEqual([])
    if (vp.width !== 768) await shot(page, info, `${name}-${vp.width}`)
  }
  await page.setViewportSize(VIEWPORTS[0]!)
}

/** A Deep Memory goal of +10, set when Deep Memory was at `base` (stored as the goals slice does). */
async function seedGoal(page: Page, base: number) {
  const value = JSON.stringify({ version: 1, year: new Date().getFullYear(), goals: { memory: 10 }, bases: { memory: base } })
  await page.addInitScript((v) => window.localStorage.setItem('synapsetwin_goals_v1', v), value)
}

async function checkHome(page: Page, info: TestInfo, n: number) {
  await seed(page, n)
  await page.goto('/dashboard', { waitUntil: 'networkidle' })
  await expect(page.getByRole('button', { name: "Start today's session" })).toBeVisible()
  for (const theme of ['light', 'dark'] as const) {
    if (theme === 'dark') {
      await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
      await page.waitForTimeout(300)
    }
    await checkViewports(page, `${n} sessions, ${theme}`, info, `08-home-${n}-${theme}`)
  }
  // Back to light, then the open "Further explore" state in both themes.
  await page.getByRole('button', { name: /Light \(Playful Lab\)/i }).first().click()
  const explore = page.getByRole('button', { name: 'Further explore my training' })
  await explore.click()
  await expect(explore).toHaveAttribute('aria-expanded', 'true')
  for (const theme of ['light', 'dark'] as const) {
    if (theme === 'dark') await page.getByRole('button', { name: /Dark \(Night Lab\)/i }).first().click()
    await checkViewports(page, `${n} sessions, explore open, ${theme}`, info, `08-home-${n}-explore-${theme}`)
  }
}

test.describe('Page 06: Home (/dashboard)', () => {
  test('no sessions: radar with "—", Loti\'s first-session line; axe and overflow in light and dark', async ({ page }, info) => {
    await checkHome(page, info, 0)
    await expect(page.getByText('Your first session fills in your five skills.')).toBeVisible()
    await expect(page.getByText('Finish one session to see your curve.')).toBeVisible()
  })

  test('one session: radar filled, the curve shows the real point and no projection; axe and overflow in light and dark', async ({ page }, info) => {
    await checkHome(page, info, 1)
    await expect(page.locator('[data-session]')).toHaveCount(1)
    await expect(page.locator('[data-line="keep"]')).toHaveCount(0)
  })

  test('four sessions: the real curve and one dashed projection, a two-item legend; axe and overflow in light and dark', async ({ page }, info) => {
    await seedGoal(page, 55) // Deep Memory's latest score in the 4-session seed
    await checkHome(page, info, 4)
    await expect(page.getByRole('list', { name: 'Line styles' }).getByRole('listitem')).toHaveText(['Your score', 'If you keep training'])
    // The goal shows against its own pillar (explore is open by now), never on the overall curve.
    await expect(page.getByRole('list', { name: 'Your goals this year' })).toHaveText('Deep Memory 55 → goal 65')
    await expect(page.locator('[data-goal]')).toHaveCount(0)
    await expect(page.locator('[data-line="keep"]')).toHaveCount(1)
  })

  test('six sessions: the heatmap and "When you train" behind "Further explore"; axe and overflow in light and dark', async ({ page }, info) => {
    await checkHome(page, info, 6)
    await expect(page.getByRole('grid', { name: 'Past results by week' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Score scale' })).toBeVisible()
    const when = page.getByRole('grid', { name: 'When you train' })
    await expect(when).toBeVisible()
    await expect(when.getByRole('rowheader')).toHaveText(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    // One tab stop: arrows move inside the grid.
    await when.getByRole('gridcell').first().focus()
    await page.keyboard.press('ArrowDown')
    await expect(when.getByRole('gridcell').nth(3)).toBeFocused()
    // The weekly goal sits in the Goals block as one plain line.
    await expect(page.getByTestId('weekly-goal')).toHaveText(/^\d+ (of 3 )?this week( · week kept)?$/)
  })

  test('mood guess opt-in: Home has no notice and Momo is no control; after opting in under Settings, Momo shows the picked mood', async ({ page }) => {
    await seed(page, 2)
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    await expect(page.getByRole('note')).toHaveCount(0)
    await expect(page.getByText(/Momo guesses your mood/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Momo/ })).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'Momo' })).toBeVisible() // still and neutral
    await expect(page.locator('[data-page="home"]')).toHaveAttribute('data-mood', 'calm')
    // Opt in where the notice is, correct the guess there, and Home follows.
    await page.getByRole('link', { name: 'You' }).first().click()
    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('switch', { name: 'Mood guess' }).click()
    await page.getByRole('button', { name: 'Change' }).click()
    await page.getByRole('radio', { name: 'Tired' }).click()
    await page.getByRole('link', { name: 'Home' }).first().click()
    await expect(page.getByRole('img', { name: 'Momo looks tired' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Momo/ })).toHaveCount(0)
  })

  test('"View as table" shows the 5 rows with ranges; "Start today\'s session" trains the weakest pillar', async ({ page }) => {
    await seed(page, 4)
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'View as table' }).click()
    const rows = page.getByRole('table', { name: 'Your five skills, out of 100' }).getByRole('row')
    await expect(rows).toHaveCount(5)
    await expect(rows.first()).toContainText(/\d+ · likely \d+–\d+/)
    await page.getByRole('button', { name: "Start today's session" }).click()
    await expect(page).toHaveURL(/\/train\?pillar=(focus|agility|impulse|memory|visual)$/)
  })

  test('no sessions: "Start today\'s session" opens the baseline', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: "Start today's session" }).click()
    await expect(page).toHaveURL(/\/baseline$/)
  })
})
