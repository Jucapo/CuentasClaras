import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * Screenshots of the key screens (`npm run e2e:screenshots`): every UI change is checked on mobile
 * and desktop, in light and dark (spec §13.4). Only `e2e/*.shots.ts`; behavior is in `npm run e2e`.
 */
export default defineConfig({
  ...base,
  testMatch: '**/*.shots.ts',
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
  ],
});
