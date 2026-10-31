import { expect, test } from '@playwright/test'

/* INT-1 item 14: a device with a saved session skips Welcome and the baseline, without Welcome ever
   showing. A MutationObserver installed before the app loads records whether its heading appeared. */

const SESSIONS = JSON.stringify({
  version: 1,
  sessions: [{ id: 's1', at: '2026-10-30T10:00:00.000Z', inputs: { MST_LDI: { score: 50, trials: 30 } } }],
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript((sessions) => {
    localStorage.setItem('synapsetwin_sessions_v1', sessions)
    const w = window as unknown as { sawWelcome: boolean }
    w.sawWelcome = false
    new MutationObserver(() => {
      if ([...document.querySelectorAll('h1')].some((h) => h.textContent?.includes("Hi, I'm Loti."))) w.sawWelcome = true
    }).observe(document, { childList: true, subtree: true, characterData: true })
  }, SESSIONS)
})

for (const url of ['/', '/baseline']) {
  test(`a returning device opening ${url} lands on Home; Welcome never flashes`, async ({ page }) => {
    await page.goto(url, { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(/\/dashboard$/)
    expect(await page.evaluate(() => (window as unknown as { sawWelcome: boolean }).sawWelcome)).toBe(false)
  })
}

test('/baseline?again=1 is the retake: the baseline runs', async ({ page }) => {
  await page.goto('/baseline?again=1', { waitUntil: 'networkidle' })
  await expect(page).toHaveURL(/\/baseline\?again=1$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Logic Web' })).toBeVisible()
})
