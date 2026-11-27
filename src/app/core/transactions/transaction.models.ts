import { IsoDate } from '../../domain/dates/local-date';
import { Tables } from '../supabase/database.types';

/** A movement as lists show it: the row, its tags, who recorded it and its card deferral. */
export type Transaction = Tables<'transactions'> & {
  readonly tag_ids: readonly string[];
  /** Display name of who recorded it, for "Cuenta privada de X" (spec §3.2). */
  readonly author_name: string | null;
  /** Installments of its card deferral; 1 without one (spec §5.1 c). */
  readonly installments: number;
  /** Monthly rate of its card deferral, as a fraction (0.0189 = 1,89 %). */
  readonly monthly_rate: number;
};

/** What the quick entry saves (spec §4.2). Amounts are positive minor units. */
export interface TransactionEntry {
  /** Generated when the entry opens, so a retry updates instead of duplicating. */
  readonly id: string;
  readonly type: Tables<'transactions'>['type'];
  readonly date: IsoDate;
  readonly amount: number;
  readonly accountId: string;
  readonly categoryId: string | null;
  readonly toAccountId: string | null;
  /** What arrived, only when the destination has another currency. */
  readonly toAmount: number | null;
  readonly adjustmentDirection: Tables<'transactions'>['adjustment_direction'];
  readonly note: string;
  /** Null lets the account decide (new) or keeps what was stored (edit). */
  readonly includeInSpace: boolean | null;
  readonly tagIds: readonly string[];
  /** 1 means no card deferral. */
  readonly installments: number;
  /** Monthly rate of the deferral, as a fraction. */
  readonly monthlyRate: number;
}

/** A page of movements, newest first. */
export interface TransactionPage {
  readonly items: readonly Transaction[];
  readonly hasMore: boolean;
}
