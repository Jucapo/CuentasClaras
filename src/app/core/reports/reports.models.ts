import { Enums } from '../supabase/database.types';

/** What a report splits the movements by (spec §6): tag, account or person who recorded them. */
export type ReportDimension = Enums<'report_dimension'>;

/** What one day added to a top-level category, in the main currency (spec §6). */
export interface DailyCategoryTotal {
  readonly date: string;
  readonly categoryId: string;
  readonly kind: Enums<'category_kind'>;
  readonly amount: number;
  readonly missingRateCurrencies: readonly string[];
}

/** The movements of a kind with one tag, account or person, in the main currency (spec §6). */
export interface BreakdownTotal {
  /**
   * The tag, account or person. Null groups the untagged movements, or the included ones of other
   * members' private accounts.
   */
  readonly key: string | null;
  readonly kind: Enums<'category_kind'>;
  readonly amount: number;
  readonly movements: number;
  readonly missingRateCurrencies: readonly string[];
}
