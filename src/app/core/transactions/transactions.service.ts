import { inject, Injectable, signal } from '@angular/core';
import { actionFailed, ActionResult, DataResult } from '../action-result';
import { SpaceService } from '../spaces/space.service';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { TransactionEntry, TransactionPage } from './transaction.models';
import { TransactionsApi } from './transactions.api';

/** Movements of the active space. Balances and totals reload when `revision` changes. */
@Injectable({ providedIn: 'root' })
export class TransactionsService {
  private readonly api = inject(TransactionsApi);
  private readonly spaces = inject(SpaceService);

  private readonly changes = signal(0);

  /** Goes up after every saved or deleted movement. */
  readonly revision = this.changes.asReadonly();

  /** Creates or updates a movement in the active space. */
  async save(entry: TransactionEntry): Promise<ActionResult> {
    const spaceId = this.spaces.activeSpace()?.id;
    if (!spaceId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const saved = await this.api.save(spaceId, entry);
    if (saved.ok) {
      this.changes.update((value) => value + 1);
    }
    return saved;
  }

  /** Deletes a movement with its tags and card deferral. */
  async remove(id: string): Promise<ActionResult> {
    const removed = await this.api.remove(id);
    if (removed.ok) {
      this.changes.update((value) => value + 1);
    }
    return removed;
  }

  /** A page of movements of an account, newest first. */
  forAccount(
    accountId: string,
    offset: number,
    limit: number,
  ): Promise<DataResult<TransactionPage>> {
    return this.api.fetchForAccount(accountId, offset, limit);
  }

  /** Whether an account has movements, so its kind and currency are locked (spec §4.1). */
  hasAny(accountId: string): Promise<DataResult<boolean>> {
    return this.api.hasAny(accountId);
  }
}
