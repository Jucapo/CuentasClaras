import { CurrencyAmount } from '../money/money';

/** Groups of accounts that count in the net worth, in display order (assets come in the F2). */
export const NET_WORTH_GROUPS = ['accounts', 'savings', 'receivables', 'debts'] as const;

/** A group of accounts in the net worth. */
export type NetWorthGroup = (typeof NET_WORTH_GROUPS)[number];

/** Balance of a group in one currency, as `net_worth` returns it. */
export interface NetWorthRow {
  readonly group: NetWorthGroup;
  readonly currency: string;
  /** Stored sign: debts are negative. */
  readonly balance: number;
  /** In the main currency with today's rate; null without a rate. */
  readonly converted: number | null;
}

/** Assets against debts, and what is left. Debts go positive, as "what you owe". */
export interface NetWorthFigures {
  readonly assets: number;
  readonly debts: number;
  readonly net: number;
}

/** A group with its balance per currency (debts positive) and in the main currency. */
export interface NetWorthGroupTotal {
  readonly group: NetWorthGroup;
  readonly totals: readonly CurrencyAmount[];
  /** What converts, in the main currency. */
  readonly converted: number;
}

/** "Mis finanzas" (spec §6, §7): consolidated, per group and per currency. */
export interface NetWorth {
  /** In the main currency; currencies without a rate are left out. */
  readonly consolidated: NetWorthFigures;
  readonly groups: readonly NetWorthGroupTotal[];
  /** Per currency, in that currency. */
  readonly byCurrency: readonly (NetWorthFigures & { readonly currency: string })[];
  readonly missingRateCurrencies: readonly string[];
}

function figures(rows: readonly { group: NetWorthGroup; amount: number }[]): NetWorthFigures {
  const assets = rows
    .filter((row) => row.group !== 'debts')
    .reduce((sum, row) => sum + row.amount, 0);
  // Stored negative: subtracting them from 0 gives what is owed (and never -0).
  const debts = rows
    .filter((row) => row.group === 'debts')
    .reduce((sum, row) => sum - row.amount, 0);
  return { assets, debts, net: assets - debts };
}

/**
 * The net worth from the balances per group and currency (spec §6): Cuentas, Ahorros and Me deben
 * against Deudas, consolidated in the main currency and per currency. A currency without a rate
 * stays out of the consolidated figures and is reported.
 */
export function netWorth(rows: readonly NetWorthRow[], mainCurrency: string): NetWorth {
  const groups = NET_WORTH_GROUPS.map((group) => {
    const own = rows.filter((row) => row.group === group);
    const sign = group === 'debts' ? -1 : 1;
    return {
      group,
      totals: own
        .map((row) => ({ currency: row.currency, amount: sign * row.balance }))
        .sort((a, b) => (a.currency === mainCurrency ? -1 : b.currency === mainCurrency ? 1 : 0)),
      converted: own.reduce((sum, row) => sum + sign * (row.converted ?? 0), 0),
    };
  }).filter((group) => group.totals.length > 0);
  const currencies = [...new Set(rows.map((row) => row.currency))].sort((a, b) =>
    a === mainCurrency ? -1 : b === mainCurrency ? 1 : a.localeCompare(b),
  );
  return {
    consolidated: figures(rows.map((row) => ({ group: row.group, amount: row.converted ?? 0 }))),
    groups,
    byCurrency: currencies.map((currency) => ({
      currency,
      ...figures(
        rows
          .filter((row) => row.currency === currency)
          .map((row) => ({ group: row.group, amount: row.balance })),
      ),
    })),
    missingRateCurrencies: [
      ...new Set(rows.filter((row) => row.converted === null).map((row) => row.currency)),
    ].sort(),
  };
}
