import { CategoryKind } from '../../core/categories/category.models';
import { BudgetFigures } from '../../domain/budgets/budget-lines';
import { IsoDate } from '../../domain/dates/local-date';
import { CurrencyAmount } from '../../domain/money/money';

/** A row of a category's detail: its "General" or one of its subcategories (spec §4.7). */
export interface BudgetLineView {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string | null;
  /** In the main currency, from `category_totals`. */
  readonly figures: BudgetFigures;
  /** What its row holds: the amount in force that month in its currency, or the year's sum. */
  readonly amount: CurrencyAmount | null;
  /** The month's amount is its own and differs from the next month's: "Solo {mes}". */
  readonly monthOnly: boolean;
  /** The first later month with its own amount, which an edit "y los siguientes" keeps. */
  readonly keepsOwnFrom: IsoDate | null;
}

/** A top-level category of the Presupuesto screen with its lines (spec §4.7). */
export interface BudgetCategoryView {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string | null;
  readonly kind: CategoryKind;
  /** The category: its own amount plus its subcategories', against everything spent in it. */
  readonly figures: BudgetFigures;
  /** Whether its expense lines without a budget count as over (the category has one). */
  readonly counted: boolean;
  /** "General" first, then the active subcategories in their order. */
  readonly lines: readonly BudgetLineView[];
}
