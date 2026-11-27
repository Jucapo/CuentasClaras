import { addMonths, IsoDate } from '../dates/local-date';
import { BudgetEntry } from './budgets';

/**
 * How far a budget edit in a month reaches (spec §4.7): only that month, or that month and the
 * following ones that have no amount of their own.
 */
export type BudgetEditScope = 'month' | 'onward';

/** A budget row to save: an amount from a month on. */
export interface BudgetWrite {
  /** First day of the month that names the period (`YYYY-MM-01`). */
  readonly effectiveFrom: IsoDate;
  /** Minor units; 0 means no amount from that month on. */
  readonly amount: number;
  readonly currency: string;
}

function ownEntry(
  entries: readonly BudgetEntry[],
  categoryId: string,
  month: IsoDate,
): BudgetEntry | null {
  return (
    entries.find((entry) => entry.category_id === categoryId && entry.effective_from === month) ??
    null
  );
}

/** The row in force in a month, zeros included (unlike `budgetInForce`). */
function rowInForce(
  entries: readonly BudgetEntry[],
  categoryId: string,
  month: IsoDate,
): BudgetEntry | null {
  let current: BudgetEntry | null = null;
  for (const entry of entries) {
    if (
      entry.category_id === categoryId &&
      entry.effective_from <= month &&
      (!current || entry.effective_from > current.effective_from)
    ) {
      current = entry;
    }
  }
  return current;
}

function sameAmount(row: BudgetEntry | null, amount: number, currency: string): boolean {
  const current = row?.amount ?? 0;
  return current === amount && (amount === 0 || row?.currency === currency);
}

/**
 * The rows to save for an amount set in `month` (spec §4.7), in the order to save them. With
 * `onward`, only the month: later months with their own amount keep it. With `month`, the next month
 * first keeps what was in force (0 if nothing was) unless it already has its own, so a save that
 * stops halfway never changes the months after. Nothing when the amount does not change.
 */
export function budgetWrites(
  entries: readonly BudgetEntry[],
  categoryId: string,
  month: IsoDate,
  amount: number,
  currency: string,
  scope: BudgetEditScope,
): BudgetWrite[] {
  const before = rowInForce(entries, categoryId, month);
  if (sameAmount(before, amount, currency)) {
    return [];
  }
  const write: BudgetWrite = { effectiveFrom: month, amount, currency };
  const next = addMonths(month, 1);
  if (scope === 'onward' || ownEntry(entries, categoryId, next)) {
    return [write];
  }
  const kept: BudgetWrite = {
    effectiveFrom: next,
    amount: before?.amount ?? 0,
    currency: before?.currency ?? currency,
  };
  return [kept, write];
}

/**
 * Whether the amount of a month is its own and differs from the next month's, which also has its
 * own: the row says "Solo {mes}".
 */
export function isMonthOnly(
  entries: readonly BudgetEntry[],
  categoryId: string,
  month: IsoDate,
): boolean {
  const own = ownEntry(entries, categoryId, month);
  const next = ownEntry(entries, categoryId, addMonths(month, 1));
  return !!own && !!next && !sameAmount(next, own.amount, own.currency);
}

/** The first month after `month` where the category has its own amount, which an edit keeps. */
export function nextOwnMonth(
  entries: readonly BudgetEntry[],
  categoryId: string,
  month: IsoDate,
): IsoDate | null {
  let next: IsoDate | null = null;
  for (const entry of entries) {
    if (
      entry.category_id === categoryId &&
      entry.effective_from > month &&
      (next === null || entry.effective_from < next)
    ) {
      next = entry.effective_from;
    }
  }
  return next;
}
