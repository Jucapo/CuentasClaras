import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://localhost:4200';
const isCi = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: './e2e/test-results',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'es-CO',
    trace: 'retain-on-failure',
  },
  // Uses the locally installed Google Chrome; no Playwright browser downloads.
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  webServer: {
    command: 'npm start',
    url: BASE_URL,
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
