import { inject, Injectable } from '@angular/core';
import { DateRange } from '../../domain/periods/periods';
import { actionFailed, DataResult } from '../action-result';
import { dataErrorMessage, LOAD_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { SupabaseService } from '../supabase/supabase.service';
import { BreakdownTotal, DailyCategoryTotal, ReportDimension } from './reports.models';

/** Supabase RPCs of the Resumen, in the space scope (security invoker: they follow RLS). */
@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly client = inject(SupabaseService).client;

  /** Totals per day and top-level category in a range (null ends mean unbounded). */
  async dailyCategoryTotals(
    spaceId: string,
    range: DateRange,
  ): Promise<DataResult<DailyCategoryTotal[]>> {
    const { data, error, status } = await this.client.rpc('daily_category_totals', {
      target_space_id: spaceId,
      // Null means unbounded; the generated types have no nulls for SQL arguments.
      from_date: range.start as string,
      to_date: range.end as string,
    });
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return {
      ok: true,
      value: (data ?? []).map((row) => ({
        date: row.date,
        categoryId: row.category_id,
        kind: row.kind,
        amount: row.amount,
        missingRateCurrencies: row.missing_rate_currencies ?? [],
      })),
    };
  }

  /** Totals per tag, account or person in a range. */
  async breakdownTotals(
    spaceId: string,
    range: DateRange,
    dimension: ReportDimension,
  ): Promise<DataResult<BreakdownTotal[]>> {
    const { data, error, status } = await this.client.rpc('breakdown_totals', {
      target_space_id: spaceId,
      from_date: range.start as string,
      to_date: range.end as string,
      dimension,
    });
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return {
      ok: true,
      // RETURNS TABLE columns come typed as non-null even when they can be null.
      value: (data ?? []).map((row) => ({
        key: (row.key as string | null) ?? null,
        kind: row.kind,
        amount: row.amount,
        movements: row.movements,
        missingRateCurrencies: row.missing_rate_currencies ?? [],
      })),
    };
  }
}
