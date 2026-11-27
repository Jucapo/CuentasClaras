import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { comparisonRange } from '../../domain/reports/comparison';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { PeriodService } from '../periods/period.service';
import { SpaceService } from '../spaces/space.service';
import { TotalsApi } from '../totals/totals.api';
import { CategoryTotal } from '../totals/totals.models';
import { TransactionsService } from '../transactions/transactions.service';
import { ReportsApi } from './reports.api';
import { BreakdownTotal, DailyCategoryTotal, ReportDimension } from './reports.models';

/**
 * Figures of the Resumen for the selected period (spec §6, §7): per day and category for the
 * chart, the totals of the previous period to compare with, and the breakdown of the selected tab.
 * The current totals per category come from `TotalsService`. Provided by the page, so it stops
 * loading when the user leaves it.
 */
@Injectable()
export class ReportsService {
  private readonly api = inject(ReportsApi);
  private readonly totalsApi = inject(TotalsApi);
  private readonly spaces = inject(SpaceService);
  private readonly periods = inject(PeriodService);
  private readonly transactions = inject(TransactionsService);
  private readonly rates = inject(ExchangeRatesService);

  /** What the tabs split the movements by. */
  readonly dimension = signal<ReportDimension>('tag');

  /** The previous period to compare with; null in "Siempre" and before the period starts. */
  readonly comparison = computed(() =>
    comparisonRange(this.periods.period(), this.periods.settings(), this.periods.today()),
  );

  private readonly dailyStore = resource({
    params: () => {
      const spaceId = this.spaces.activeSpace()?.id;
      return spaceId
        ? {
            spaceId,
            range: this.periods.range(),
            revision: this.transactions.revision(),
            rates: this.rates.revision(),
          }
        : undefined;
    },
    loader: async ({ params }) => {
      const result = await this.api.dailyCategoryTotals(params.spaceId, params.range);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  private readonly previousStore = resource({
    params: () => {
      const spaceId = this.spaces.activeSpace()?.id;
      const comparison = this.comparison();
      return spaceId && comparison
        ? {
            spaceId,
            range: comparison.range,
            revision: this.transactions.revision(),
            rates: this.rates.revision(),
          }
        : undefined;
    },
    loader: async ({ params }) => {
      const result = await this.totalsApi.categoryTotals(params.spaceId, params.range, []);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  private readonly breakdownStore = resource({
    params: () => {
      const spaceId = this.spaces.activeSpace()?.id;
      return spaceId
        ? {
            spaceId,
            range: this.periods.range(),
            dimension: this.dimension(),
            revision: this.transactions.revision(),
            rates: this.rates.revision(),
          }
        : undefined;
    },
    loader: async ({ params }) => {
      const result = await this.api.breakdownTotals(params.spaceId, params.range, params.dimension);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  /** Totals per day and top-level category of the period. */
  readonly daily = computed<readonly DailyCategoryTotal[]>(() =>
    this.dailyStore.hasValue() ? this.dailyStore.value() : [],
  );
  readonly dailyLoaded = computed(() => this.dailyStore.hasValue());

  /** Totals per category of the previous period; null without a comparison or until loaded. */
  readonly previousTotals = computed<readonly CategoryTotal[] | null>(() =>
    this.previousStore.hasValue() ? this.previousStore.value() : null,
  );

  /** Totals per tag, account or person, as `dimension` says. */
  readonly breakdown = computed<readonly BreakdownTotal[]>(() =>
    this.breakdownStore.hasValue() ? this.breakdownStore.value() : [],
  );

  readonly error = computed(
    () =>
      this.dailyStore.error()?.message ??
      this.previousStore.error()?.message ??
      this.breakdownStore.error()?.message ??
      null,
  );

  /** Currencies the chart and the breakdown left out for lack of a rate. */
  readonly missingRateCurrencies = computed(() => {
    const currencies = new Set<string>();
    for (const row of [...this.daily(), ...this.breakdown()]) {
      for (const currency of row.missingRateCurrencies) {
        currencies.add(currency);
      }
    }
    return [...currencies];
  });
}
