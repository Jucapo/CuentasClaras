import { computed, inject, Injectable, resource } from '@angular/core';
import { ActionResult, actionFailed, DataResult } from '../action-result';
import { DeleteResult } from '../catalogs/catalog-result';
import { SpaceService } from '../spaces/space.service';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { TransactionsService } from '../transactions/transactions.service';
import { Account, AccountPatch, NewAccount } from './account.models';
import { AccountsApi } from './accounts.api';

/** Accounts of the active space; reloads when the space changes or after every change. */
@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly api = inject(AccountsApi);
  private readonly spaces = inject(SpaceService);
  private readonly transactions = inject(TransactionsService);

  private readonly store = resource({
    params: () => {
      const spaceId = this.spaces.activeSpace()?.id;
      // Balances are sums of movements: they reload whenever a movement changes.
      return spaceId ? { spaceId, revision: this.transactions.revision() } : undefined;
    },
    loader: async ({ params: { spaceId } }) => {
      const result = await this.api.fetch(spaceId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  /** Every account the user can see, archived ones included, in their saved order. */
  readonly accounts = computed<readonly Account[]>(() =>
    this.store.hasValue() ? this.store.value() : [],
  );
  readonly loading = computed(() => this.store.isLoading());
  readonly loaded = computed(() => this.store.hasValue());
  readonly loadError = computed(() => this.store.error()?.message ?? null);

  /** One account by id, once loaded. */
  find(id: string): Account | null {
    return this.accounts().find((account) => account.id === id) ?? null;
  }

  /** Creates an account in the active space and, if asked, makes it the user's default. */
  async create(
    account: Omit<NewAccount, 'space_id'>,
    makeDefault: boolean,
  ): Promise<DataResult<string>> {
    const spaceId = this.spaces.activeSpace()?.id;
    if (!spaceId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const created = await this.api.create({ ...account, space_id: spaceId });
    if (!created.ok) {
      return created;
    }
    this.store.reload();
    if (makeDefault) {
      const defaulted = await this.spaces.setDefaultAccount(created.value);
      if (!defaulted.ok) {
        return defaulted;
      }
    }
    return created;
  }

  /** Saves an account and whether it is the user's default. */
  async update(id: string, patch: AccountPatch, makeDefault: boolean): Promise<ActionResult> {
    const saved = await this.api.update(id, patch);
    if (!saved.ok) {
      return saved;
    }
    this.syncDefaultAfterChange(id, patch);
    this.store.reload();
    const isDefault = this.spaces.defaultAccountId() === id;
    if (makeDefault !== isDefault && !patch.archived_at) {
      return this.spaces.setDefaultAccount(makeDefault ? id : null);
    }
    return saved;
  }

  /** Archives (hides) or restores an account. */
  async setArchived(id: string, archived: boolean): Promise<ActionResult> {
    const patch: AccountPatch = { archived_at: archived ? new Date().toISOString() : null };
    const saved = await this.api.update(id, patch);
    if (saved.ok) {
      this.syncDefaultAfterChange(id, patch);
      this.store.reload();
    }
    return saved;
  }

  /** Deletes an account; fails with `inUse` when it has movements. */
  async remove(id: string): Promise<DeleteResult> {
    const deleted = await this.api.remove(id);
    if (deleted.ok) {
      this.spaces.forgetDefaultAccount(id);
      this.store.reload();
    }
    return deleted;
  }

  // The database clears a default that becomes archived or private (for others); mirror it here.
  private syncDefaultAfterChange(id: string, patch: AccountPatch): void {
    if (patch.archived_at) {
      this.spaces.forgetDefaultAccount(id);
    }
  }
}
