import { Page, Route } from '@playwright/test';
import { environment } from '../../src/environments/environment.development';
import { CatalogFixture } from './catalog-fixture';

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
export const E2E_SPACE = {
  id: '00000000-0000-4000-8000-00000000005e',
  name: 'Hogar',
  icon: 'home',
  color: 'green',
};

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

type Row = Record<string, unknown>;

/** A write the app sent to a mocked table. */
export interface RecordedWrite {
  readonly method: 'POST' | 'PATCH' | 'DELETE';
  readonly table: string;
  readonly body: unknown;
  readonly query: string;
}

/** Mocked data API: the user starts with or without a space; create_space gives them one. */
export interface DataApiMock {
  /** Body of the last create_space call, if any. */
  readonly createdSpace: () => Record<string, unknown> | null;
  /** Writes to the catalog tables, in order. */
  readonly writes: () => readonly RecordedWrite[];
  /** Bodies of the calls to an RPC, in order. */
  readonly rpcCalls: (name: string) => readonly unknown[];
}

const ACCOUNT_GROUPS: Readonly<Record<string, string>> = {
  cash: 'accounts',
  bank: 'accounts',
  wallet: 'accounts',
  savings: 'savings',
  credit_card: 'debts',
  loan: 'debts',
  simple_debt: 'debts',
  receivable: 'receivables',
  asset: 'assets',
};

/** Answers the REST calls of the app. Register after blockSupabase. */
export async function mockDataApi(
  page: Page,
  { withSpace = false, catalog }: { withSpace?: boolean; catalog?: CatalogFixture } = {},
): Promise<DataApiMock> {
  let hasSpace = withSpace;
  let createdSpace: Record<string, unknown> | null = null;
  let defaultAccountId: string | null = catalog?.defaultAccountId ?? null;
  const writes: RecordedWrite[] = [];
  const rpcCalls = new Map<string, unknown[]>();
  const tables: Record<string, Row[]> = {
    accounts: structuredClone(catalog?.accounts ?? []) as Row[],
    categories: structuredClone(catalog?.categories ?? []) as Row[],
    tags: structuredClone(catalog?.tags ?? []) as Row[],
    category_default_tags: structuredClone(catalog?.defaultTags ?? []) as Row[],
  };
  const userSettings = {
    user_id: E2E_USER.id,
    theme: 'system',
    number_format: 'comma_dot',
    show_decimals: true,
    home_screen: 'categories',
    last_space_id: null as string | null,
  };

  await page.route(`${SUPABASE_URL}/rest/v1/space_members?*`, (route) =>
    route.fulfill({ json: hasSpace ? [membershipRow(defaultAccountId)] : [] }),
  );
  await page.route(`${SUPABASE_URL}/rest/v1/user_settings?*`, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      Object.assign(userSettings, request.postDataJSON());
      return route.fulfill({ json: [userSettings] });
    }
    return route.fulfill({ json: userSettings });
  });
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/*`, (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    const body = route.request().postDataJSON() as Record<string, unknown>;
    rpcCalls.set(name, [...(rpcCalls.get(name) ?? []), body]);
    if (name === 'set_default_account') {
      defaultAccountId = (body['target_account_id'] as string | null) ?? null;
    }
    if (name === 'reorder_categories') {
      (body['category_ids'] as string[]).forEach((id, index) => {
        const row = tables['categories'].find((category) => category.id === id);
        if (row) {
          row['sort_order'] = index;
        }
      });
    }
    return route.fulfill({ status: 204 });
  });
  // Registered after the catch-all above: the last matching route wins.
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/create_space`, (route) => {
    createdSpace = route.request().postDataJSON();
    hasSpace = true;
    return route.fulfill({ json: E2E_SPACE.id });
  });
  await page.route(`${SUPABASE_URL}/rest/v1/account_balances?*`, (route) =>
    route.fulfill({
      json: tables['accounts'].map((account) => ({
        account_id: account['id'],
        balance: account['initial_balance'],
      })),
    }),
  );
  for (const table of Object.keys(tables)) {
    await page.route(`${SUPABASE_URL}/rest/v1/${table}?*`, (route) =>
      answerTable(route, table, tables[table], writes),
    );
  }

  return {
    createdSpace: () => createdSpace,
    writes: () => writes,
    rpcCalls: (name) => rpcCalls.get(name) ?? [],
  };
}

let nextId = 1;

/** Plays the part of PostgREST and the database triggers for one table. */
function answerTable(route: Route, table: string, rows: Row[], writes: RecordedWrite[]) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const single = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object');
  const idFilter = url.searchParams.get('id')?.replace(/^eq\./, '');

  if (method === 'GET') {
    return route.fulfill({ json: rows });
  }
  const body: unknown = method === 'DELETE' ? null : request.postDataJSON();
  writes.push({ method: method as RecordedWrite['method'], table, body, query: url.search });

  if (method === 'POST') {
    const items = (Array.isArray(body) ? body : [body]) as Row[];
    const created = items.map((item) => withDefaults(table, rows, item));
    rows.push(...created);
    return route.fulfill({ status: 201, json: single ? created[0] : created });
  }
  if (method === 'PATCH') {
    const row = rows.find((candidate) => candidate['id'] === idFilter);
    if (row) {
      Object.assign(row, body);
    }
    return route.fulfill({ json: row ? [row] : [] });
  }
  // DELETE: by id (and, for default tags, by category and tag).
  const before = rows.length;
  const kept = rows.filter((row) => row['id'] !== idFilter);
  rows.splice(0, rows.length, ...kept);
  return route.fulfill({ json: before === kept.length ? [] : [{ id: idFilter }] });
}

function withDefaults(table: string, rows: readonly Row[], item: Row): Row {
  const row: Row = { id: `${table}-${nextId++}`, archived_at: null, ...item };
  if (table === 'accounts') {
    row['owner_id'] = E2E_USER.id;
    row['account_group'] = ACCOUNT_GROUPS[String(item['kind'])];
    row['include_in_total'] ??= row['account_group'] === 'accounts';
    row['sort_order'] ??= rows.length;
  }
  if (table === 'categories') {
    row['sort_order'] ??= rows.filter(
      (other) =>
        other['kind'] === item['kind'] && other['parent_id'] === (item['parent_id'] ?? null),
    ).length;
  }
  return row;
}

function membershipRow(defaultAccountId: string | null) {
  return {
    role: 'owner',
    joined_at: '2026-01-01T00:00:00Z',
    default_account_id: defaultAccountId,
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
