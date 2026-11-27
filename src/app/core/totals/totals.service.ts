import { computed, inject, Injectable, linkedSignal, resource, Signal } from '@angular/core';
import { AccountsService } from '../accounts/accounts.service';
import { BudgetsService } from '../budgets/budgets.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { PeriodService } from '../periods/period.service';
import { SpaceService } from '../spaces/space.service';
import { DataResult } from '../action-result';
import { TransactionQuery } from '../transactions/transaction.models';
import { TransactionsService } from '../transactions/transactions.service';
import { IsoDate } from '../../domain/dates/local-date';
import {
  AccountsTotal,
  CategoryTotal,
  TransactionDayTotal,
  TransactionTotals,
} from './totals.models';
import { TotalsApi } from './totals.api';

/**
 * The latest value of a resource of a space: kept while the next one loads, null until the first
 * one of the space arrives.
 */
function keepWhileLoading<T>(
  spaceId: () => string | undefined,
  value: () => T | undefined,
): Signal<T | null> {
  const latest = linkedSignal<
    { readonly spaceId: string | undefined; readonly value: T | undefined },
    { readonly spaceId: string | undefined; readonly value: T | null }
  >({
    source: () => ({ spaceId: spaceId(), value: value() }),
    computation: (next, previous) => {
      if (next.value !== undefined) {
        return { spaceId: next.spaceId, value: next.value };
      }
      return previous && previous.value.spaceId === next.spaceId
        ? previous.value
        : { spaceId: next.spaceId, value: null };
    },
  });
  return computed(() => latest().value);
}

/**
 * Totals of the active space: per category in the selected period, and the accounts total of the
 * header (spec §7). They reload with the period, the movements, the rates, the budgets and the
 * accounts, keeping the last ones on screen meanwhile.
 */
@Injectable({ providedIn: 'root' })
export class TotalsService {
  private readonly api = inject(TotalsApi);
  private readonly spaces = inject(SpaceService);
  private readonly periods = inject(PeriodService);
  private readonly transactions = inject(TransactionsService);
  private readonly rates = inject(ExchangeRatesService);
  private readonly accounts = inject(AccountsService);
  private readonly budgets = inject(BudgetsService);

  private readonly categoryStore = resource({
    params: () => {
      const spaceId = this.spaces.activeSpace()?.id;
      return spaceId
        ? {
            spaceId,
            range: this.periods.range(),
            budgetMonths: this.periods.budgetMonths(),
            revision: this.transactions.revision(),
            rates: this.rates.revision(),
            budgets: this.budgets.revision(),
          }
        : undefined;
    },
    loader: async ({ params }) => {
      const result = await this.api.categoryTotals(
        params.spaceId,
        params.range,
        params.budgetMonths,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  private readonly accountsStore = resource({
    params: () => {
      const spaceId = this.spaces.activeSpace()?.id;
      // Accounts reload after every movement, so they also cover the movements.
      return spaceId
        ? {
            spaceId,
            today: this.periods.today(),
            accounts: this.accounts.accounts(),
            rates: this.rates.revision(),
          }
        : undefined;
    },
    loader: async ({ params }) => {
      const result = await this.api.accountsTotal(params.spaceId, params.today);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  // While new totals load (another period, a new movement), the last ones stay on screen instead of
  // "$ 0" or a placeholder (spec §13.4); another space starts empty.
  private readonly lastCategoryTotals = keepWhileLoading(
    () => this.spaces.activeSpace()?.id,
    () => (this.categoryStore.hasValue() ? this.categoryStore.value() : undefined),
  );
  private readonly lastAccountsTotal = keepWhileLoading(
    () => this.spaces.activeSpace()?.id,
    () => (this.accountsStore.hasValue() ? this.accountsStore.value() : undefined),
  );

  /** Totals of every category in the selected period. */
  readonly categoryTotals = computed<readonly CategoryTotal[]>(
    () => this.lastCategoryTotals() ?? [],
  );
  /** Whether the totals of the space arrived once; later reloads keep the last ones. */
  readonly categoryTotalsLoaded = computed(() => this.lastCategoryTotals() !== null);
  readonly categoryTotalsError = computed(() => this.categoryStore.error()?.message ?? null);

  /** Total of the accounts included in it, in the main currency; null until loaded. */
  readonly accountsTotal = computed<AccountsTotal | null>(() => this.lastAccountsTotal());

  /** Currencies whose amounts are left out of the totals for lack of a rate. */
  readonly missingRateCurrencies = computed(() => {
    const currencies = new Set(this.accountsTotal()?.missingRateCurrencies ?? []);
    for (const total of this.categoryTotals()) {
      for (const currency of total.missingRateCurrencies) {
        currencies.add(currency);
      }
    }
    return [...currencies].sort();
  });

  /** Total of a category kind in the period: only top-level rows, which include their children. */
  kindTotal(kind: CategoryTotal['kind']): number {
    return this.categoryTotals()
      .filter((total) => total.kind === kind && total.parentId === null)
      .reduce((sum, total) => sum + total.amount, 0);
  }

  /** Totals of one category, if any. */
  find(categoryId: string): CategoryTotal | null {
    return this.categoryTotals().find((total) => total.categoryId === categoryId) ?? null;
  }

  /** Incomes, expenses and net of what Transacciones lists (spec §7); null without a space. */
  async forTransactions(query: TransactionQuery): Promise<DataResult<TransactionTotals | null>> {
    const spaceId = this.spaces.activeSpace()?.id;
    return spaceId ? this.api.transactionTotals(spaceId, query) : { ok: true, value: null };
  }

  /** The same per day, for the header of each day (spec §7); none without a space. */
  async forTransactionDays(query: TransactionQuery): Promise<DataResult<TransactionDayTotal[]>> {
    const spaceId = this.spaces.activeSpace()?.id;
    return spaceId ? this.api.transactionDayTotals(spaceId, query) : { ok: true, value: [] };
  }

  /**
   * Balance at the close of a day of the accounts of the header total, or of `accountIds`
   * (spec §7); null without a space.
   */
  async balanceOn(
    date: IsoDate,
    accountIds: readonly string[],
  ): Promise<DataResult<AccountsTotal | null>> {
    const spaceId = this.spaces.activeSpace()?.id;
    return spaceId
      ? this.api.accountsBalance(spaceId, date, accountIds)
      : { ok: true, value: null };
  }
}
