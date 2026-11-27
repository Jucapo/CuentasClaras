import { inject, Injectable } from '@angular/core';
import { BudgetsService } from '../../core/budgets/budgets.service';
import { CategoriesService } from '../../core/categories/categories.service';
import { CategoryKind } from '../../core/categories/category.models';
import { CurrencyAmount, formatMoney } from '../../domain/money/money';
import {
  AmountPanel,
  AmountPanelData,
  AmountPanelResult,
} from '../../shared/ui/molecules/amount-panel/amount-panel';
import { MONEY_FORMAT } from '../../shared/ui/money/money-format';
import { BudgetListEntry } from '../../shared/ui/organisms/budget-list/budget-list';
import { OverlayService } from '../../shared/ui/services/overlay.service';
import { ToastService } from '../../shared/ui/services/toast.service';

/** Texts of the amount sheet for each kind: budget or expected income. */
const AMOUNT_TEXT: Readonly<Record<CategoryKind, { title: string; label: string; saved: string }>> =
  {
    expense: {
      title: 'Presupuesto de',
      label: 'Presupuesto mensual',
      saved: 'Presupuesto guardado.',
    },
    income: {
      title: 'Ingreso esperado de',
      label: 'Ingreso mensual esperado',
      saved: 'Ingreso esperado guardado.',
    },
  };

/**
 * Monthly amounts per top-level category (spec §4.7): budgets of expense categories and expected
 * incomes of income ones, listed for `cc-budget-list` and typed in the amount sheet.
 */
@Injectable({ providedIn: 'root' })
export class MonthlyAmounts {
  private readonly budgets = inject(BudgetsService);
  private readonly categories = inject(CategoriesService);
  private readonly overlay = inject(OverlayService);
  private readonly toast = inject(ToastService);
  private readonly format = inject(MONEY_FORMAT);

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

  /** Opens the amount sheet of a category and saves what is typed; 0 removes the amount. */
  async edit(categoryId: string): Promise<void> {
    const category = this.categories.find(categoryId);
    if (!category) {
      return;
    }
    const text = AMOUNT_TEXT[category.kind];
    const current = this.budgets.amountFor(category.id);
    const result = await this.overlay.open<AmountPanelResult, AmountPanelData>(AmountPanel, {
      label: `${text.title} ${category.name}`,
      autoFocus: 'input',
      data: {
        title: `${text.title} ${category.name}`,
        label: text.label,
        hint: 'Se repite cada mes hasta que lo cambies. Escribe 0 para quitarlo.',
        currency: current?.currency ?? this.budgets.mainCurrency(),
        currencyEditable: true,
        value: current?.amount ?? null,
        requiredMessage: 'Escribe el monto; puede ser 0.',
      },
    });
    if (!result) {
      return;
    }
    const saved = await this.budgets.setMonthly(category.id, result.amount, result.currency);
    void this.toast.show(saved.ok ? text.saved : saved.message);
  }
}
