import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import {
  budgetFill,
  BudgetFigures,
  budgetStanding,
} from '../../../../domain/budgets/budget-lines';
import { Amount } from '../../atoms/amount/amount';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { ProgressBar } from '../../atoms/progress-bar/progress-bar';
import { BudgetKind, BudgetPill } from '../budget-pill/budget-pill';

const BUDGET_ROW_TEXT = {
  spent: { expense: 'gastado', income: 'recibido' },
  budgeted: { expense: 'presupuestado', income: 'esperado' },
  none: 'Sin presupuesto',
  bar: (name: string) => `Avance de ${name}`,
} as const;

/**
 * A budget row like 1Money's (spec §4.7): the bar fills the background in a soft tone of the
 * category, with its name and what was spent on the left, and what is left (or went over) in a
 * pill with what was budgeted on the right. Rows of a category open its detail (`actionable`); the
 * totals of a section and the header of a detail use `emphasis="total"`.
 */
@Component({
  selector: 'cc-budget-row',
  imports: [NgTemplateOutlet, Amount, IconBadge, ProgressBar, BudgetPill],
  templateUrl: './budget-row.html',
  styleUrl: './budget-row.scss',
  host: { '[class.total]': "emphasis() === 'total'" },
})
export class BudgetRow {
  readonly name = input.required<string>();
  /** Icon key of the badge; none in a total. */
  readonly icon = input<string | null>(null);
  /** Palette key of the badge and of the bar. */
  readonly color = input<string | null>(null);
  readonly figures = input.required<BudgetFigures>();
  readonly currency = input.required<string>();
  readonly kind = input<BudgetKind>('expense');
  /** Spending without a budget counts as over it (a line of a category that has one). */
  readonly counted = input(false);
  /** A line under what was spent, e.g. what went to categories without a budget. */
  readonly note = input<string>();
  readonly actionable = input(false);
  /** Open beside the list. */
  readonly selected = input(false);
  readonly emphasis = input<'item' | 'total'>('item');
  readonly activate = output<void>();

  protected readonly text = BUDGET_ROW_TEXT;
  protected readonly standing = computed(() => budgetStanding(this.figures(), this.counted()));
  protected readonly fill = computed(() => budgetFill(this.figures(), this.counted()));
  protected readonly barLabel = computed(() => BUDGET_ROW_TEXT.bar(this.name()));
}
