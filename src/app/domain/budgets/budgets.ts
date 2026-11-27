import { IsoDate } from '../dates/local-date';
import { CurrencyAmount, sumByCurrency } from '../money/money';

/** What budget rules need from a budget row (spec §4.7). */
export interface BudgetEntry {
  readonly category_id: string;
  /** Minor units; 0 means no amount from that period on. */
  readonly amount: number;
  readonly currency: string;
  /** First day of the month that names the period it applies from. */
  readonly effective_from: IsoDate;
}

/**
 * The budget of a category in force in the period of `month`: the latest one set from that period
 * or before, until it is changed (spec §4.7). Null without any, or when it was set to 0.
 */
export function budgetInForce<T extends BudgetEntry>(
  entries: readonly T[],
  categoryId: string,
  month: IsoDate,
): T | null {
  let current: T | null = null;
  for (const entry of entries) {
    if (
      entry.category_id === categoryId &&
      entry.effective_from <= month &&
      (!current || entry.effective_from > current.effective_from)
    ) {
      current = entry;
    }
  }
  return current && current.amount > 0 ? current : null;
}

/** Monthly totals of some categories per currency, `firstCurrency` first (no conversion yet). */
export function budgetTotals(
  entries: readonly BudgetEntry[],
  categoryIds: readonly string[],
  month: IsoDate,
  firstCurrency?: string,
): CurrencyAmount[] {
  const amounts = categoryIds
    .map((id) => budgetInForce(entries, id, month))
    .filter((entry): entry is BudgetEntry => entry !== null);
  return sumByCurrency(amounts, firstCurrency);
}
