import { Tables } from '../supabase/database.types';

/** A manual exchange rate of the space: 1 `base` = `rate` `quote` (spec §4.6). */
export type ExchangeRate = Tables<'exchange_rates'>;

/** What the rate sheet saves. */
export interface ExchangeRateEntry {
  readonly date: string;
  readonly base: string;
  readonly quote: string;
  readonly rate: number;
}
