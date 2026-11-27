import { computed, inject, Injectable, resource } from '@angular/core';
import { AccountsService } from '../accounts/accounts.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { PeriodService } from '../periods/period.service';
import { SpaceService } from '../spaces/space.service';
import { DataResult } from '../action-result';
import { TransactionQuery } from '../transactions/transaction.models';
import { TransactionsService } from '../transactions/transactions.service';
import { AccountsTotal, CategoryTotal, TransactionTotals } from './totals.models';
import { TotalsApi } from './totals.api';

/**
 * Totals of the active space: per category in the selected period, and the accounts total of the
 * header (spec §7). They reload with the period, the movements, the rates and the accounts.
 */
@Injectable({ providedIn: 'root' })
export class TotalsService {
  private readonly api = inject(TotalsApi);
  private readonly spaces = inject(SpaceService);
  private readonly periods = inject(PeriodService);
  private readonly transactions = inject(TransactionsService);
  private readonly rates = inject(ExchangeRatesService);
  private readonly accounts = inject(AccountsService);

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

  /** Totals of every category in the selected period. */
  readonly categoryTotals = computed<readonly CategoryTotal[]>(() =>
    this.categoryStore.hasValue() ? this.categoryStore.value() : [],
  );
  readonly categoryTotalsLoaded = computed(() => this.categoryStore.hasValue());
  readonly categoryTotalsError = computed(() => this.categoryStore.error()?.message ?? null);

  /** Total of the accounts included in it, in the main currency; null until loaded. */
  readonly accountsTotal = computed<AccountsTotal | null>(() =>
    this.accountsStore.hasValue() ? this.accountsStore.value() : null,
  );

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
}
