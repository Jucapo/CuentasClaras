import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AccountsService } from '../../core/accounts/accounts.service';
import { CategoriesService } from '../../core/categories/categories.service';
import { CategoryKind } from '../../core/categories/category.models';
import { TagsService } from '../../core/categories/tags.service';
import { SPACE_DEFAULTS } from '../../core/config/space.constants';
import { CHART_DAILY_MAX_BUCKETS } from '../../core/config/report.constants';
import { ExchangeRateFlow } from '../../core/exchange-rates/exchange-rate-flow';
import { PeriodService } from '../../core/periods/period.service';
import { ReportsService } from '../../core/reports/reports.service';
import { ReportDimension } from '../../core/reports/reports.models';
import { APP_PATHS } from '../../core/routing/app-paths';
import { SpaceMembersService } from '../../core/spaces/space-members.service';
import { SpaceService } from '../../core/spaces/space.service';
import { TotalsService } from '../../core/totals/totals.service';
import { BudgetFigures, kindBudgetFigures } from '../../domain/budgets/budget-lines';
import { formatMoney } from '../../domain/money/money';
import { periodMonth } from '../../domain/periods/period-month';
import {
  axisDayText,
  axisMonthText,
  dayTitle,
  periodTitle,
  rangeText,
} from '../../domain/periods/period-labels';
import { periodAverages, percentText, savingsRate, shareOf } from '../../domain/reports/averages';
import {
  bucketSize,
  CategoryAmount,
  chartBuckets,
  chartRange,
  chartTicks,
  rankCategories,
} from '../../domain/reports/chart';
import { compareTotals, comparisonText } from '../../domain/reports/comparison';
import { dateParts } from '../../domain/dates/local-date';
import {
  BarChart,
  BarChartBucket,
  BarChartSeries,
} from '../../shared/ui/atoms/bar-chart/bar-chart';
import { Amount } from '../../shared/ui/atoms/amount/amount';
import { Message } from '../../shared/ui/atoms/message/message';
import { ProgressRing } from '../../shared/ui/atoms/progress-ring/progress-ring';
import { TabOption, Tabs } from '../../shared/ui/atoms/tabs/tabs';
import { FALLBACK_COLOR } from '../../shared/ui/colors/color-palette';
import { MONEY_FORMAT } from '../../shared/ui/money/money-format';
import { BudgetRow } from '../../shared/ui/molecules/budget-row/budget-row';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { StatGroup, StatItem } from '../../shared/ui/molecules/stat-group/stat-group';
import { TotalOption, TotalToggle } from '../../shared/ui/molecules/total-toggle/total-toggle';
import {
  BreakdownItem,
  BreakdownList,
} from '../../shared/ui/organisms/breakdown-list/breakdown-list';
import { MissingRatesNotice } from '../../shared/ui/organisms/missing-rates-notice/missing-rates-notice';
import { TransactionFiltersStore } from '../transactions/transaction-filters.store';
import {
  chartSummary,
  DIMENSION_TABS,
  emptyKindText,
  kindListLabel,
  savingsRateLabel,
  SUMMARY_KIND_TEXT,
  SUMMARY_TEXT,
} from './summary-texts';

const KINDS: readonly CategoryKind[] = ['expense', 'income'];

/**
 * Resumen (spec §6, §7), like 1Money's: the balance with the savings rate, Gastos and Ingresos as
 * cards that pick what the rest shows, the bars per day with the three largest categories, the
 * averages, the categories with their subcategories, the budget and the breakdown by tag, account
 * and person. Everything in the space scope and the main currency, for the global period.
 */
@Component({
  selector: 'app-summary-page',
  imports: [
    PageHeader,
    Message,
    Amount,
    ProgressRing,
    TotalToggle,
    StatGroup,
    BarChart,
    BreakdownList,
    BudgetRow,
    Tabs,
    MissingRatesNotice,
  ],
  providers: [ReportsService],
  templateUrl: './summary-page.html',
  styleUrl: './summary-page.scss',
})
export class SummaryPage {
  private readonly reports = inject(ReportsService);
  private readonly totals = inject(TotalsService);
  private readonly periods = inject(PeriodService);
  private readonly spaces = inject(SpaceService);
  private readonly categories = inject(CategoriesService);
  private readonly tags = inject(TagsService);
  private readonly accounts = inject(AccountsService);
  private readonly members = inject(SpaceMembersService);
  private readonly filters = inject(TransactionFiltersStore);
  private readonly router = inject(Router);
  private readonly rateFlow = inject(ExchangeRateFlow);
  private readonly format = inject(MONEY_FORMAT);

  protected readonly text = SUMMARY_TEXT;
  protected readonly canEdit = this.spaces.canEdit;
  protected readonly currency = computed(
    () => this.spaces.activeSettings()?.main_currency ?? SPACE_DEFAULTS.mainCurrency,
  );

  /** What the cards picked: the chart, the averages, the lists and the breakdown follow it. */
  protected readonly kind = signal<CategoryKind>('expense');

  private readonly kindTotal = (kind: CategoryKind) => this.totals.kindTotal(kind);
  protected readonly balance = computed(() => this.kindTotal('income') - this.kindTotal('expense'));
  private readonly rate = computed(() =>
    savingsRate(this.kindTotal('income'), this.kindTotal('expense')),
  );
  protected readonly ring = computed(() => {
    const rate = this.rate();
    return rate === null
      ? null
      : {
          value: rate,
          text: percentText(rate),
          label: savingsRateLabel(percentText(rate)),
          tone: this.balance() < 0 ? ('error' as const) : ('positive' as const),
        };
  });

  protected readonly totalOptions = computed<TotalOption<CategoryKind>[]>(() => {
    const comparison = this.reports.comparison();
    const previous = this.reports.previousTotals();
    const against = comparison ? rangeText(comparison.range, this.periods.today()) : '';
    return KINDS.map((kind) => {
      const amount = this.kindTotal(kind);
      const change =
        comparison && previous ? compareTotals(amount, this.previousTotal(kind), kind) : null;
      return {
        value: kind,
        label: SUMMARY_KIND_TEXT[kind].label,
        amount,
        currency: this.currency(),
        tone: kind,
        note: change ? comparisonText(change, against) : null,
        noteTone: change?.tone ?? 'neutral',
      };
    });
  });

  private readonly ranking = computed(() =>
    rankCategories(this.totals.categoryTotals(), this.kind()),
  );
  private readonly total = computed(() => this.kindTotal(this.kind()));

  // ── Chart ──────────────────────────────────────────────────────────────────
  private readonly chart = computed(() => {
    const kind = this.kind();
    const rows = this.reports.daily().filter((row) => row.kind === kind);
    const today = this.periods.today();
    const settings = this.periods.settings();
    const range = chartRange(
      this.periods.range(),
      this.reports.daily().map((row) => row.date),
      today,
    );
    const size = bucketSize(this.periods.period().kind, range, CHART_DAILY_MAX_BUCKETS);
    const top = this.ranking().top;
    const buckets = chartBuckets(
      rows,
      range,
      size,
      top.map((category) => category.categoryId),
      settings.monthStartDay,
    );
    const crossesYears = dateParts(range.start).year !== dateParts(range.end).year;
    const bars: BarChartBucket[] = buckets.map((bucket) => {
      if (size === 'day') {
        return {
          label: axisDayText(bucket.start),
          title: dayTitle(bucket.start, today),
          values: bucket.values,
        };
      }
      const month = periodMonth(bucket.start, settings.monthStartDay);
      return {
        label: axisMonthText(month, crossesYears),
        title: periodTitle({ kind: 'month', anchor: bucket.start }, settings, today),
        values: bucket.values,
      };
    });
    const series: BarChartSeries[] = [
      ...top.map((category) => {
        const found = this.categories.find(category.categoryId);
        return { label: found?.name ?? '', color: found?.color ?? null };
      }),
      { label: SUMMARY_TEXT.others, color: FALLBACK_COLOR },
    ];
    return { bars, series, ticks: chartTicks(bars.length, size) };
  });
  /** The chart starts once its figures are in, instead of drawing again as each one arrives. */
  protected readonly chartReady = computed(
    () => this.reports.dailyLoaded() && this.totals.categoryTotalsLoaded(),
  );
  protected readonly chartBars = computed(() => this.chart().bars);
  protected readonly chartSeries = computed(() => this.chart().series);
  protected readonly chartTicks = computed(() => this.chart().ticks);
  protected readonly chartLabel = computed(() => {
    const largest = this.ranking().top[0];
    const category = largest ? this.categories.find(largest.categoryId) : null;
    return chartSummary(
      this.kind(),
      this.periods.title(),
      this.money(this.total()),
      category && largest ? { name: category.name, amount: this.money(largest.amount) } : null,
    );
  });

  // ── Averages ───────────────────────────────────────────────────────────────
  protected readonly averages = computed<StatItem[]>(() => {
    const dates = this.reports
      .daily()
      .map((row) => row.date)
      .sort();
    const averages = periodAverages(
      this.total(),
      this.periods.range(),
      this.periods.period().kind,
      this.periods.today(),
      dates[0] ?? null,
    );
    if (!averages) {
      return [];
    }
    const accent = this.kind();
    const currency = this.currency();
    return [
      { label: SUMMARY_TEXT.perDay, amount: averages.perDay, currency, accent },
      { label: SUMMARY_TEXT.perWeek, amount: averages.perWeek, currency, accent },
      {
        label: averages.monthIsTotal ? SUMMARY_TEXT.month : SUMMARY_TEXT.perMonth,
        amount: averages.perMonth,
        currency,
        accent,
      },
    ];
  });

  // ── Categories ─────────────────────────────────────────────────────────────
  protected readonly categoryItems = computed(() =>
    this.ranking().top.map((category) => this.categoryItem(category)),
  );
  protected readonly categoryRest = computed(() =>
    this.ranking().rest.map((category) => this.categoryItem(category)),
  );
  protected readonly categoriesLabel = computed(() =>
    kindListLabel(this.kind(), SUMMARY_TEXT.byCategory),
  );
  protected readonly emptyText = computed(() => emptyKindText(this.kind(), this.periods.title()));

  // ── Budget ─────────────────────────────────────────────────────────────────
  protected readonly budgetRows = computed(() => {
    const enabled = this.spaces.activeSettings()?.budgets_enabled ?? true;
    const period = this.periods.period().kind;
    if (!enabled || (period !== 'month' && period !== 'year')) {
      return [];
    }
    return KINDS.map((kind) => ({
      kind,
      name: SUMMARY_KIND_TEXT[kind].label,
      figures: this.budgetFigures(kind),
    })).filter((row) => row.figures.budget !== null);
  });

  // ── Breakdown ──────────────────────────────────────────────────────────────
  protected readonly dimensionTabs = computed<TabOption<ReportDimension>[]>(() =>
    DIMENSION_TABS.filter((tab) => tab.value !== 'member' || this.members.members().length > 1),
  );
  protected readonly dimension = this.reports.dimension;
  protected readonly breakdownItems = computed<BreakdownItem[]>(() => {
    const kind = this.kind();
    const total = this.total();
    return this.reports
      .breakdown()
      .filter((row) => row.kind === kind && row.amount !== 0)
      .map((row) => ({
        ...this.breakdownLook(row.key),
        amount: row.amount,
        share: shareOf(row.amount, total),
      }))
      .sort((a, b) => b.amount - a.amount);
  });
  protected readonly breakdownLabel = computed(() => {
    const tab = DIMENSION_TABS.find((item) => item.value === this.dimension());
    return kindListLabel(this.kind(), `por ${tab?.label ?? ''}`);
  });

  protected readonly missingRates = computed(() =>
    [
      ...new Set([...this.totals.missingRateCurrencies(), ...this.reports.missingRateCurrencies()]),
    ].sort(),
  );
  protected readonly error = computed(
    () => this.totals.categoryTotalsError() ?? this.reports.error(),
  );

  /** Transacciones with the category or subcategory as filter, in the same global period. */
  protected viewTransactions(categoryId: string): void {
    this.filters.reset();
    this.filters.set('categoryIds', [categoryId]);
    void this.router.navigate(['/', APP_PATHS.transactions]);
  }

  protected openBudget(): void {
    void this.router.navigate(['/', APP_PATHS.budget]);
  }

  protected defineRate(currency: string): void {
    void this.rateFlow.open(currency);
  }

  private money(amount: number): string {
    return formatMoney(amount, this.currency(), this.format());
  }

  private previousTotal(kind: CategoryKind): number {
    return (this.reports.previousTotals() ?? [])
      .filter((total) => total.kind === kind && total.parentId === null)
      .reduce((sum, total) => sum + total.amount, 0);
  }

  private budgetFigures(kind: CategoryKind): BudgetFigures {
    return kindBudgetFigures(
      this.kindTotal(kind),
      this.categories.tree(kind).map(({ category }) => {
        const total = this.totals.find(category.id);
        return { spent: total?.amount ?? 0, budget: total?.budget ?? null };
      }),
    );
  }

  /**
   * A top-level category with its subcategories that got something, and a "General" for what was
   * recorded right in it. Shares are of the whole kind, so every % of the list compares.
   */
  private categoryItem(ranked: CategoryAmount): BreakdownItem {
    const category = this.categories.find(ranked.categoryId);
    const total = this.total();
    const look = {
      name: category?.name ?? '',
      icon: category?.icon ?? '',
      color: category?.color ?? null,
    };
    const subcategories = this.totals
      .categoryTotals()
      .filter((row) => row.parentId === ranked.categoryId && row.amount > 0)
      .map((row) => {
        const subcategory = this.categories.find(row.categoryId);
        return {
          id: row.categoryId,
          name: subcategory?.name ?? '',
          icon: subcategory?.icon ?? look.icon,
          color: subcategory?.color ?? look.color,
          amount: row.amount,
          share: shareOf(row.amount, total),
          actionable: true,
        };
      })
      .sort((a, b) => b.amount - a.amount);
    const direct = ranked.amount - subcategories.reduce((sum, row) => sum + row.amount, 0);
    const children: BreakdownItem[] =
      subcategories.length && direct > 0
        ? [
            ...subcategories,
            {
              id: ranked.categoryId,
              ...look,
              name: SUMMARY_TEXT.general,
              amount: direct,
              share: shareOf(direct, total),
              actionable: true,
            },
          ]
        : subcategories;
    return {
      id: ranked.categoryId,
      ...look,
      amount: ranked.amount,
      share: shareOf(ranked.amount, total),
      children,
      actionable: children.length === 0,
    };
  }

  private breakdownLook(key: string | null): Pick<BreakdownItem, 'id' | 'name' | 'icon' | 'color'> {
    switch (this.dimension()) {
      case 'tag': {
        const tag = key ? this.tags.find(key) : null;
        return {
          id: key ?? 'none',
          name: tag?.name ?? SUMMARY_TEXT.untagged,
          icon: 'sell',
          color: tag?.color ?? null,
        };
      }
      case 'account': {
        const account = key ? this.accounts.find(key) : null;
        return account
          ? { id: account.id, name: account.name, icon: account.icon, color: account.color }
          : { id: 'none', name: SUMMARY_TEXT.othersPrivate, icon: 'lock', color: null };
      }
      case 'member': {
        const member = this.members.members().find((item) => item.userId === key);
        return {
          id: key ?? 'none',
          name: member?.displayName ?? SUMMARY_TEXT.unknownPerson,
          icon: 'person',
          color: null,
        };
      }
    }
  }
}
