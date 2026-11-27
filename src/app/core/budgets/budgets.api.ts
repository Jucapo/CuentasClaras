import { inject, Injectable } from '@angular/core';
import { actionFailed, ActionResult, ACTION_OK, DataResult } from '../action-result';
import {
  dataErrorMessage,
  LOAD_ERROR_MESSAGE,
  NOT_ALLOWED_MESSAGE,
} from '../supabase/data-error-messages';
import { SupabaseService } from '../supabase/supabase.service';
import { Budget, NewBudget } from './budget.models';

/** Supabase queries for budgets and expected incomes. */
@Injectable({ providedIn: 'root' })
export class BudgetsApi {
  private readonly client = inject(SupabaseService).client;

  /** Budget rows of a space, oldest period first. */
  async fetch(spaceId: string): Promise<DataResult<Budget[]>> {
    const { data, error, status } = await this.client
      .from('budgets')
      .select('*')
      .eq('space_id', spaceId)
      .order('effective_from');
    return error
      ? actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE))
      : { ok: true, value: data };
  }

  /** Creates a budget row. */
  async create(budget: NewBudget): Promise<ActionResult> {
    const { error, status } = await this.client.from('budgets').insert(budget);
    return error ? actionFailed(dataErrorMessage(error, status)) : ACTION_OK;
  }

  /** Changes the amount and currency of a budget row. */
  async update(id: string, amount: number, currency: string): Promise<ActionResult> {
    const { data, error, status } = await this.client
      .from('budgets')
      .update({ amount, currency })
      .eq('id', id)
      .select('id');
    if (error) {
      return actionFailed(dataErrorMessage(error, status));
    }
    return data.length > 0 ? ACTION_OK : actionFailed(NOT_ALLOWED_MESSAGE);
  }
}
