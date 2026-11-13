import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the PRODUCTION build (service worker included)
// with the deterministic test AI provider. Weather is mocked per test.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4175',
    ...devices['Pixel 7'],
    locale: 'en-GB',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite build && AI_PROVIDER=mock PORT=4175 AI_RATE_LIMIT=500 npx tsx server/start.ts',
    url: 'http://localhost:4175/api/health',
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
