import { Component, input, output } from '@angular/core';
import { BudgetFigures } from '../../../../domain/budgets/budget-lines';
import { Button } from '../../atoms/button/button';
import { BudgetKind } from '../../molecules/budget-pill/budget-pill';
import { BudgetRow } from '../../molecules/budget-row/budget-row';
import { OverlayPanel } from '../../molecules/overlay-panel/overlay-panel';
import { BudgetAmountChange, BudgetList, BudgetListEntry } from '../budget-list/budget-list';

/** What the detail of a category shows (spec §4.7). */
export interface BudgetDetailData {
  /** The category name. */
  readonly title: string;
  readonly color: string | null;
  /** The period, e.g. "1 dic – 31 dic". */
  readonly period: string;
  readonly kind: BudgetKind;
  /** The whole category, in the main currency. */
  readonly figures: BudgetFigures;
  readonly counted: boolean;
  readonly currency: string;
  /** "General" and the subcategories, each with `progress`. */
  readonly lines: readonly BudgetListEntry[];
  /** Amounts shown without editing them: a year, or a reader. */
  readonly readonly: boolean;
  /** E.g. which scope the edits take. */
  readonly note?: string;
}

const BUDGET_DETAIL_TEXT = {
  lines: (category: string) => `Presupuesto de ${category}`,
  empty: 'Sin presupuesto',
  transactions: 'Ver transacciones',
  remove: 'Quitar presupuesto',
} as const;

/**
 * The detail of a budget category (spec §4.7): the period with what was spent, left and budgeted,
 * the rows of its "General" and its subcategories, typed in each row (or shown, when read-only),
 * and the actions "Ver transacciones" and "Quitar presupuesto". The same organism goes in the
 * detail pane and, through `cc-budget-detail-sheet`, in a sheet.
 */
@Component({
  selector: 'cc-budget-detail',
  imports: [OverlayPanel, BudgetRow, BudgetList, Button],
  templateUrl: './budget-detail.html',
  styleUrl: './budget-detail.scss',
})
export class BudgetDetail {
  readonly detail = input.required<BudgetDetailData>();
  readonly changed = output<BudgetAmountChange>();
  /** The calculator of a line, by its id. */
  readonly calculate = output<string>();
  readonly transactions = output<void>();
  readonly remove = output<void>();
  readonly closed = output<void>();

  protected readonly text = BUDGET_DETAIL_TEXT;
}
