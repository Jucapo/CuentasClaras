import { computed, inject, Injectable, resource } from '@angular/core';
import { budgetInForce, budgetTotals } from '../../domain/budgets/budgets';
import { todayIsoDate } from '../../domain/dates/local-date';
import { CurrencyAmount } from '../../domain/money/money';
import { periodMonth } from '../../domain/periods/period-month';
import { ACTION_OK, actionFailed, ActionResult } from '../action-result';
import { SPACE_DEFAULTS } from '../config/space.constants';
import { SpaceService } from '../spaces/space.service';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { Budget } from './budget.models';
import { BudgetsApi } from './budgets.api';

/**
 * Monthly budgets (expense categories) and expected incomes (income categories) of the active
 * space (spec §4.7). Amounts set here apply from the current period on.
 */
@Injectable({ providedIn: 'root' })
export class BudgetsService {
  private readonly api = inject(BudgetsApi);
  private readonly spaces = inject(SpaceService);

  private readonly store = resource({
    params: () => this.spaces.activeSpace()?.id,
    loader: async ({ params: spaceId }) => {
      const result = await this.api.fetch(spaceId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  /** Every budget row of the space, oldest period first. */
  readonly budgets = computed<readonly Budget[]>(() =>
    this.store.hasValue() ? this.store.value() : [],
  );
  readonly loaded = computed(() => this.store.hasValue());
  readonly loadError = computed(() => this.store.error()?.message ?? null);

  /** The space's main currency, which new amounts start in. */
  readonly mainCurrency = computed(
    () => this.spaces.activeSettings()?.main_currency ?? SPACE_DEFAULTS.mainCurrency,
  );
  /** First day of the month that names the current period (spec §4.5). */
  readonly currentMonth = computed(() =>
    periodMonth(
      todayIsoDate(),
      this.spaces.activeSettings()?.month_start_day ?? SPACE_DEFAULTS.monthStartDay,
    ),
  );

  /** The amount of a category in force this period, or null. */
  amountFor(categoryId: string): Budget | null {
    return budgetInForce(this.budgets(), categoryId, this.currentMonth());
  }

  /** Monthly totals of some categories per currency, the main currency first. */
  totalsFor(categoryIds: readonly string[]): CurrencyAmount[] {
    return budgetTotals(this.budgets(), categoryIds, this.currentMonth(), this.mainCurrency());
  }

  /** Sets the monthly amount of a category from this period on; 0 removes it. */
  async setMonthly(categoryId: string, amount: number, currency: string): Promise<ActionResult> {
    const spaceId = this.spaces.activeSpace()?.id;
    if (!spaceId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const month = this.currentMonth();
    const existing = this.budgets().find(
      (budget) => budget.category_id === categoryId && budget.effective_from === month,
    );
    if (!existing && amount === 0 && !this.amountFor(categoryId)) {
      return ACTION_OK;
    }
    const saved = existing
      ? await this.api.update(existing.id, amount, currency)
      : await this.api.create({
          space_id: spaceId,
          category_id: categoryId,
          amount,
          currency,
          effective_from: month,
        });
    if (saved.ok) {
      this.store.reload();
    }
    return saved;
  }
}
