import { inject, Injectable } from '@angular/core';
import { actionFailed, ActionResult, ACTION_OK, DataResult } from '../action-result';
import {
  dataErrorMessage,
  LOAD_ERROR_MESSAGE,
  NOT_ALLOWED_MESSAGE,
} from '../supabase/data-error-messages';
import { SupabaseService } from '../supabase/supabase.service';
import { Transaction, TransactionEntry, TransactionPage } from './transaction.models';

// The deferral points to its purchase; the transaction also has a financing link (F2).
const TRANSACTION_SELECT =
  '*, transaction_tags(tag_id), author:profiles!transactions_created_by_fkey(display_name), deferral:installment_plans!installment_plans_space_id_source_transaction_id_fkey(installments, rate)';

type Embedded<T> = T | readonly T[] | null;

// PostgREST returns a single object or a list depending on how it reads the foreign key.
function first<T>(value: Embedded<T>): T | null {
  if (Array.isArray(value)) {
    return (value[0] as T | undefined) ?? null;
  }
  return (value as T | null) ?? null;
}

/** Supabase queries for movements. */
@Injectable({ providedIn: 'root' })
export class TransactionsApi {
  private readonly client = inject(SupabaseService).client;

  /** Creates or updates a movement with its tags and card deferral, all or nothing. */
  async save(spaceId: string, entry: TransactionEntry): Promise<ActionResult> {
    const { error, status } = await this.client.rpc('save_transaction', {
      target_id: entry.id,
      target_space_id: spaceId,
      entry_type: entry.type,
      entry_date: entry.date,
      entry_amount: entry.amount,
      entry_account_id: entry.accountId,
      // The generated types have no nulls for arguments with defaults; null is what they mean.
      entry_category_id: entry.categoryId as string,
      entry_to_account_id: entry.toAccountId as string,
      entry_to_amount: entry.toAmount as number,
      entry_adjustment_direction: entry.adjustmentDirection as 'increase',
      entry_note: entry.note,
      entry_include_in_space: entry.includeInSpace as boolean,
      entry_tag_ids: [...entry.tagIds],
      entry_installments: entry.installments,
      entry_monthly_rate: entry.monthlyRate,
    });
    return error ? actionFailed(dataErrorMessage(error, status)) : ACTION_OK;
  }

  /** Deletes a movement; its tags and card deferral go with it. */
  async remove(id: string): Promise<ActionResult> {
    const { data, error, status } = await this.client
      .from('transactions')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) {
      return actionFailed(dataErrorMessage(error, status));
    }
    return data.length > 0 ? ACTION_OK : actionFailed(NOT_ALLOWED_MESSAGE);
  }

  /** Movements of an account (as source or destination), newest first, one page at a time. */
  async fetchForAccount(
    accountId: string,
    offset: number,
    limit: number,
  ): Promise<DataResult<TransactionPage>> {
    const { data, error, status } = await this.client
      .from('transactions')
      .select(TRANSACTION_SELECT)
      .or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      // One more than a page tells whether there is a next one.
      .range(offset, offset + limit);
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    const rows = data ?? [];
    return {
      ok: true,
      value: {
        items: rows.slice(0, limit).map(({ transaction_tags, author, deferral, ...row }) => {
          const plan = first(deferral as Embedded<{ installments: number; rate: number }>);
          return {
            ...row,
            tag_ids: (transaction_tags ?? []).map((link) => link.tag_id),
            author_name: first(author as Embedded<{ display_name: string }>)?.display_name ?? null,
            installments: plan?.installments ?? 1,
            monthly_rate: plan?.rate ?? 0,
          } satisfies Transaction;
        }),
        hasMore: rows.length > limit,
      },
    };
  }

  /** Whether an account has movements, as source or destination. */
  async hasAny(accountId: string): Promise<DataResult<boolean>> {
    const { count, error, status } = await this.client
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .or(`account_id.eq.${accountId},to_account_id.eq.${accountId}`);
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return { ok: true, value: (count ?? 0) > 0 };
  }
}
