import { defineConfig } from '@playwright/test'

// The e2e server has its own port, so it never reuses a normal `npm run preview` (4173).
const PORT = 4179

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    reducedMotion: 'reduce',
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  // A test build of its own (VITE_E2E=1) in the sibling folder dist-e2e, never in dist, so a deploy
  // of dist cannot ship it. It turns on the baseline's ?fast=1 hook (src/features/flow/baseline.ts),
  // which a normal build ignores.
  webServer: {
    command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort --host 127.0.0.1`,
    env: { VITE_E2E: '1' },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // includes the build
  },
})
