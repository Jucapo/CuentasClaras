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
    // Screenshots never catch a dialog or sheet halfway through its animation.
    contextOptions: { reducedMotion: 'reduce' },
  },
  // Uses the locally installed Google Chrome; no Playwright browser downloads.
  // Spec §13.4: every screen is checked on mobile and desktop, in light and dark.
  projects: [
    {
      name: 'mobile-light',
      use: { ...devices['Pixel 7'], channel: 'chrome', colorScheme: 'light' },
    },
    { name: 'mobile-dark', use: { ...devices['Pixel 7'], channel: 'chrome', colorScheme: 'dark' } },
    {
      name: 'desktop-light',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', colorScheme: 'light' },
    },
    {
      name: 'desktop-dark',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', colorScheme: 'dark' },
    },
    // The invitation email opens in Safari on iPhone (spec §3.3): that flow and the login also run
    // on WebKit. Needs `npx playwright install webkit` once (CLAUDE.md).
    {
      name: 'iphone-webkit',
      testMatch: ['**/invitation.e2e.ts', '**/auth-screens.e2e.ts'],
      use: { ...devices['iPhone 15'], colorScheme: 'light' },
    },
  ],
  webServer: {
    command: 'npm start',
    url: BASE_URL,
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
