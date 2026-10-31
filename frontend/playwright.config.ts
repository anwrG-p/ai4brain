import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    reducedMotion: 'reduce',
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  // A test build of its own (VITE_E2E=1, into dist/e2e): it turns on the baseline's ?fast=1 hook
  // (src/features/flow/baseline.ts), which a normal build ignores. A server you already run on 4173
  // is reused locally; it must be such a build for e2e/flow.spec.ts.
  webServer: {
    command: 'npx vite build --outDir dist/e2e && npx vite preview --outDir dist/e2e --port 4173 --host 127.0.0.1',
    env: { VITE_E2E: '1' },
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // includes the build
  },
})
