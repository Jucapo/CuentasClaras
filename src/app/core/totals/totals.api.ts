import { inject, Injectable } from '@angular/core';
import { IsoDate } from '../../domain/dates/local-date';
import { DateRange } from '../../domain/periods/periods';
import { actionFailed, DataResult } from '../action-result';
import { dataErrorMessage, LOAD_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { SupabaseService } from '../supabase/supabase.service';
import { TransactionQuery } from '../transactions/transaction.models';
import { transactionQueryArgs } from '../transactions/transactions.api';
import {
  AccountsTotal,
  CategoryTotal,
  TransactionDayTotal,
  TransactionTotals,
} from './totals.models';

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

  /** Incomes, expenses and net of the movements Transacciones lists for `query`. */
  async transactionTotals(
    spaceId: string,
    query: TransactionQuery,
  ): Promise<DataResult<TransactionTotals | null>> {
    const { data, error, status } = await this.client
      .rpc('transaction_totals', transactionQueryArgs(spaceId, query))
      .maybeSingle();
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return {
      ok: true,
      value: data
        ? {
            income: data.income,
            expense: data.expense,
            net: data.net,
            outsideSpace: {
              income: data.outside_space_income,
              expense: data.outside_space_expense,
            },
            currency: data.currency,
            missingRateCurrencies: data.missing_rate_currencies ?? [],
          }
        : null,
    };
  }

  /** Incomes, expenses and net per day of the movements Transacciones lists for `query`. */
  async transactionDayTotals(
    spaceId: string,
    query: TransactionQuery,
  ): Promise<DataResult<TransactionDayTotal[]>> {
    const { data, error, status } = await this.client.rpc(
      'transaction_day_totals',
      transactionQueryArgs(spaceId, query),
    );
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return {
      ok: true,
      value: (data ?? []).map((row) => ({
        date: row.date,
        income: row.income,
        expense: row.expense,
        net: row.net,
        missingRateCurrencies: row.missing_rate_currencies ?? [],
      })),
    };
  }

  /**
   * Balance at the close of `onDate` of the accounts of the header total, or of `accountIds`, in
   * the main currency with the rate of that day (spec §7).
   */
  async accountsBalance(
    spaceId: string,
    onDate: IsoDate,
    accountIds: readonly string[],
  ): Promise<DataResult<AccountsTotal>> {
    const { data, error, status } = await this.client
      .rpc('accounts_balance', {
        target_space_id: spaceId,
        on_date: onDate,
        account_ids: [...accountIds],
      })
      .single();
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return {
      ok: true,
      value: {
        total: data.balance,
        currency: data.currency,
        missingRateCurrencies: data.missing_rate_currencies ?? [],
      },
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
