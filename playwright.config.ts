import { defineConfig, devices } from '@playwright/test';
import { availableParallelism } from 'node:os';

const BASE_URL = 'http://localhost:4200';
const isCi = !!process.env['CI'];

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: './e2e/test-results',
  fullyParallel: true,
  // A third of the logical cores (8 of 24): more browsers at once only wait on each other and on
  // `ng serve`, and the suite gets slower (measured in chore/e2e-speed).
  workers: Math.max(1, Math.round(availableParallelism() / 3)),
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'es-CO',
    trace: 'retain-on-failure',
    // Screenshots never catch a dialog or sheet halfway through its animation.
    contextOptions: { reducedMotion: 'reduce' },
    // The mocks answer every request; a service worker would answer some before them.
    serviceWorkers: 'block',
  },
  // Uses the locally installed Google Chrome; no Playwright browser downloads. Light and dark on
  // mobile and desktop are the screenshots' (`playwright.screenshots.config.ts`, spec §13.4).
  projects: [
    // Every behavior test, once: the theme does not change it, and the tests where it does set it
    // themselves.
    {
      name: 'mobile',
      grepInvert: /@desktop-only/,
      use: { ...devices['Pixel 7'], channel: 'chrome', colorScheme: 'light' },
    },
    // What wide screens do differently: the rail, list and detail side by side, dialogs and the
    // keyboard (`@desktop`), and what only they have (`@desktop-only`).
    {
      name: 'desktop',
      grep: /@desktop/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome', colorScheme: 'light' },
    },
    // The invitation email opens in Safari on iPhone (spec §3.3): that flow and the login also run
    // on WebKit, and so does what makes the app feel native (spec §13.4). Needs
    // `npx playwright install webkit` once (CLAUDE.md).
    {
      name: 'iphone-webkit',
      testMatch: ['**/invitation.e2e.ts', '**/auth-screens.e2e.ts', '**/native-feel.e2e.ts'],
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
