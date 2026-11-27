import { Component, computed, input } from '@angular/core';
import { BudgetStanding } from '../../../../domain/budgets/budget-lines';
import { Amount } from '../../atoms/amount/amount';

/** An expense budget, or the expected income of an income category (spec §4.7). */
export type BudgetKind = 'expense' | 'income';

const STANDING_TEXT = {
  expense: { left: 'Quedan', over: 'Te pasaste por' },
  income: { left: 'Faltan', over: 'Recibiste de más' },
} as const;

/**
 * What is left of a budget, or how much went over it, in a pill (spec §4.7). Going over an expense
 * budget stands out in the error color; receiving more than expected is good news. Nothing without
 * a budget.
 */
@Component({
  selector: 'cc-budget-pill',
  imports: [Amount],
  templateUrl: './budget-pill.html',
  styleUrl: './budget-pill.scss',
})
export class BudgetPill {
  readonly standing = input.required<BudgetStanding>();
  readonly currency = input.required<string>();
  readonly kind = input<BudgetKind>('expense');

  protected readonly amount = computed(() => {
    const standing = this.standing();
    return standing.kind === 'none' ? null : standing.amount;
  });
  protected readonly over = computed(() => this.standing().kind === 'over');
  protected readonly prefix = computed(() => {
    const standing = this.standing();
    return standing.kind === 'none' ? '' : STANDING_TEXT[this.kind()][standing.kind];
  });
}
