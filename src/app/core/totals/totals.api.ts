import { inject, Injectable } from '@angular/core';
import { IsoDate } from '../../domain/dates/local-date';
import { DateRange } from '../../domain/periods/periods';
import { actionFailed, DataResult } from '../action-result';
import { dataErrorMessage, LOAD_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { SupabaseService } from '../supabase/supabase.service';
import { AccountsTotal, CategoryTotal } from './totals.models';

/** Supabase RPCs that add up movements (security invoker: they follow RLS). */
@Injectable({ providedIn: 'root' })
export class TotalsApi {
  private readonly client = inject(SupabaseService).client;

  /** Totals per category in a range, with the budgets of `budgetMonths`. */
  async categoryTotals(
    spaceId: string,
    range: DateRange,
    budgetMonths: readonly IsoDate[],
  ): Promise<DataResult<CategoryTotal[]>> {
    const { data, error, status } = await this.client.rpc('category_totals', {
      target_space_id: spaceId,
      // Null means unbounded; the generated types have no nulls for SQL arguments.
      from_date: range.start as string,
      to_date: range.end as string,
      budget_months: [...budgetMonths],
    });
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return {
      ok: true,
      // RETURNS TABLE columns come typed as non-null even when they can be null.
      value: (data ?? []).map((row) => ({
        categoryId: row.category_id,
        parentId: (row.parent_id as string | null) ?? null,
        kind: row.kind,
        amount: row.amount,
        budget: (row.budget as number | null) ?? null,
        remaining: (row.remaining as number | null) ?? null,
        missingRateCurrencies: row.missing_rate_currencies ?? [],
      })),
    };
  }

  /** Balance of the active accounts included in the total, converted on `onDate`. */
  async accountsTotal(spaceId: string, onDate: IsoDate): Promise<DataResult<AccountsTotal>> {
    const { data, error, status } = await this.client
      .rpc('accounts_total', { target_space_id: spaceId, on_date: onDate })
      .single();
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return {
      ok: true,
      value: {
        total: data.total,
        currency: data.currency,
        missingRateCurrencies: data.missing_rate_currencies ?? [],
      },
    };
  }
}
