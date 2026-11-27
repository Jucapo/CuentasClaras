import { AccountGroup, AccountKind } from '../../domain/accounts/account-kinds';
import { ColorKey } from '../../shared/ui/colors/color-palette';
import { IconName } from '../../shared/ui/icons/icon-glyphs';

/** Longest names; they match the checks of the database. */
export const NAME_MAX_LENGTH = { account: 60, category: 40, tag: 30 } as const;

/** Spanish names of the account groups (spec §4.1). */
export const ACCOUNT_GROUP_LABELS: Readonly<Record<AccountGroup, string>> = {
  accounts: 'Cuentas',
  savings: 'Ahorros',
  debts: 'Deudas',
  receivables: 'Me deben',
  assets: 'Bienes',
};

/** Spanish name of each account kind, plus the icon and color a new account starts with. */
export const ACCOUNT_KIND_OPTIONS: Readonly<
  Record<AccountKind, { readonly label: string; readonly icon: IconName; readonly color: ColorKey }>
> = {
  cash: { label: 'Efectivo', icon: 'payments', color: 'green' },
  bank: { label: 'Banco o débito', icon: 'account_balance', color: 'blue' },
  wallet: { label: 'Billetera digital', icon: 'account_balance_wallet', color: 'purple' },
  savings: { label: 'Ahorro', icon: 'savings', color: 'teal' },
  credit_card: { label: 'Tarjeta de crédito', icon: 'credit_card', color: 'red' },
  loan: { label: 'Préstamo con interés', icon: 'request_quote', color: 'red-dark' },
  simple_debt: { label: 'Deuda sin interés', icon: 'handshake', color: 'orange' },
  receivable: { label: 'Por cobrar', icon: 'move_to_inbox', color: 'lime' },
  asset: { label: 'Bien', icon: 'real_estate_agent', color: 'brown' },
};

/** Kinds offered when creating accounts; assets arrive in F2 (spec §4.1). */
export const SELECTABLE_ACCOUNT_KINDS: readonly AccountKind[] = [
  'cash',
  'bank',
  'wallet',
  'savings',
  'credit_card',
  'loan',
  'simple_debt',
  'receivable',
];

/** Groups offered in "¿Qué vas a crear?"; assets arrive in F2. */
export type CreatableAccountGroup = Exclude<AccountGroup, 'assets'>;

/** A choice of "¿Qué vas a crear?" (spec §7): its look, an example and the kind it starts with. */
export interface AccountGroupChoice {
  readonly label: string;
  /** Title of the new account screen. */
  readonly newTitle: string;
  readonly example: string;
  readonly icon: IconName;
  readonly color: ColorKey;
  readonly defaultKind: AccountKind;
  /** Value of the `grupo` query param. */
  readonly param: string;
}

/** Choices of "¿Qué vas a crear?", in display order. */
export const ACCOUNT_GROUP_CHOICES: Readonly<Record<CreatableAccountGroup, AccountGroupChoice>> = {
  accounts: {
    label: 'Cuenta',
    newTitle: 'Nueva cuenta',
    example: 'Efectivo, banco, billetera digital',
    icon: 'account_balance_wallet',
    color: 'blue',
    defaultKind: 'bank',
    param: 'cuenta',
  },
  savings: {
    label: 'Ahorro',
    newTitle: 'Nuevo ahorro',
    example: 'Bolsillos, CDT, metas',
    icon: 'savings',
    color: 'teal',
    defaultKind: 'savings',
    param: 'ahorro',
  },
  debts: {
    label: 'Deuda',
    newTitle: 'Nueva deuda',
    example: 'Tarjeta, préstamo, deuda con alguien',
    icon: 'credit_card',
    color: 'red',
    defaultKind: 'credit_card',
    param: 'deuda',
  },
  receivables: {
    label: 'Me deben',
    newTitle: 'Nueva cuenta por cobrar',
    example: 'Plata que prestaste',
    icon: 'move_to_inbox',
    color: 'lime',
    defaultKind: 'receivable',
    param: 'me-deben',
  },
};

/** Spanish name of each category kind. */
export const CATEGORY_KIND_LABELS = { expense: 'Gastos', income: 'Ingresos' } as const;

/** Value of the `clase` query param for each category kind. */
export const CATEGORY_KIND_PARAM = { expense: 'gasto', income: 'ingreso' } as const;

/** Category kind named by the `clase` query param; expenses unless it says income. */
export function categoryKindFromParam(value: string | null | undefined): 'expense' | 'income' {
  return value === CATEGORY_KIND_PARAM.income ? 'income' : 'expense';
}

/** Icon and color a new category starts with. */
export const CATEGORY_DEFAULTS = {
  icon: 'category',
  color: 'blue',
} as const satisfies { icon: IconName; color: ColorKey };

/** Color a new tag starts with. */
export const TAG_DEFAULT_COLOR: ColorKey = 'indigo';
