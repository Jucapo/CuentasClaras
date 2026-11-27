const SPACE_ID = '00000000-0000-4000-8000-00000000005e';
const OWNER_ID = '00000000-0000-4000-8000-0000000000e2';

/** Rows the mocked API starts with. */
export interface CatalogFixture {
  readonly accounts: readonly Record<string, unknown>[];
  readonly categories: readonly Record<string, unknown>[];
  readonly tags: readonly Record<string, unknown>[];
  readonly defaultTags: readonly Record<string, unknown>[];
  readonly defaultAccountId: string | null;
  readonly budgets?: readonly Record<string, unknown>[];
  /** Movements, with their tag ids and card deferral inline as the mock stores them. */
  readonly transactions?: readonly Record<string, unknown>[];
  readonly exchangeRates?: readonly Record<string, unknown>[];
}

function movement(
  id: string,
  type: string,
  date: string,
  amount: number,
  accountId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    space_id: SPACE_ID,
    type,
    date,
    amount,
    currency: 'COP',
    account_id: accountId,
    to_account_id: null,
    to_amount: null,
    category_id: null,
    adjustment_direction: null,
    note: null,
    include_in_space: false,
    operation_id: null,
    financing_plan_id: null,
    source: 'manual',
    status: 'confirmed',
    external_id: null,
    created_by: OWNER_ID,
    created_at: `${date}T12:00:00Z`,
    updated_at: `${date}T12:00:00Z`,
    tag_ids: [],
    installments: 1,
    rate: 0,
    ...overrides,
  };
}

function account(
  id: string,
  name: string,
  kind: string,
  group: string,
  initialBalance: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    space_id: SPACE_ID,
    owner_id: OWNER_ID,
    visibility: 'shared',
    name,
    kind,
    account_group: group,
    currency: 'COP',
    initial_balance: initialBalance,
    initial_balance_date: '2026-11-01',
    icon: 'payments',
    color: 'green',
    include_in_total: group === 'accounts',
    include_in_space_by_default: false,
    sort_order: 0,
    archived_at: null,
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

function category(
  id: string,
  name: string,
  icon: string,
  color: string | null,
  sortOrder: number,
  parentId: string | null = null,
  kind = 'expense',
) {
  return {
    id,
    space_id: SPACE_ID,
    parent_id: parentId,
    kind,
    name,
    icon,
    color,
    sort_order: sortOrder,
    archived_at: null,
    created_at: '2026-11-01T00:00:00Z',
  };
}

/** A household with everyday accounts, savings in two currencies, debts and categories. */
export const HOUSEHOLD: CatalogFixture = {
  accounts: [
    account('acc-cash', 'Efectivo', 'cash', 'accounts', 35000000, { sort_order: 0 }),
    account('acc-bank', 'Bancolombia', 'bank', 'accounts', 254300000, {
      icon: 'account_balance',
      color: 'amber',
      sort_order: 1,
    }),
    account('acc-nequi', 'Nequi', 'wallet', 'accounts', 4890050, {
      icon: 'account_balance_wallet',
      color: 'purple',
      visibility: 'private',
      sort_order: 2,
    }),
    account('acc-savings', 'Caja menor', 'savings', 'savings', 50000000, {
      icon: 'savings',
      color: 'teal',
      sort_order: 3,
    }),
    account('acc-usd', 'DollarApp', 'savings', 'savings', 120000, {
      icon: 'currency_exchange',
      color: 'sky',
      currency: 'USD',
      sort_order: 4,
    }),
    account('acc-card', 'Tarjeta Visa', 'credit_card', 'debts', -185000000, {
      icon: 'credit_card',
      color: 'red',
      sort_order: 5,
    }),
    account('acc-lent', 'Préstamo a Carlos', 'receivable', 'receivables', 30000000, {
      icon: 'move_to_inbox',
      color: 'lime',
      sort_order: 6,
    }),
  ],
  categories: [
    category('cat-home', 'Hogar', 'home', 'orange', 0),
    category('cat-rent', 'Arriendo', 'key', null, 0, 'cat-home'),
    category('cat-utilities', 'Servicios públicos', 'bolt', 'amber', 1, 'cat-home'),
    category('cat-market', 'Mercado', 'shopping_cart', 'green', 1),
    category('cat-transport', 'Transporte', 'directions_car', 'blue', 2),
    category('cat-salary', 'Salario', 'work', 'teal', 0, null, 'income'),
  ],
  tags: [
    { id: 'tag-fixed', space_id: SPACE_ID, name: 'Fijos', color: 'indigo', archived_at: null },
    { id: 'tag-health', space_id: SPACE_ID, name: 'Salud', color: 'red', archived_at: null },
  ],
  defaultTags: [{ space_id: SPACE_ID, category_id: 'cat-rent', tag_id: 'tag-fixed' }],
  defaultAccountId: 'acc-bank',
  exchangeRates: [
    {
      id: 'rate-usd',
      space_id: SPACE_ID,
      date: '2026-11-01',
      base: 'USD',
      quote: 'COP',
      rate: 4100,
      source: 'manual',
    },
  ],
};

/** The same household with a few movements in November 2026 and monthly budgets. */
export const HOUSEHOLD_WITH_MOVEMENTS: CatalogFixture = {
  ...HOUSEHOLD,
  budgets: [
    {
      id: 'budget-market',
      space_id: SPACE_ID,
      category_id: 'cat-market',
      amount: 120000000,
      currency: 'COP',
      effective_from: '2026-11-01',
    },
    {
      id: 'budget-home',
      space_id: SPACE_ID,
      category_id: 'cat-home',
      amount: 200000000,
      currency: 'COP',
      effective_from: '2026-11-01',
    },
  ],
  transactions: [
    movement('tx-rent', 'expense', '2026-11-05', 180000000, 'acc-bank', {
      category_id: 'cat-rent',
      tag_ids: ['tag-fixed'],
    }),
    movement('tx-market', 'expense', '2026-11-20', 32050000, 'acc-bank', {
      category_id: 'cat-market',
      note: 'Mercado de la semana',
    }),
    movement('tx-salary', 'income', '2026-11-25', 650000000, 'acc-bank', {
      category_id: 'cat-salary',
    }),
    movement('tx-taxi', 'expense', '2026-11-24', 2500000, 'acc-cash', {
      category_id: 'cat-transport',
    }),
  ],
};
