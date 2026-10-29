import type { Page } from '@playwright/test'

/**
 * Helper to ensure page DOM is loaded and ready.
 * Note: Judge console drawer was removed; dimension presets and evaluators
 * are now rendered directly and accessibly in AppShell footer and TaskRunner.
 */
export async function openJudgeMode(page: Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(() => {
    document.querySelectorAll('details[data-technical-drawer]').forEach((el) => {
      ;(el as HTMLDetailsElement).open = true
    })
  })
}

export async function closeJudgeMode(page: Page) {
  await page.waitForLoadState('domcontentloaded')
}
