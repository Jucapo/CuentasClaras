import { defineConfig, devices } from '@playwright/test';

const BASE_URL = 'http://localhost:4200';

/**
 * End-to-end flows against the real local stack (`npm run e2e:local`), not mocks: Supabase in
 * Docker (`npm run db:start`), the Edge Functions (`npm run functions:serve`) and Mailpit for the
 * emails. They run on iPhone WebKit, where the invitation email opens (spec §3.3).
 */
export default defineConfig({
  testDir: './e2e/local',
  testMatch: '**/*.local.ts',
  outputDir: './e2e/test-results/local',
  // One flow at a time: they share the local database and Mailpit.
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'es-CO',
    trace: 'retain-on-failure',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [{ name: 'local-iphone-webkit', use: { ...devices['iPhone 15'] } }],
  webServer: {
    command: 'npm start',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
