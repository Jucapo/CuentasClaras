import { inject, Injectable } from '@angular/core';
import { actionFailed, ActionResult, ACTION_OK, DataResult } from '../action-result';
import { deleteResult, DeleteResult } from '../catalogs/catalog-result';
import {
  dataErrorMessage,
  LOAD_ERROR_MESSAGE,
  NOT_ALLOWED_MESSAGE,
} from '../supabase/data-error-messages';
import { TablesInsert } from '../supabase/database.types';
import { SupabaseService } from '../supabase/supabase.service';
import { Account, AccountPatch, NewAccount } from './account.models';

/** Shown when an account cannot be deleted because it has movements (from F1d). */
export const ACCOUNT_IN_USE_MESSAGE =
  'Esta cuenta tiene movimientos, así que no se puede eliminar. Archívala para ocultarla sin perder el historial.';

/** Supabase queries for accounts and their balances. */
@Injectable({ providedIn: 'root' })
export class AccountsApi {
  private readonly client = inject(SupabaseService).client;

  /** Accounts of a space the user can see, in their saved order, with their balances. */
  async fetch(spaceId: string): Promise<DataResult<Account[]>> {
    const [accounts, balances] = await Promise.all([
      this.client.from('accounts').select('*').eq('space_id', spaceId).order('sort_order'),
      this.client.from('account_balances').select('account_id, balance').eq('space_id', spaceId),
    ]);
    const failed = accounts.error ? accounts : balances.error ? balances : null;
    if (failed?.error) {
      return actionFailed(dataErrorMessage(failed.error, failed.status, LOAD_ERROR_MESSAGE));
    }
    const balanceById = new Map(
      (balances.data ?? []).map((row) => [row.account_id, row.balance ?? 0]),
    );
    return {
      ok: true,
      value: (accounts.data ?? []).map((account) => ({
        ...account,
        balance: balanceById.get(account.id) ?? account.initial_balance,
      })),
    };
  }

  /** Creates an account owned by the user; returns its id. */
  async create(account: NewAccount): Promise<DataResult<string>> {
    const { data, error, status } = await this.client
      .from('accounts')
      // A trigger appends the account when sort_order is missing.
      .insert(account as TablesInsert<'accounts'>)
      .select('id')
      .single();
    return error ? actionFailed(dataErrorMessage(error, status)) : { ok: true, value: data.id };
  }

  /** Changes an account the user can edit. */
  async update(id: string, patch: AccountPatch): Promise<ActionResult> {
    const { data, error, status } = await this.client
      .from('accounts')
      .update(patch)
      .eq('id', id)
      .select('id');
    if (error) {
      return actionFailed(dataErrorMessage(error, status));
    }
    return data.length > 0 ? ACTION_OK : actionFailed(NOT_ALLOWED_MESSAGE);
  }

  /** Deletes an account; fails with `inUse` when it has movements. */
  async remove(id: string): Promise<DeleteResult> {
    const { data, error, status } = await this.client
      .from('accounts')
      .delete()
      .eq('id', id)
      .select('id');
    return deleteResult(error, status, data?.length ?? 0, ACCOUNT_IN_USE_MESSAGE);
  }
}
