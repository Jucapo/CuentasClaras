import { inject, Injectable } from '@angular/core';
import { ACTION_OK, ActionResult } from '../../core/action-result';
import { BudgetsService } from '../../core/budgets/budgets.service';
import { CategoriesService } from '../../core/categories/categories.service';
import { CategoryKind } from '../../core/categories/category.models';
import { PendingSaves } from '../../core/saving/pending-saves';
import { CurrencyAmount, formatMoney } from '../../domain/money/money';
import { MONEY_FORMAT } from '../../shared/ui/money/money-format';
import {
  BudgetAmountChange,
  BudgetListEntry,
} from '../../shared/ui/organisms/budget-list/budget-list';
import { ToastService } from '../../shared/ui/services/toast.service';

/**
 * Monthly amounts per top-level category (spec §4.7): budgets of expense categories and expected
 * incomes of income ones, listed for `cc-budget-list` and typed in its rows.
 */
@Injectable({ providedIn: 'root' })
export class MonthlyAmounts {
  private readonly budgets = inject(BudgetsService);
  private readonly categories = inject(CategoriesService);
  private readonly pendingSaves = inject(PendingSaves);
  private readonly toast = inject(ToastService);
  private readonly format = inject(MONEY_FORMAT);

  /** Currency of the rows without an amount. */
  readonly mainCurrency = this.budgets.mainCurrency;

  /** Top-level categories of a kind with their amount this period. */
  entries(kind: CategoryKind): BudgetListEntry[] {
    return this.categories.tree(kind).map(({ category }) => {
      const budget = this.budgets.amountFor(category.id);
      return {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        amount: budget ? { amount: budget.amount, currency: budget.currency } : null,
      };
    });
  }

  /** Monthly totals of a kind per currency (no conversion until F1d). */
  totals(kind: CategoryKind): CurrencyAmount[] {
    return this.budgets.totalsFor(this.categories.tree(kind).map(({ category }) => category.id));
  }

  /** How many categories of a kind have an amount. */
  count(kind: CategoryKind): number {
    return this.entries(kind).filter((entry) => entry.amount).length;
  }

  /** The totals of a kind as text, e.g. "$ 6,000,000.00 y US$ 500.00"; null without any. */
  totalsText(kind: CategoryKind): string | null {
    const format = this.format();
    const totals = this.totals(kind).map((total) =>
      formatMoney(total.amount, total.currency, format),
    );
    return totals.length > 0 ? totals.join(' y ') : null;
  }

  /**
   * Saves the amount typed in a row (spec §13.5). An empty row changes nothing and gets its amount
   * back; 0 removes the amount. A failed save tells why and the row goes back to what it had.
   * Screens that leave wait for the save through `PendingSaves`.
   */
  save(change: BudgetAmountChange): Promise<ActionResult> {
    return this.pendingSaves.track(this.persist(change));
  }

  private async persist(change: BudgetAmountChange): Promise<ActionResult> {
    if (change.amount === null) {
      change.revert();
      return ACTION_OK;
    }
    const saved = await this.budgets.setMonthly(change.categoryId, change.amount, change.currency);
    if (!saved.ok) {
      change.revert();
      void this.toast.show(saved.message);
    }
    return saved;
  }
}
