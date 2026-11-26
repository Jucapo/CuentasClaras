import { Page, Route } from '@playwright/test';
import { environment } from '../../src/environments/environment.development';

/** Base URL of the Supabase instance the dev server talks to. */
export const SUPABASE_URL = environment.supabase.url;

/** Fake signed-in user. */
export const E2E_USER = {
  id: '00000000-0000-4000-8000-0000000000e2',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'e2e@example.com',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};

/** Space returned by the mocked API once the user has one. */
export const E2E_SPACE = { id: '00000000-0000-4000-8000-00000000005e', name: 'Hogar' };

/** Aborts every Supabase request, so smoke tests never depend on a running backend. */
export async function blockSupabase(page: Page): Promise<void> {
  await page.route(`${SUPABASE_URL}/**`, (route) => route.abort());
}

/** Stores a valid-looking session before the app starts, as supabase-js would after signing in. */
export async function seedSession(page: Page): Promise<void> {
  const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: 'e2e-access-token',
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: E2E_USER,
  };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    storageKey,
    JSON.stringify(session),
  ] as const);
}

/** Mocked data API: the user starts with or without a space; create_space gives them one. */
export interface DataApiMock {
  /** Body of the last create_space call, if any. */
  readonly createdSpace: () => Record<string, unknown> | null;
}

/** Answers the REST calls of the space and user settings services. Register after blockSupabase. */
export async function mockDataApi(page: Page, { withSpace = false } = {}): Promise<DataApiMock> {
  let hasSpace = withSpace;
  let createdSpace: Record<string, unknown> | null = null;
  const userSettings = {
    user_id: E2E_USER.id,
    theme: 'system',
    number_format: 'comma_dot',
    show_decimals: true,
    home_screen: 'categories',
    last_space_id: null as string | null,
  };

  await page.route(`${SUPABASE_URL}/rest/v1/space_members?*`, (route) =>
    route.fulfill({ json: hasSpace ? [membershipRow()] : [] }),
  );
  await page.route(`${SUPABASE_URL}/rest/v1/user_settings?*`, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      Object.assign(userSettings, request.postDataJSON());
      return route.fulfill({ json: [userSettings] });
    }
    return route.fulfill({ json: userSettings });
  });
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/create_space`, (route) => {
    createdSpace = route.request().postDataJSON();
    hasSpace = true;
    return route.fulfill({ json: E2E_SPACE.id });
  });

  return { createdSpace: () => createdSpace };
}

function membershipRow() {
  return {
    role: 'owner',
    joined_at: '2026-01-01T00:00:00Z',
    spaces: {
      ...E2E_SPACE,
      space_settings: {
        space_id: E2E_SPACE.id,
        main_currency: 'COP',
        month_start_day: 1,
        week_start: 'monday',
        budgets_enabled: true,
        default_period: 'month',
        onboarding_step: 1,
        onboarding_completed_at: null,
      },
    },
  };
}
