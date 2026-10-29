import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Tests run against the production build served by `vite preview` — the same
 * thing perf/measure.mjs measures — never against the dev server, whose
 * unbundled modules and React dev checks behave differently.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Same emulation as the Lighthouse mobile preset used for every series in
      // perf/runs/ (Moto G Power: 412x823, DPR 1.75), so a layout bug a test
      // finds here is the layout Lighthouse measured.
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 412, height: 823 },
        deviceScaleFactor: 1.75,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],

  webServer: {
    // CI builds in its own step (.github/workflows/ci.yml), so a build failure
    // is reported as one; here the server only has to serve dist/.
    command: process.env.CI
      ? `npm run preview -- --port ${PORT} --strictPort`
      : `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    // Locally, reuse a preview you already have running for perf work.
    // In CI, always build fresh.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
