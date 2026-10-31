import type { Page } from '@playwright/test'

/* Judge mode (spec R6): the evaluator, inspector, stage and persona controls render only after
   `?judge=1`, which the app remembers for the tab. These reload the current page with the flag. */
async function withJudgeFlag(page: Page, value: '1' | '0') {
  const url = new URL(page.url())
  url.searchParams.set('judge', value)
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
}

export async function openJudgeMode(page: Page) {
  await withJudgeFlag(page, '1')
}

export async function closeJudgeMode(page: Page) {
  await withJudgeFlag(page, '0')
}
