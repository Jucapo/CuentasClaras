import { Enums } from '../supabase/database.types';

/** What a category got in a period, in the main currency (spec §4.7, §7). */
export interface CategoryTotal {
  readonly categoryId: string;
  readonly parentId: string | null;
  readonly kind: Enums<'category_kind'>;
  /** Spent (expenses) or received (incomes); a category includes its subcategories. */
  readonly amount: number;
  /** Budget or expected income in force; null without one, and always null in subcategories. */
  readonly budget: number | null;
  /** Budget minus amount; negative when it went over. */
  readonly remaining: number | null;
  /** Currencies left out for lack of a rate. */
  readonly missingRateCurrencies: readonly string[];
}

/** Incomes, expenses and net of the movements of Transacciones, in the main currency (spec §7). */
export interface TransactionTotals {
  readonly income: number;
  readonly expense: number;
  /** Incomes minus expenses. */
  readonly net: number;
  /**
   * How much of `income` and `expense` comes from accounts outside the space (own private ones,
   * not included): what makes them differ from Inicio and Presupuesto (spec §7, §8).
   */
  readonly outsideSpace: { readonly income: number; readonly expense: number };
  readonly currency: string;
  readonly missingRateCurrencies: readonly string[];
}

/** Balance of the accounts included in the total, in the main currency. */
export interface AccountsTotal {
  readonly total: number;
  readonly currency: string;
  readonly missingRateCurrencies: readonly string[];
}
