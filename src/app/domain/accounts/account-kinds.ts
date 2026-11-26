import { CurrencyAmount, sumByCurrency } from '../money/money';

/** Account types (spec §4.1); mirrors the `account_kind` database enum. */
export type AccountKind =
  | 'cash'
  | 'bank'
  | 'wallet'
  | 'savings'
  | 'credit_card'
  | 'loan'
  | 'simple_debt'
  | 'receivable'
  | 'asset';

/** Account groups (spec §4.1); mirrors the `account_group` database enum. */
export type AccountGroup = 'accounts' | 'savings' | 'debts' | 'receivables' | 'assets';

/** Group of each kind; the database derives the same with private.account_group_of(). */
export const ACCOUNT_KIND_GROUP: Readonly<Record<AccountKind, AccountGroup>> = {
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

/** Groups in display order. */
export const ACCOUNT_GROUPS: readonly AccountGroup[] = [
  'accounts',
  'savings',
  'debts',
  'receivables',
  'assets',
];

/** Kinds in display order. */
export const ACCOUNT_KINDS: readonly AccountKind[] = Object.keys(
  ACCOUNT_KIND_GROUP,
) as AccountKind[];

/** Whether the account is something the user owes (its balance is stored negative). */
export function isDebtKind(kind: AccountKind): boolean {
  return ACCOUNT_KIND_GROUP[kind] === 'debts';
}

/** Only available money (the Accounts group) counts in the total by default. */
export function includeInTotalByDefault(kind: AccountKind): boolean {
  return ACCOUNT_KIND_GROUP[kind] === 'accounts';
}

function negate(value: number): number {
  return value === 0 ? 0 : -value;
}

/**
 * Stored balance for the amount the user sees. Debts are typed positive ("what you owe") and
 * stored negative (spec §4.1), so switching kinds keeps the visible amount and flips the sign.
 */
export function toStoredBalance(kind: AccountKind, displayed: number): number {
  return isDebtKind(kind) ? negate(displayed) : displayed;
}

/** Amount the user sees for a stored balance; the inverse of `toStoredBalance`. */
export function toDisplayedBalance(kind: AccountKind, stored: number): number {
  return isDebtKind(kind) ? negate(stored) : stored;
}

/** What grouping and totals need from an account. */
export interface BalanceItem {
  readonly kind: AccountKind;
  readonly currency: string;
  /** Stored balance in minor units (debts negative). */
  readonly balance: number;
  readonly include_in_total: boolean;
}

/** Accounts of one group with their totals per currency. */
export interface AccountGroupSummary<T extends BalanceItem> {
  readonly group: AccountGroup;
  readonly accounts: readonly T[];
  readonly totals: readonly CurrencyAmount[];
}

/** Non-empty groups in display order, keeping the order of the accounts inside each one. */
export function groupAccounts<T extends BalanceItem>(
  accounts: readonly T[],
  mainCurrency: string,
): AccountGroupSummary<T>[] {
  return ACCOUNT_GROUPS.map((group) => {
    const members = accounts.filter((account) => ACCOUNT_KIND_GROUP[account.kind] === group);
    return {
      group,
      accounts: members,
      totals: sumByCurrency(
        members.map(({ currency, balance }) => ({ currency, amount: balance })),
        mainCurrency,
      ),
    };
  }).filter((summary) => summary.accounts.length > 0);
}

/** Total per currency of the accounts marked "include in the total" (debts subtract). */
export function accountsTotal(
  accounts: readonly BalanceItem[],
  mainCurrency: string,
): CurrencyAmount[] {
  return sumByCurrency(
    accounts
      .filter((account) => account.include_in_total)
      .map(({ currency, balance }) => ({ currency, amount: balance })),
    mainCurrency,
  );
}
