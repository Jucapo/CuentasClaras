import { addDays, IsoDate } from '../dates/local-date';
import { DateRange } from '../periods/periods';
import {
  SearchArguments,
  TRANSACTION_FILTER_KEYS,
  TransactionFilters,
} from './transaction-filters';

/** The days whose closing balances Transacciones shows (spec §7). */
export interface BalanceDates {
  /** The day before the period; null in "Siempre", which has no start. */
  readonly opening: IsoDate | null;
  /** The last day of the period, or today while it is in progress. */
  readonly closing: IsoDate;
}

/**
 * When the opening and closing balances are taken (spec §7): at the close of the day before the
 * period, and at the close of the period or of today while it is in progress.
 */
export function balanceDates(range: DateRange, today: IsoDate): BalanceDates {
  const opening = range.start === null ? null : addDays(range.start, -1);
  const started = range.start === null || range.start <= today;
  const inProgress = started && (range.end === null || today < range.end);
  return { opening, closing: inProgress || range.end === null ? today : range.end };
}

/**
 * Whether the balances apply to what is listed (spec §7): with no filter but the account one and
 * no search. A balance says nothing about a category, a tag or a search.
 */
export function showsBalances(filters: TransactionFilters, search: SearchArguments): boolean {
  const otherFilters = TRANSACTION_FILTER_KEYS.filter((key) => key !== 'accountIds');
  return (
    search.terms.length === 0 &&
    search.amount === null &&
    otherFilters.every((key) => filters[key].length === 0)
  );
}
