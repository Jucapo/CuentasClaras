import { parseMoney } from '../money/money';
import { NumberFormat } from '../money/number-format';
import { searchTerms } from '../text/search-text';
import { TransactionType } from './transactions';

/** States of a movement (spec §4.2); they match the `transaction_status` enum. */
export type TransactionStatus = 'confirmed' | 'pending';

/**
 * Filters of the movements list (spec §7). Each one holds the picked values: any of them is enough,
 * and the filters combine. An empty one does not filter.
 */
export interface TransactionFilters {
  readonly accountIds: readonly string[];
  /** A category also brings its subcategories. */
  readonly categoryIds: readonly string[];
  readonly tagIds: readonly string[];
  readonly types: readonly TransactionType[];
  /** Who recorded the movement. */
  readonly authorIds: readonly string[];
  readonly statuses: readonly TransactionStatus[];
}

/** A filter of the list. */
export type TransactionFilterKey = keyof TransactionFilters;

/** Filters in the order the chips show them. */
export const TRANSACTION_FILTER_KEYS: readonly TransactionFilterKey[] = [
  'accountIds',
  'categoryIds',
  'tagIds',
  'types',
  'authorIds',
  'statuses',
];

/** No filter applied. */
export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = {
  accountIds: [],
  categoryIds: [],
  tagIds: [],
  types: [],
  authorIds: [],
  statuses: [],
};

/** How many filters have something picked. */
export function activeFilterCount(filters: TransactionFilters): number {
  return TRANSACTION_FILTER_KEYS.filter((key) => filters[key].length > 0).length;
}

/** What an active chip says: the first value and how many more ("Efectivo +2"); null if none. */
export function filterChipText(labels: readonly string[]): string | null {
  if (labels.length === 0) {
    return null;
  }
  return labels.length === 1 ? labels[0] : `${labels[0]} +${labels.length - 1}`;
}

/** What the search sends: its words and, if the whole text is an amount, that amount. */
export interface SearchArguments {
  /** Lowercase words without accents; every one has to appear. */
  readonly terms: readonly string[];
  /** Minor units of the typed amount, or null when the text is not an amount. */
  readonly amount: number | null;
}

/**
 * Reads the search box (spec §7): its words, and the amount when the whole text is one in the
 * user's format (read with the exponent of `currency`, the main one).
 */
export function searchArguments(
  query: string,
  numberFormat: NumberFormat,
  currency: string,
): SearchArguments {
  const terms = searchTerms(query);
  if (terms.length === 0) {
    return { terms: [], amount: null };
  }
  const parsed = parseMoney(query, currency, numberFormat);
  const amount = parsed.ok && parsed.value !== null && parsed.value > 0 ? parsed.value : null;
  return { terms, amount };
}
