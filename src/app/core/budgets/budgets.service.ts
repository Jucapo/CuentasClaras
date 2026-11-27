import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { BudgetEditScope, BudgetWrite, budgetWrites } from '../../domain/budgets/budget-scope';
import { budgetInForce, budgetTotals } from '../../domain/budgets/budgets';
import { IsoDate, todayIsoDate } from '../../domain/dates/local-date';
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
 * space (spec §4.7). Amounts set here apply from a month (the current period by default) on.
 */
@Injectable({ providedIn: 'root' })
export class BudgetsService {
  private readonly api = inject(BudgetsApi);
  private readonly spaces = inject(SpaceService);
  private readonly changes = signal(0);

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

  /** Goes up after every saved amount, so totals with budgets reload. */
  readonly revision = this.changes.asReadonly();

  /** The amount of a category in force in a month (`YYYY-MM-01`, this period by default), or null. */
  amountFor(categoryId: string, month: IsoDate = this.currentMonth()): Budget | null {
    return budgetInForce(this.budgets(), categoryId, month);
  }

  /** Monthly totals of some categories per currency, the main currency first. */
  totalsFor(categoryIds: readonly string[]): CurrencyAmount[] {
    return budgetTotals(this.budgets(), categoryIds, this.currentMonth(), this.mainCurrency());
  }

  /** Sets the monthly amount of a category from this period on, as the wizard does; 0 removes it. */
  setMonthly(categoryId: string, amount: number, currency: string): Promise<ActionResult> {
    return this.setAmount(categoryId, amount, currency, this.currentMonth(), 'onward');
  }

  /**
   * Sets the amount of a category or subcategory in a month with the scope of the edit (spec §4.7):
   * only that month, or that month and the following ones without an amount of their own. The rows
   * are saved in the order `budgetWrites` gives, so a failure halfway never changes later months.
   */
  async setAmount(
    categoryId: string,
    amount: number,
    currency: string,
    month: IsoDate,
    scope: BudgetEditScope,
  ): Promise<ActionResult> {
    const spaceId = this.spaces.activeSpace()?.id;
    if (!spaceId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const writes = budgetWrites(this.budgets(), categoryId, month, amount, currency, scope);
    let result: ActionResult = ACTION_OK;
    for (const write of writes) {
      result = await this.save(spaceId, categoryId, write);
      if (!result.ok) {
        break;
      }
    }
    if (writes.length > 0) {
      this.store.reload();
      this.changes.update((value) => value + 1);
    }
    return result;
  }

  private save(spaceId: string, categoryId: string, write: BudgetWrite): Promise<ActionResult> {
    const existing = this.budgets().find(
      (budget) => budget.category_id === categoryId && budget.effective_from === write.effectiveFrom,
    );
    return existing
      ? this.api.update(existing.id, write.amount, write.currency)
      : this.api.create({
          space_id: spaceId,
          category_id: categoryId,
          amount: write.amount,
          currency: write.currency,
          effective_from: write.effectiveFrom,
        });
  }
}
