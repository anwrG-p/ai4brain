import type { Page } from '@playwright/test'

/* For full-page screenshots only (Playwright's `style` option, removed after the shot). The phone
   tabs are fixed and the header sticky: stitched into one tall image they would land mid-page, so
   both go back into the flow (the tabs then close the page, where a phone shows them at the end). */
export const FULL_PAGE_CSS = `
  nav[aria-label="Tabs"] { position: static !important; }
  header { position: static !important; }
`

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
