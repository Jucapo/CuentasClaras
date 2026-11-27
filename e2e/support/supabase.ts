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
  /** The space settings as the app last saved them. */
  readonly settings: () => Readonly<Record<string, unknown>>;
}

/** Where the setup wizard of the space starts (spec §7); complete unless said otherwise. */
export interface OnboardingFixture {
  readonly step: number;
  readonly completedAt?: string | null;
  readonly postponedAt?: string | null;
}

/** A space whose setup wizard is done, so the app opens straight away. */
const COMPLETED_ONBOARDING: OnboardingFixture = { step: 7, completedAt: '2026-11-01T00:00:00Z' };

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
  {
    withSpace = false,
    catalog,
    onboarding = COMPLETED_ONBOARDING,
    space,
  }: {
    withSpace?: boolean;
    catalog?: CatalogFixture;
    onboarding?: OnboardingFixture;
    /** Space settings other than the defaults, e.g. budgets turned off. */
    space?: Record<string, unknown>;
  } = {},
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
    budgets: structuredClone(catalog?.budgets ?? []) as Row[],
  };
  const transactions = structuredClone(catalog?.transactions ?? []) as Row[];
  const exchangeRates = structuredClone(catalog?.exchangeRates ?? []) as Row[];
  const spaceSettings: Row = {
    space_id: E2E_SPACE.id,
    main_currency: 'COP',
    month_start_day: 1,
    week_start: 'monday',
    budgets_enabled: true,
    default_period: 'month',
    onboarding_step: onboarding.step,
    onboarding_completed_at: onboarding.completedAt ?? null,
    onboarding_postponed_at: onboarding.postponedAt ?? null,
    ...space,
  };
  const userSettings = {
    user_id: E2E_USER.id,
    theme: 'system',
    number_format: 'comma_dot',
    show_decimals: true,
    home_screen: 'categories',
    last_space_id: null as string | null,
  };

  const profile = { user_id: E2E_USER.id, display_name: 'E2E', avatar_url: null };
  await page.route(`${SUPABASE_URL}/rest/v1/space_members?*`, (route) => {
    // The members of a space (filtered by it) or the memberships of the user.
    if (new URL(route.request().url()).searchParams.has('space_id')) {
      return route.fulfill({
        json: [
          {
            user_id: E2E_USER.id,
            role: 'owner',
            profile: { display_name: profile.display_name },
          },
        ],
      });
    }
    return route.fulfill({
      json: hasSpace ? [membershipRow(defaultAccountId, spaceSettings)] : [],
    });
  });
  await page.route(`${SUPABASE_URL}/rest/v1/profiles?*`, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      Object.assign(profile, request.postDataJSON());
      writes.push({
        method: 'PATCH',
        table: 'profiles',
        body: request.postDataJSON(),
        query: new URL(request.url()).search,
      });
      return route.fulfill({ json: [profile] });
    }
    return route.fulfill({ json: profile });
  });
  await page.route(`${SUPABASE_URL}/rest/v1/space_settings?*`, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      Object.assign(spaceSettings, request.postDataJSON());
    }
    return route.fulfill({ json: [spaceSettings] });
  });
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
    if (name === 'create_category_tree') {
      createCategoryTree(tables['categories'], body);
    }
    if (name === 'reorder_categories') {
      (body['category_ids'] as string[]).forEach((id, index) => {
        const row = tables['categories'].find((category) => category.id === id);
        if (row) {
          row['sort_order'] = index;
        }
      });
    }
    if (name === 'save_transaction') {
      return route.fulfill({ json: saveTransaction(transactions, tables['accounts'], body) });
    }
    if (name === 'save_exchange_rate') {
      saveExchangeRate(exchangeRates, body);
    }
    if (name === 'category_totals') {
      const ledger = { accounts: tables['accounts'], transactions, rates: exchangeRates };
      return route.fulfill({
        json: categoryTotals(ledger, tables['categories'], tables['budgets'], body, spaceSettings),
      });
    }
    if (name === 'accounts_total') {
      const ledger = { accounts: tables['accounts'], transactions, rates: exchangeRates };
      return route.fulfill({ json: accountsTotal(ledger, body, spaceSettings) });
    }
    if (name === 'search_transactions' || name === 'transaction_totals') {
      const ledger = { accounts: tables['accounts'], transactions, rates: exchangeRates };
      const found = searchTransactions(ledger, tables['categories'], body);
      return route.fulfill({
        json:
          name === 'search_transactions'
            ? withEmbeds(found)
            : transactionTotals(ledger, found, spaceSettings, body),
      });
    }
    return route.fulfill({ status: 204 });
  });
  // Registered after the catch-all above: the last matching route wins.
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/create_space`, (route) => {
    createdSpace = route.request().postDataJSON();
    hasSpace = true;
    // create_space records the first wizard step as done.
    Object.assign(spaceSettings, {
      onboarding_step: 1,
      onboarding_completed_at: null,
      onboarding_postponed_at: null,
    });
    return route.fulfill({ json: E2E_SPACE.id });
  });
  await page.route(`${SUPABASE_URL}/rest/v1/account_balances?*`, (route) =>
    route.fulfill({
      json: tables['accounts'].map((account) => ({
        account_id: account['id'],
        balance: balanceOf(account, transactions),
      })),
    }),
  );
  for (const url of [
    `${SUPABASE_URL}/rest/v1/transactions`,
    `${SUPABASE_URL}/rest/v1/transactions?*`,
  ]) {
    await page.route(url, (route) => answerTransactions(route, transactions, writes));
  }
  for (const url of [
    `${SUPABASE_URL}/rest/v1/exchange_rates`,
    `${SUPABASE_URL}/rest/v1/exchange_rates?*`,
  ]) {
    await page.route(url, (route) => answerTable(route, 'exchange_rates', exchangeRates, writes));
  }
  for (const table of Object.keys(tables)) {
    // An insert that selects nothing back has no query string at all.
    for (const url of [`${SUPABASE_URL}/rest/v1/${table}`, `${SUPABASE_URL}/rest/v1/${table}?*`]) {
      await page.route(url, (route) => answerTable(route, table, tables[table], writes));
    }
  }

  return {
    createdSpace: () => createdSpace,
    writes: () => writes,
    rpcCalls: (name) => rpcCalls.get(name) ?? [],
    settings: () => spaceSettings,
  };
}

/** Plays the part of create_category_tree: categories, then their subcategories. */
function createCategoryTree(categories: Row[], body: Record<string, unknown>): void {
  const tree = body['tree'] as { name: string; icon: string; color: string; children?: Row[] }[];
  for (const parent of tree) {
    const created = withDefaults('categories', categories, {
      space_id: body['target_space_id'],
      kind: body['category_kind'],
      parent_id: null,
      name: parent.name,
      icon: parent.icon,
      color: parent.color,
    });
    categories.push(created);
    for (const child of parent.children ?? []) {
      categories.push(
        withDefaults('categories', categories, {
          space_id: body['target_space_id'],
          kind: body['category_kind'],
          parent_id: created['id'],
          name: child['name'],
          icon: child['icon'],
          color: null,
        }),
      );
    }
  }
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
  // DELETE: the rows that match every filter, e.g. id=eq.x or category_id=eq.x&tag_id=in.(a,b).
  const deleted = rows.filter((row) => matchesFilters(row, url.searchParams));
  const kept = rows.filter((row) => !deleted.includes(row));
  rows.splice(0, rows.length, ...kept);
  return route.fulfill({ json: deleted });
}

/** PostgREST query params that are not filters. */
const NON_FILTER_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'columns']);

/** Whether a row matches the `eq.` and `in.()` filters of a request; no filters match nothing. */
function matchesFilters(row: Row, params: URLSearchParams): boolean {
  let filtered = false;
  for (const [column, filter] of params) {
    if (NON_FILTER_PARAMS.has(column)) {
      continue;
    }
    filtered = true;
    const value = String(row[column] ?? '');
    if (filter.startsWith('eq.')) {
      if (value !== filter.slice('eq.'.length)) {
        return false;
      }
    } else if (filter.startsWith('in.(') && filter.endsWith(')')) {
      const values = filter
        .slice('in.('.length, -1)
        .split(',')
        .map((item) => item.replace(/^"|"$/g, ''));
      if (!values.includes(value)) {
        return false;
      }
    } else {
      return false;
    }
  }
  return filtered;
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

/** Accounts, movements and rates, as the totals RPCs read them. */
interface Ledger {
  readonly accounts: readonly Row[];
  readonly transactions: readonly Row[];
  readonly rates: readonly Row[];
}

/** How a movement changes an account, as the account_balances view counts it. */
function deltaFor(movement: Row, accountId: unknown): number {
  const amount = Number(movement['amount']);
  if (movement['type'] === 'transfer' && movement['to_account_id'] === accountId) {
    return Number(movement['to_amount'] ?? amount);
  }
  if (movement['account_id'] !== accountId) {
    return 0;
  }
  return movement['type'] === 'income' || movement['adjustment_direction'] === 'increase'
    ? amount
    : -amount;
}

/** Plays the part of account_balances: confirmed movements from the initial balance date. */
function balanceOf(account: Row, transactions: readonly Row[]): number {
  return transactions
    .filter(
      (movement) =>
        movement['status'] === 'confirmed' &&
        String(movement['date']) >= String(account['initial_balance_date']),
    )
    .reduce(
      (total, movement) => total + deltaFor(movement, account['id']),
      Number(account['initial_balance']),
    );
}

/** The latest rate on or before a date, else the oldest one, in either direction (spec §4.6). */
function rateBetween(rates: readonly Row[], from: string, to: string, date: string): number | null {
  if (from === to) {
    return 1;
  }
  const pair = rates.filter(
    (rate) =>
      (rate['base'] === from && rate['quote'] === to) ||
      (rate['base'] === to && rate['quote'] === from),
  );
  const before = pair
    .filter((rate) => String(rate['date']) <= date)
    .sort((a, b) => String(b['date']).localeCompare(String(a['date'])));
  const chosen =
    before[0] ?? [...pair].sort((a, b) => String(a['date']).localeCompare(String(b['date'])))[0];
  if (!chosen) {
    return null;
  }
  return chosen['base'] === from ? Number(chosen['rate']) : 1 / Number(chosen['rate']);
}

function convert(
  ledger: Ledger,
  amount: number,
  from: string,
  to: string,
  date: string,
): number | null {
  const rate = rateBetween(ledger.rates, from, to, date);
  // Every currency of the fixtures has two decimals.
  return rate === null ? null : Math.round(amount * rate);
}

/** Plays the part of save_transaction: updates the movement with that id or creates it. */
function saveTransaction(
  transactions: Row[],
  accounts: readonly Row[],
  body: Record<string, unknown>,
) {
  const account = accounts.find((candidate) => candidate['id'] === body['entry_account_id']);
  const id = String(body['target_id']);
  const existing = transactions.find((movement) => movement['id'] === id);
  const now = new Date().toISOString();
  const type = body['entry_type'];
  const categorized = type === 'expense' || type === 'income';
  const row: Row = {
    id,
    space_id: body['target_space_id'],
    type,
    date: body['entry_date'],
    amount: body['entry_amount'],
    currency: account?.['currency'] ?? 'COP',
    account_id: body['entry_account_id'],
    to_account_id: body['entry_to_account_id'] ?? null,
    to_amount: body['entry_to_amount'] ?? null,
    category_id: body['entry_category_id'] ?? null,
    adjustment_direction: body['entry_adjustment_direction'] ?? null,
    note: String(body['entry_note'] ?? '').trim() || null,
    include_in_space:
      categorized && account?.['visibility'] === 'private'
        ? (body['entry_include_in_space'] ?? existing?.['include_in_space'] ?? false)
        : false,
    operation_id: null,
    financing_plan_id: null,
    source: 'manual',
    status: 'confirmed',
    external_id: null,
    created_by: E2E_USER.id,
    created_at: existing?.['created_at'] ?? now,
    updated_at: now,
    tag_ids: body['entry_tag_ids'] ?? [],
    installments: body['entry_installments'] ?? 1,
    rate: body['entry_monthly_rate'] ?? 0,
  };
  if (existing) {
    Object.assign(existing, row);
  } else {
    transactions.push(row);
  }
  return id;
}

/** Plays the part of save_exchange_rate: one rate per pair and day, in either direction. */
function saveExchangeRate(rates: Row[], body: Record<string, unknown>): void {
  const pair = [body['base_currency'], body['quote_currency']].sort().join('/');
  const kept = rates.filter(
    (rate) =>
      !(
        rate['date'] === body['rate_date'] &&
        [rate['base'], rate['quote']].sort().join('/') === pair
      ),
  );
  kept.push({
    id: `rate-${nextId++}`,
    space_id: body['target_space_id'],
    date: body['rate_date'],
    base: body['base_currency'],
    quote: body['quote_currency'],
    rate: body['rate_value'],
    source: 'manual',
  });
  rates.splice(0, rates.length, ...kept);
}

/** Plays the part of category_totals: what the space shares, rolled up, with budgets. */
function categoryTotals(
  ledger: Ledger,
  categories: readonly Row[],
  budgets: readonly Row[],
  body: Record<string, unknown>,
  settings: Row,
) {
  const main = String(settings['main_currency']);
  const from = body['from_date'] as string | null;
  const to = body['to_date'] as string | null;
  const months = (body['budget_months'] as string[] | undefined) ?? [];
  const own = new Map<unknown, number>();
  const missing = new Map<unknown, Set<string>>();
  for (const movement of ledger.transactions) {
    const date = String(movement['date']);
    const account = ledger.accounts.find((candidate) => candidate['id'] === movement['account_id']);
    const shared = movement['include_in_space'] === true || account?.['visibility'] === 'shared';
    if (
      movement['status'] !== 'confirmed' ||
      (movement['type'] !== 'expense' && movement['type'] !== 'income') ||
      (from !== null && date < from) ||
      (to !== null && date > to) ||
      !shared
    ) {
      continue;
    }
    const category = movement['category_id'];
    const converted = convert(
      ledger,
      Number(movement['amount']),
      String(movement['currency']),
      main,
      date,
    );
    if (converted === null) {
      missing.set(category, (missing.get(category) ?? new Set()).add(String(movement['currency'])));
    } else {
      own.set(category, (own.get(category) ?? 0) + converted);
    }
  }
  // Its own budget: the "General" of a category or that of a subcategory (spec §4.7).
  const ownBudget = (categoryId: unknown): number | null => {
    const inForce = months
      .map(
        (month) =>
          budgets
            .filter(
              (budget) =>
                budget['category_id'] === categoryId && String(budget['effective_from']) <= month,
            )
            .sort((a, b) =>
              String(b['effective_from']).localeCompare(String(a['effective_from'])),
            )[0],
      )
      .filter((budget): budget is Row => !!budget && Number(budget['amount']) > 0);
    return inForce.length > 0
      ? inForce.reduce(
          (sum, row) =>
            sum +
            (convert(
              ledger,
              Number(row['amount']),
              String(row['currency']),
              main,
              to ?? '9999-12-31',
            ) ?? 0),
          0,
        )
      : null;
  };
  return categories.map((category) => {
    const isTop = category['parent_id'] === null;
    const children = categories.filter((child) => child['parent_id'] === category['id']);
    const amount =
      (own.get(category['id']) ?? 0) +
      (isTop ? children.reduce((sum, child) => sum + (own.get(child['id']) ?? 0), 0) : 0);
    // A category adds its General and the budgets of its subcategories.
    const parts = [category, ...(isTop ? children : [])]
      .map((row) => ownBudget(row['id']))
      .filter((part): part is number => part !== null);
    const budget = parts.length > 0 ? parts.reduce((sum, part) => sum + part, 0) : null;
    return {
      category_id: category['id'],
      parent_id: category['parent_id'],
      kind: category['kind'],
      amount,
      budget,
      remaining: budget === null ? null : budget - amount,
      missing_rate_currencies: [...(missing.get(category['id']) ?? [])],
    };
  });
}

/** Plays the part of accounts_total: active accounts included in the total, converted. */
function accountsTotal(ledger: Ledger, body: Record<string, unknown>, settings: Row) {
  const main = String(settings['main_currency']);
  const onDate = String(body['on_date']);
  let total = 0;
  const missing = new Set<string>();
  for (const account of ledger.accounts) {
    if (!account['include_in_total'] || account['archived_at']) {
      continue;
    }
    const converted = convert(
      ledger,
      balanceOf(account, ledger.transactions),
      String(account['currency']),
      main,
      onDate,
    );
    if (converted === null) {
      missing.add(String(account['currency']));
    } else {
      total += converted;
    }
  }
  return { total, currency: main, missing_rate_currencies: [...missing].sort() };
}

/** Movements: filtered by account, with their tags, author and deferral embedded. */
function answerTransactions(route: Route, transactions: Row[], writes: RecordedWrite[]) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  if (method === 'DELETE') {
    const id = url.searchParams.get('id')?.replace(/^eq\./, '');
    writes.push({ method: 'DELETE', table: 'transactions', body: null, query: url.search });
    const deleted = transactions.filter((movement) => movement['id'] === id);
    transactions.splice(
      0,
      transactions.length,
      ...transactions.filter((movement) => movement['id'] !== id),
    );
    return route.fulfill({ json: deleted.map(({ id: deletedId }) => ({ id: deletedId })) });
  }
  // or=(account_id.eq.X,to_account_id.eq.X)
  const accountId = /account_id\.eq\.([^,)]+)/.exec(url.searchParams.get('or') ?? '')?.[1];
  const rows = transactions
    .filter(
      (movement) =>
        !accountId ||
        movement['account_id'] === accountId ||
        movement['to_account_id'] === accountId,
    )
    .sort(
      (a, b) =>
        String(b['date']).localeCompare(String(a['date'])) ||
        String(b['created_at']).localeCompare(String(a['created_at'])),
    );
  if (method === 'HEAD') {
    return route.fulfill({
      status: 200,
      headers: { 'content-range': `*/${rows.length}` },
      body: '',
    });
  }
  return route.fulfill({ json: withEmbeds(rows) });
}

/** Movements as the select of the app reads them, with tags, author and deferral embedded. */
function withEmbeds(rows: readonly Row[]): Row[] {
  return rows.map(({ tag_ids, installments, rate, ...movement }) => ({
    ...movement,
    transaction_tags: (tag_ids as string[]).map((tagId) => ({ tag_id: tagId })),
    author: { display_name: 'E2E' },
    deferral: Number(installments) > 1 ? [{ installments, rate }] : [],
  }));
}

/** Lowercase without accents, as private.search_text. */
function searchText(text: unknown): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Plays the part of search_transactions: the period, the filters and the search, newest first. */
function searchTransactions(
  ledger: Ledger,
  categories: readonly Row[],
  body: Record<string, unknown>,
): Row[] {
  const from = body['from_date'] as string | null;
  const to = body['to_date'] as string | null;
  const list = (key: string) => (body[key] as unknown[] | null | undefined) ?? [];
  const terms = list('search_terms').map(searchText);
  const amount = body['search_amount'] as number | null | undefined;
  const nameOf = (rows: readonly Row[], id: unknown) =>
    rows.find((row) => row['id'] === id)?.['name'];
  return ledger.transactions
    .filter((movement) => {
      const date = String(movement['date']);
      const category = categories.find((row) => row['id'] === movement['category_id']);
      const accounts = [movement['account_id'], movement['to_account_id']];
      const matches = (key: string, ...values: unknown[]) =>
        list(key).length === 0 || values.some((value) => list(key).includes(value));
      const haystack = searchText(
        [
          movement['note'],
          category?.['name'],
          nameOf(categories, category?.['parent_id']),
          ...accounts.map((id) => nameOf(ledger.accounts, id)),
        ].join(' '),
      );
      return (
        (from === null || date >= from) &&
        (to === null || date <= to) &&
        matches('filter_account_ids', ...accounts) &&
        matches('filter_category_ids', category?.['id'], category?.['parent_id']) &&
        matches('filter_tag_ids', ...(movement['tag_ids'] as unknown[])) &&
        matches('filter_types', movement['type']) &&
        matches('filter_author_ids', movement['created_by']) &&
        matches('filter_statuses', movement['status']) &&
        (terms.length === 0 ||
          (amount != null && (movement['amount'] === amount || movement['to_amount'] === amount)) ||
          terms.every((term) => haystack.includes(term)))
      );
    })
    .sort(
      (a, b) =>
        String(b['date']).localeCompare(String(a['date'])) ||
        String(b['created_at']).localeCompare(String(a['created_at'])),
    );
}

/** Plays the part of transaction_totals over what search_transactions found. */
/** Like the RPC: without a status filter only what is confirmed adds up, as in category_totals. */
function transactionTotals(ledger: Ledger, found: readonly Row[], settings: Row, args: Row) {
  const main = String(settings['main_currency']);
  const totals = { income: 0, expense: 0 };
  const missing = new Set<string>();
  const statuses = args['filter_statuses'];
  const anyStatus = Array.isArray(statuses) && statuses.length > 0;
  for (const movement of found) {
    const type = movement['type'];
    if (type !== 'income' && type !== 'expense') {
      continue;
    }
    if (!anyStatus && movement['status'] !== 'confirmed') {
      continue;
    }
    const converted = convert(
      ledger,
      Number(movement['amount']),
      String(movement['currency']),
      main,
      String(movement['date']),
    );
    if (converted === null) {
      missing.add(String(movement['currency']));
    } else {
      totals[type] += converted;
    }
  }
  return {
    income: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
    currency: main,
    missing_rate_currencies: [...missing].sort(),
  };
}

function membershipRow(defaultAccountId: string | null, settings: Row) {
  return {
    role: 'owner',
    joined_at: '2026-01-01T00:00:00Z',
    default_account_id: defaultAccountId,
    spaces: {
      ...E2E_SPACE,
      space_settings: { ...settings },
    },
  };
}
