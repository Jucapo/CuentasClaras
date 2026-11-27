import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BudgetsService } from '../../core/budgets/budgets.service';
import { ExchangeRateFlow } from '../../core/exchange-rates/exchange-rate-flow';
import { PeriodService } from '../../core/periods/period.service';
import { APP_PATHS } from '../../core/routing/app-paths';
import { SpaceService } from '../../core/spaces/space.service';
import { TotalsService } from '../../core/totals/totals.service';
import { BudgetFigures } from '../../domain/budgets/budget-lines';
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
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../shared/ui/molecules/section/section';
import { MONEY_FORMAT } from '../../shared/ui/money/money-format';
import {
  AmountCalculator,
  AmountCalculatorData,
} from '../../shared/ui/organisms/amount-calculator/amount-calculator';
import {
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
import { BudgetCategoryView, BudgetLineView } from './budget-views';
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
    PageHeader,
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
  protected readonly expenseTotal = computed<BudgetFigures>(() => ({
    spent: this.totals.kindTotal('expense'),
    budget: this.sumBudgets(this.expenses()),
  }));
  protected readonly unbudgetedNote = computed(() => {
    const unbudgeted = this.expenses()
      .filter((category) => !category.figures.budget)
      .reduce((sum, category) => sum + category.figures.spent, 0);
    return unbudgeted > 0
      ? `${BUDGET_TEXT.unbudgeted} ${formatMoney(unbudgeted, this.currency(), this.format())}`
      : undefined;
  });
  protected readonly incomeTotal = computed<BudgetFigures>(() => ({
    spent: this.totals.kindTotal('income'),
    budget: this.sumBudgets(this.incomes()),
  }));
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
    const edit = this.edit();
    if (edit) {
      void this.amounts.save(change, edit);
    }
  }

  /** The calculator of a line; its result is saved with the scope of the edit. */
  protected async calculate(categoryId: string, lineId: string): Promise<void> {
    const category = this.find(categoryId);
    const line = category?.lines.find((candidate) => candidate.id === lineId);
    const edit = this.edit();
    if (!category || !line || !edit) {
      return;
    }
    const currency = line.amount?.currency ?? this.currency();
    const value = await this.overlay.open<number, AmountCalculatorData>(AmountCalculator, {
      label: this.lineTitle(category, line),
      size: 'calculator',
      data: {
        title: this.lineTitle(category, line),
        period: this.periodText(),
        figures: line.figures,
        figuresCurrency: this.currency(),
        kind: category.kind,
        counted: category.counted,
        color: line.color,
        label: category.kind === 'income' ? BUDGET_TEXT.expectedLabel : BUDGET_TEXT.calculatorLabel,
        value: line.amount?.amount ?? null,
        currency,
      },
    });
    if (value !== undefined) {
      await this.amounts.save(
        { categoryId: line.id, amount: value, currency, revert: NOTHING_TO_REVERT },
        edit,
      );
    }
  }

  /** "Quitar presupuesto": 0 in its General and each subcategory with an amount, after asking. */
  protected async remove(categoryId: string): Promise<void> {
    const category = this.find(categoryId);
    const edit = this.edit();
    const labels = this.scopeTexts();
    if (!category || !edit || !labels) {
      return;
    }
    const confirmed = await this.confirm.confirm({
      ...removeConfirm(category.name, labels[edit.scope]),
      destructive: true,
    });
    if (!confirmed) {
      return;
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
          return;
        }
      }
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
   * The detail in a sheet. A sheet never opens another (spec §13.5): it closes with what to do,
   * and after the calculator or removing the budget it opens again on the same category.
   */
  private async openSheet(categoryId: string): Promise<void> {
    this.sheetId.set(categoryId);
    const intent = await this.overlay.open<BudgetDetailIntent, BudgetDetailSheetData>(
      BudgetDetailSheet,
      {
        label: this.find(categoryId)?.name ?? BUDGET_TEXT.title,
        size: 'entry',
        data: { detail: this.sheetDetail, save: (change) => this.save(change) },
      },
    );
    this.sheetId.set(null);
    if (!intent) {
      return;
    }
    switch (intent.kind) {
      case 'calculate':
        await this.calculate(categoryId, intent.lineId);
        return this.openSheet(categoryId);
      case 'remove':
        await this.remove(categoryId);
        return this.openSheet(categoryId);
      case 'transactions':
        this.viewTransactions(categoryId);
    }
  }

  private edit(): BudgetEdit | null {
    const month = this.month();
    return month && this.canEdit() ? { month, scope: this.scope() } : null;
  }

  private find(categoryId: string): BudgetCategoryView | null {
    return [...this.expenses(), ...this.incomes()].find((view) => view.id === categoryId) ?? null;
  }

  private sumBudgets(views: readonly BudgetCategoryView[]): number | null {
    const budgets = views.map((view) => view.figures.budget ?? 0);
    const total = budgets.reduce((sum, budget) => sum + budget, 0);
    return total > 0 ? total : null;
  }

  private periodText(): string {
    return this.periods.rangeText() || this.periods.title();
  }

  private lineTitle(category: BudgetCategoryView, line: BudgetLineView): string {
    return `${category.name} › ${line.name}`;
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
