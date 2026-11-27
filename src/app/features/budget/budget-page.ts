import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BudgetsService } from '../../core/budgets/budgets.service';
import { ExchangeRateFlow } from '../../core/exchange-rates/exchange-rate-flow';
import { PeriodService } from '../../core/periods/period.service';
import { APP_PATHS } from '../../core/routing/app-paths';
import { SpaceService } from '../../core/spaces/space.service';
import { TotalsService } from '../../core/totals/totals.service';
import { BudgetFigures, kindBudgetFigures } from '../../domain/budgets/budget-lines';
import { BudgetEditScope } from '../../domain/budgets/budget-scope';
import { formatMoney } from '../../domain/money/money';
import { periodContaining } from '../../domain/periods/periods';
import { Button } from '../../shared/ui/atoms/button/button';
import { Icon } from '../../shared/ui/atoms/icon/icon';
import { Message } from '../../shared/ui/atoms/message/message';
import {
  SegmentedControl,
  SegmentOption,
} from '../../shared/ui/atoms/segmented-control/segmented-control';
import { Switch } from '../../shared/ui/atoms/switch/switch';
import { BudgetRow } from '../../shared/ui/molecules/budget-row/budget-row';
import { FormActions } from '../../shared/ui/molecules/form-actions/form-actions';
import { Section } from '../../shared/ui/molecules/section/section';
import { ConfirmOptions } from '../../shared/ui/molecules/confirm-panel/confirm-panel';
import { MONEY_FORMAT } from '../../shared/ui/money/money-format';
import { AmountCalculatorData } from '../../shared/ui/organisms/amount-calculator/amount-calculator';
import { AmountCalculatorSheet } from '../../shared/ui/organisms/amount-calculator-sheet/amount-calculator-sheet';
import {
  budgetCalculatorData,
  BudgetDetail,
  BudgetDetailData,
} from '../../shared/ui/organisms/budget-detail/budget-detail';
import {
  BudgetDetailIntent,
  BudgetDetailSheet,
  BudgetDetailSheetData,
} from '../../shared/ui/organisms/budget-detail-sheet/budget-detail-sheet';
import {
  BudgetAmountChange,
  BudgetListEntry,
} from '../../shared/ui/organisms/budget-list/budget-list';
import { MissingRatesNotice } from '../../shared/ui/organisms/missing-rates-notice/missing-rates-notice';
import { ConfirmService } from '../../shared/ui/services/confirm.service';
import { LayoutService } from '../../shared/ui/services/layout.service';
import { OverlayService } from '../../shared/ui/services/overlay.service';
import { ToastService } from '../../shared/ui/services/toast.service';
import { ListDetailLayout } from '../../shared/ui/templates/list-detail-layout/list-detail-layout';
import { TransactionFiltersStore } from '../transactions/transaction-filters.store';
import {
  BUDGET_TEXT,
  keepsOwnHint,
  monthOnlyMark,
  removeConfirm,
  scopeLabels,
  scopeNote,
} from './budget-texts';
import { BudgetCategoryView } from './budget-views';
import { BudgetEdit, MonthlyAmounts } from './monthly-amounts';

/** What the screen shows for the selected period and the budget switch (spec §4.7). */
type BudgetView = 'off' | 'month' | 'year' | 'none';

// Amounts from the calculator or "Quitar presupuesto" have no row text to put back: the row reads
// the saved amount.
const NOTHING_TO_REVERT = (): void => undefined;

/**
 * Presupuesto (spec §4.7, §7), like 1Money: each category with its total, the bar behind its row
 * and what is left in a pill, under the total of its section. A category opens its detail, with
 * its "General" and its subcategories typed in their rows (or with the calculator), in a sheet or
 * beside the list. A month's amounts are edited with the scope chosen on top; a year adds up its
 * months without editing.
 */
@Component({
  selector: 'app-budget-page',
  imports: [
    Section,
    FormActions,
    Button,
    Icon,
    Message,
    Switch,
    SegmentedControl,
    BudgetRow,
    BudgetDetail,
    MissingRatesNotice,
    ListDetailLayout,
  ],
  templateUrl: './budget-page.html',
  styleUrl: './budget-page.scss',
})
export class BudgetPage {
  private readonly budgets = inject(BudgetsService);
  private readonly spaces = inject(SpaceService);
  private readonly periods = inject(PeriodService);
  private readonly totals = inject(TotalsService);
  private readonly rateFlow = inject(ExchangeRateFlow);
  private readonly overlay = inject(OverlayService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly layout = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly filters = inject(TransactionFiltersStore);
  private readonly format = inject(MONEY_FORMAT);
  private readonly amounts = inject(MonthlyAmounts);

  protected readonly text = BUDGET_TEXT;
  protected readonly canEdit = this.spaces.canEdit;
  protected readonly canConfigure = this.spaces.canConfigure;
  protected readonly currency = this.amounts.mainCurrency;

  protected readonly view = computed<BudgetView>(() => {
    if (!(this.spaces.activeSettings()?.budgets_enabled ?? true)) {
      return 'off';
    }
    const kind = this.periods.period().kind;
    return kind === 'month' || kind === 'year' ? kind : 'none';
  });
  /** The month being edited (`YYYY-MM-01`); null in a year. */
  private readonly month = computed(() =>
    this.view() === 'month' ? (this.periods.budgetMonths()[0] ?? null) : null,
  );
  protected readonly editable = computed(() => this.month() !== null && this.canEdit());

  /** "Solo {mes}" by default; it applies to every row edited until it changes. */
  protected readonly scope = signal<BudgetEditScope>('month');
  private readonly scopeTexts = computed(() => {
    const month = this.month();
    return month ? scopeLabels(month, this.periods.today()) : null;
  });
  protected readonly scopeOptions = computed<SegmentOption<BudgetEditScope>[]>(() => {
    const labels = this.scopeTexts();
    return labels
      ? [
          { value: 'month', label: labels.month },
          { value: 'onward', label: labels.onward },
        ]
      : [];
  });

  private readonly totalOf = (categoryId: string) => this.totals.find(categoryId);
  protected readonly expenses = computed(() =>
    this.amounts.categoryViews('expense', this.month(), this.totalOf),
  );
  protected readonly incomes = computed(() =>
    this.amounts.categoryViews('income', this.month(), this.totalOf),
  );

  /** Every budget against everything spent; what went to categories without one goes apart. */
  protected readonly expenseTotal = computed<BudgetFigures>(() =>
    kindBudgetFigures(
      this.totals.kindTotal('expense'),
      this.expenses().map((category) => category.figures),
    ),
  );
  protected readonly unbudgetedNote = computed(() => {
    const unbudgeted = this.expenses()
      .filter((category) => !category.figures.budget)
      .reduce((sum, category) => sum + category.figures.spent, 0);
    return unbudgeted > 0
      ? `${BUDGET_TEXT.unbudgeted} ${formatMoney(unbudgeted, this.currency(), this.format())}`
      : undefined;
  });
  protected readonly incomeTotal = computed<BudgetFigures>(() =>
    kindBudgetFigures(
      this.totals.kindTotal('income'),
      this.incomes().map((category) => category.figures),
    ),
  );
  protected readonly missingRates = this.totals.missingRateCurrencies;
  protected readonly totalsError = this.totals.categoryTotalsError;

  /** The category open beside the list (expanded class). */
  protected readonly selectedId = signal<string | null>(null);
  protected readonly paneDetail = computed(() => {
    const id = this.selectedId();
    return id && this.layout.isExpanded() ? this.detailFor(id) : null;
  });
  /** The category open in a sheet (compact and medium classes). */
  private readonly sheetId = signal<string | null>(null);
  private readonly sheetDetail = computed(() => {
    const id = this.sheetId();
    return id ? this.detailFor(id) : null;
  });

  protected open(categoryId: string): void {
    if (this.layout.isExpanded()) {
      this.selectedId.set(categoryId);
    } else {
      void this.openSheet(categoryId);
    }
  }

  protected closePane(): void {
    this.selectedId.set(null);
  }

  protected save(change: BudgetAmountChange): void {
    void this.saveChange(change);
  }

  /** The calculator of a line in the pane, as a dialog; its result is saved with the scope. */
  protected async calculate(categoryId: string, lineId: string): Promise<void> {
    const detail = this.detailFor(categoryId);
    const data = detail && budgetCalculatorData(detail, lineId);
    if (!data || !this.edit()) {
      return;
    }
    const value = await this.overlay.open<number, AmountCalculatorData>(AmountCalculatorSheet, {
      label: data.title,
      size: 'calculator',
      data,
    });
    if (value !== undefined) {
      await this.saveChange({
        categoryId: lineId,
        amount: value,
        currency: data.currency,
        revert: NOTHING_TO_REVERT,
      });
    }
  }

  /** "Quitar presupuesto" in the pane, after asking. */
  protected async remove(categoryId: string): Promise<void> {
    const question = this.removeQuestion(categoryId);
    if (question && (await this.confirm.confirm(question))) {
      await this.removeBudget(categoryId);
    }
  }

  /** Transacciones with the category as filter, in the same global period. */
  protected viewTransactions(categoryId: string): void {
    this.filters.reset();
    this.filters.set('categoryIds', [categoryId]);
    void this.router.navigate(['/', APP_PATHS.transactions]);
  }

  protected showThisMonth(): void {
    this.periods.select(periodContaining('month', this.periods.today(), this.periods.settings()));
  }

  protected async enable(on: boolean): Promise<void> {
    if (!on) {
      return;
    }
    const saved = await this.spaces.updateActiveSettings({ budgets_enabled: true });
    if (!saved.ok) {
      void this.toast.show(saved.message);
    }
  }

  protected defineRate(currency: string): void {
    void this.rateFlow.open(currency);
  }

  /**
   * The detail in a sheet (a dialog in the medium class). The calculator and the confirmation to
   * remove are views inside it (spec §13.5); only "Ver transacciones" closes it.
   */
  private async openSheet(categoryId: string): Promise<void> {
    this.sheetId.set(categoryId);
    const intent = await this.overlay.open<BudgetDetailIntent, BudgetDetailSheetData>(
      BudgetDetailSheet,
      {
        label: this.find(categoryId)?.name ?? BUDGET_TEXT.title,
        size: 'entry',
        data: {
          detail: this.sheetDetail,
          save: (change) => this.saveChange(change),
          removeQuestion: () => this.removeQuestion(categoryId),
          remove: () => this.removeBudget(categoryId),
        },
      },
    );
    this.sheetId.set(null);
    if (intent === 'transactions') {
      this.viewTransactions(categoryId);
    }
  }

  /** Saves with the scope of the edit; false when it failed (already told) or is read-only. */
  private async saveChange(change: BudgetAmountChange): Promise<boolean> {
    const edit = this.edit();
    return edit ? (await this.amounts.save(change, edit)).ok : false;
  }

  private removeQuestion(categoryId: string): ConfirmOptions | null {
    const category = this.find(categoryId);
    const edit = this.edit();
    const labels = this.scopeTexts();
    if (!category || !edit || !labels) {
      return null;
    }
    return { ...removeConfirm(category.name, labels[edit.scope]), destructive: true };
  }

  /** "Quitar presupuesto": 0 in its General and each subcategory with an amount, with the scope. */
  private async removeBudget(categoryId: string): Promise<boolean> {
    const category = this.find(categoryId);
    const edit = this.edit();
    if (!category || !edit) {
      return false;
    }
    for (const line of category.lines) {
      if (line.amount && line.amount.amount > 0) {
        const saved = await this.amounts.save(
          {
            categoryId: line.id,
            amount: 0,
            currency: line.amount.currency,
            revert: NOTHING_TO_REVERT,
          },
          edit,
        );
        if (!saved.ok) {
          return false;
        }
      }
    }
    return true;
  }

  private edit(): BudgetEdit | null {
    const month = this.month();
    return month && this.canEdit() ? { month, scope: this.scope() } : null;
  }

  private find(categoryId: string): BudgetCategoryView | null {
    return [...this.expenses(), ...this.incomes()].find((view) => view.id === categoryId) ?? null;
  }

  private periodText(): string {
    return this.periods.rangeText() || this.periods.title();
  }

  private detailFor(categoryId: string): BudgetDetailData | null {
    const category = this.find(categoryId);
    if (!category) {
      return null;
    }
    const month = this.month();
    const today = this.periods.today();
    const editable = this.editable();
    const labels = this.scopeTexts();
    return {
      title: category.name,
      color: category.color,
      period: this.periodText(),
      kind: category.kind,
      figures: category.figures,
      counted: category.counted,
      currency: this.currency(),
      readonly: !editable,
      note:
        editable && labels
          ? scopeNote(labels[this.scope()])
          : this.view() === 'year'
            ? BUDGET_TEXT.yearNote
            : undefined,
      lines: category.lines.map((line): BudgetListEntry => {
        const keeps = this.scope() === 'onward' && line.keepsOwnFrom;
        return {
          id: line.id,
          name: line.name,
          icon: line.icon,
          color: line.color,
          amount: line.amount,
          progress: {
            ...line.figures,
            currency: this.currency(),
            kind: category.kind,
            counted: category.counted,
          },
          ...(month && line.monthOnly ? { mark: monthOnlyMark(month, today) } : {}),
          ...(keeps ? { hint: keepsOwnHint(keeps, today) } : {}),
        };
      }),
    };
  }
}
