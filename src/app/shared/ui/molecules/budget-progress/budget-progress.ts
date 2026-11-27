import { Component, computed, input } from '@angular/core';
import { Amount } from '../../atoms/amount/amount';
import { Icon } from '../../atoms/icon/icon';
import { ProgressBar, ProgressTone } from '../../atoms/progress-bar/progress-bar';
import { UI_TEXT } from '../../ui.constants';

/** An expense budget, or the expected income of an income category (spec §4.7). */
export type BudgetProgressKind = 'expense' | 'income';

/** Where the progress goes: under a budget row, or as the total at the top of the screen. */
export type BudgetProgressEmphasis = 'row' | 'summary';

const BUDGET_PROGRESS_TEXT = {
  spent: 'Gastado',
  received: 'Recibido',
  left: 'Quedan',
  missing: 'Faltan',
  complete: 'Completo',
  extraBefore: 'Recibiste',
  extraAfter: 'de más',
  of: 'de',
  unbudgeted: 'Sin presupuesto:',
  overBy: `${UI_TEXT.overBudget} por`,
  bar: (label: string) => `Avance de ${label}`,
} as const;

/**
 * What was spent (or received) against the budget (or the expected income), 1Money style: a bar
 * and what remains. Exceeding a budget turns it to the error color with a warning; receiving more
 * than expected is good news.
 */
@Component({
  selector: 'cc-budget-progress',
  imports: [Amount, Icon, ProgressBar],
  templateUrl: './budget-progress.html',
  styleUrl: './budget-progress.scss',
  host: { '[class]': 'emphasis()' },
})
export class BudgetProgress {
  /** Minor units of `currency`. */
  readonly spent = input.required<number>();
  /** Null or 0 without a budget: only what was spent shows. */
  readonly budget = input.required<number | null>();
  readonly currency = input.required<string>();
  readonly kind = input<BudgetProgressKind>('expense');
  /** What the bar measures, e.g. the category name. */
  readonly label = input.required<string>();
  readonly emphasis = input<BudgetProgressEmphasis>('row');
  /** In the summary: spent in categories without a budget, shown apart when above zero. */
  readonly unbudgeted = input(0);

  protected readonly text = BUDGET_PROGRESS_TEXT;
  protected readonly hasBudget = computed(() => (this.budget() ?? 0) > 0);
  /** Budget minus spent: what remains, or what is missing to receive. */
  protected readonly difference = computed(() => (this.budget() ?? 0) - this.spent());
  protected readonly over = computed(() => this.hasBudget() && this.difference() < 0);
  protected readonly excess = computed(() => -this.difference());
  protected readonly isIncome = computed(() => this.kind() === 'income');
  protected readonly ratio = computed(() =>
    this.hasBudget() ? this.spent() / (this.budget() ?? 1) : 0,
  );
  protected readonly tone = computed<ProgressTone>(() => {
    if (this.isIncome()) {
      return 'positive';
    }
    return this.over() ? 'error' : 'primary';
  });
  protected readonly barLabel = computed(() => BUDGET_PROGRESS_TEXT.bar(this.label()));
}
