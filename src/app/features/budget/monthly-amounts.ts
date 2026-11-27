import { inject, Injectable } from '@angular/core';
import { ACTION_OK, ActionResult } from '../../core/action-result';
import { BudgetsService } from '../../core/budgets/budgets.service';
import { CategoriesService } from '../../core/categories/categories.service';
import { Category, CategoryKind } from '../../core/categories/category.models';
import { PendingSaves } from '../../core/saving/pending-saves';
import { CategoryTotal } from '../../core/totals/totals.models';
import { BudgetFigures, generalFigures } from '../../domain/budgets/budget-lines';
import { BudgetEditScope, isMonthOnly, nextOwnMonth } from '../../domain/budgets/budget-scope';
import { effectiveColor } from '../../domain/categories/category-tree';
import { IsoDate } from '../../domain/dates/local-date';
import { CurrencyAmount, formatMoney } from '../../domain/money/money';
import { MONEY_FORMAT } from '../../shared/ui/money/money-format';
import {
  BudgetAmountChange,
  BudgetListEntry,
} from '../../shared/ui/organisms/budget-list/budget-list';
import { ToastService } from '../../shared/ui/services/toast.service';
import { BUDGET_TEXT } from './budget-texts';
import { BudgetCategoryView, BudgetLineView } from './budget-views';

/** Where an amount typed in the Presupuesto screen applies (spec §4.7). */
export interface BudgetEdit {
  /** First day of the month being edited. */
  readonly month: IsoDate;
  readonly scope: BudgetEditScope;
}

/**
 * Monthly amounts per category (spec §4.7): budgets of expense categories and expected incomes of
 * income ones. The wizard lists and types them per top-level category; the Presupuesto screen per
 * category and subcategory, with what was spent against them.
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

  /** Top-level categories of a kind with their amount this period (the wizard). */
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

  /**
   * The categories of a kind for the Presupuesto screen, each with its "General" and its
   * subcategories (spec §4.7). Figures come converted from `totalOf` (`category_totals`). In a
   * `month` each line holds its amount in force there, in its currency, to edit it; in a year (`month`
   * null) it holds the sum of the 12 months.
   */
  categoryViews(
    kind: CategoryKind,
    month: IsoDate | null,
    totalOf: (categoryId: string) => CategoryTotal | null,
  ): BudgetCategoryView[] {
    const figuresOf = (id: string): BudgetFigures => {
      const total = totalOf(id);
      return { spent: total?.amount ?? 0, budget: total?.budget ?? null };
    };
    return this.categories.tree(kind).map(({ category, children }) => {
      const figures = figuresOf(category.id);
      const subcategories = children.map((child) =>
        this.line(child, effectiveColor(child, category), figuresOf(child.id), month),
      );
      const general = this.line(
        category,
        category.color,
        generalFigures(
          figures,
          subcategories.map((line) => line.figures),
        ),
        month,
        BUDGET_TEXT.general,
      );
      return {
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        kind,
        figures,
        counted: kind === 'expense' && (figures.budget ?? 0) > 0,
        lines: [general, ...subcategories],
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
   * Saves the amount typed in a row (spec §13.5): from this period on, as in the wizard, or in a
   * month with the scope of the edit (the Presupuesto screen). An empty row changes nothing and gets
   * its amount back; 0 removes the amount. A failed save tells why and the row goes back to what it
   * had. Screens that leave wait for the save through `PendingSaves`.
   */
  save(change: BudgetAmountChange, edit?: BudgetEdit): Promise<ActionResult> {
    return this.pendingSaves.track(this.persist(change, edit));
  }

  private async persist(change: BudgetAmountChange, edit?: BudgetEdit): Promise<ActionResult> {
    if (change.amount === null) {
      change.revert();
      return ACTION_OK;
    }
    const saved = edit
      ? await this.budgets.setAmount(
          change.categoryId,
          change.amount,
          change.currency,
          edit.month,
          edit.scope,
        )
      : await this.budgets.setMonthly(change.categoryId, change.amount, change.currency);
    if (!saved.ok) {
      change.revert();
      void this.toast.show(saved.message);
    }
    return saved;
  }

  private line(
    category: Category,
    color: string | null,
    figures: BudgetFigures,
    month: IsoDate | null,
    name = category.name,
  ): BudgetLineView {
    const entries = this.budgets.budgets();
    const inForce = month ? this.budgets.amountFor(category.id, month) : null;
    let amount: CurrencyAmount | null = null;
    if (month) {
      amount = inForce ? { amount: inForce.amount, currency: inForce.currency } : null;
    } else if (figures.budget) {
      amount = { amount: figures.budget, currency: this.mainCurrency() };
    }
    return {
      id: category.id,
      name,
      icon: category.icon,
      color,
      figures,
      amount,
      monthOnly: month ? isMonthOnly(entries, category.id, month) : false,
      keepsOwnFrom: month ? nextOwnMonth(entries, category.id, month) : null,
    };
  }
}
