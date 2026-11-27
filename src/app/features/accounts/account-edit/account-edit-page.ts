import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  resource,
  untracked,
} from '@angular/core';
import { apply, disabled, form, submit } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Account } from '../../../core/accounts/account.models';
import { AccountsService } from '../../../core/accounts/accounts.service';
import { isInUse } from '../../../core/catalogs/catalog-result';
import { ACCOUNT_GROUP_CHOICES } from '../../../core/config/catalog.constants';
import { SPACE_DEFAULTS } from '../../../core/config/space.constants';
import { ROUTE_DATA_KEYS } from '../../../core/routing/app-paths';
import { HasUnsavedChanges } from '../../../core/routing/unsaved-changes.guard';
import { SpaceService } from '../../../core/spaces/space.service';
import { TransactionsService } from '../../../core/transactions/transactions.service';
import { Button } from '../../../shared/ui/atoms/button/button';
import { Message } from '../../../shared/ui/atoms/message/message';
import { FALLBACK_COLOR } from '../../../shared/ui/colors/color-palette';
import { FormActions } from '../../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../../shared/ui/molecules/form/form';
import { AccountEditor } from '../../../shared/ui/organisms/account-editor/account-editor';
import {
  accountFormSchema,
  accountFormToRow,
  AccountFormValue,
  accountGroupFromParam,
  accountToFormValue,
  defaultKindFor,
  newAccountFormValue,
} from '../../../shared/ui/organisms/account-editor/account-editor.model';
import { ConfirmService } from '../../../shared/ui/services/confirm.service';
import { useShortcuts } from '../../../shared/ui/services/keyboard-shortcuts';
import { ToastService } from '../../../shared/ui/services/toast.service';
import { SkeletonList } from '../../../shared/ui/molecules/skeleton-list/skeleton-list';
import { FlowLayout } from '../../../shared/ui/templates/flow-layout/flow-layout';
import { AccountPane } from '../account-pane';

/**
 * Creates an account (`…/nueva?grupo=…`) or edits, archives and deletes one (`…/:id/editar`, or
 * `…/:id` in the wizard), as a flow (spec §7, §13.5). The same screen for both. Kind and currency
 * stay locked once the account has movements (spec §4.1).
 */
@Component({
  selector: 'app-account-edit-page',
  imports: [FlowLayout, Form, FormActions, Button, Message, AccountEditor, SkeletonList],
  templateUrl: './account-edit-page.html',
  styleUrl: './account-edit-page.scss',
})
export class AccountEditPage implements HasUnsavedChanges, AccountPane {
  /** Route param; absent when creating. */
  readonly id = input<string>();
  /** `grupo` query param of a new account, from "¿Qué vas a crear?". */
  readonly grupo = input<string>();

  private readonly accounts = inject(AccountsService);
  private readonly spaces = inject(SpaceService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly transactions = inject(TransactionsService);

  /** The account in the detail pane of Cuentas; null while creating one. */
  readonly accountId = computed(() => this.id() ?? null);

  protected readonly existing = computed(() => {
    const id = this.id();
    return id ? (this.accounts.accounts().find((account) => account.id === id) ?? null) : null;
  });
  protected readonly loading = computed(() => !!this.id() && !this.accounts.loaded());
  protected readonly notFound = computed(
    () => !!this.id() && this.accounts.loaded() && !this.existing(),
  );
  protected readonly title = computed(() => {
    if (this.id()) {
      // The name is already large under the bar (spec §13.5): the bar says what the screen does.
      return 'Editar cuenta';
    }
    return ACCOUNT_GROUP_CHOICES[accountGroupFromParam(this.grupo())].newTitle;
  });
  protected readonly archived = computed(() => !!this.existing()?.archived_at);
  private readonly movements = resource({
    params: () => {
      const id = this.id();
      return id ? { id, revision: this.transactions.revision() } : undefined;
    },
    loader: async ({ params }) => {
      const result = await this.transactions.hasAny(params.id);
      return result.ok && result.value;
    },
  });
  /** Kind and currency of an account with movements do not change (spec §4.1). */
  protected readonly locked = computed(() => this.movements.hasValue() && this.movements.value());
  /** Private accounts are writable only by their owner; shared ones by owners and editors. */
  protected readonly canEdit = computed(() => {
    const account = this.existing();
    return (
      this.spaces.canEdit() &&
      (!account || account.visibility === 'shared' || account.owner_id === this.userId())
    );
  });
  private readonly userId = computed(() => this.auth.user()?.id ?? null);
  private readonly ownsAccount = computed(() => {
    const account = this.existing();
    return !account || account.owner_id === this.userId();
  });

  // Local state starts over when another account opens in the same screen (list and detail).
  protected readonly error = linkedSignal<string | undefined, string | null>({
    source: this.id,
    computation: () => null,
  });
  protected readonly actionError = linkedSignal<string | undefined, string | null>({
    source: this.id,
    computation: () => null,
  });
  protected readonly inUse = linkedSignal({ source: this.id, computation: () => false });
  protected readonly busy = linkedSignal({ source: this.id, computation: () => false });

  /**
   * Values to edit, recomputed only when another account opens or the accounts finish loading, so
   * a reload of the list does not wipe what is being edited.
   */
  private readonly loadedValue = computed<AccountFormValue>(() => {
    const id = this.id();
    const group = accountGroupFromParam(this.grupo());
    this.accounts.loaded();
    return untracked(() => {
      const account = id ? this.accounts.find(id) : undefined;
      return account ? this.toFormValue(account) : this.newFormValue(group);
    });
  });
  private readonly model = linkedSignal(() => this.loadedValue());
  /** What the model held when it was loaded or last saved. */
  private readonly baseline = linkedSignal(() => JSON.stringify(this.loadedValue()));

  protected readonly form = form(
    this.model,
    (path) => {
      apply(path, accountFormSchema);
      disabled(path, () => !this.canEdit());
      // Only the owner may hide an account from the other members (spec §3.2).
      disabled(path.isPrivate, () => !this.ownsAccount());
      disabled(path.isDefault, () => this.archived());
      disabled(path.kind, () => this.locked());
      disabled(path.currency, () => this.locked());
    },
    { submission: { action: () => this.save() } },
  );

  constructor() {
    useShortcuts({
      Escape: () => void this.close(),
      'Mod+s': () => this.submitForm(),
    });
  }

  hasUnsavedChanges(): boolean {
    return this.canEdit() && JSON.stringify(this.model()) !== this.baseline();
  }

  protected submitForm(): void {
    if (this.canEdit()) {
      void submit(this.form);
    }
  }

  protected async close(): Promise<void> {
    await this.backToList();
  }

  protected async toggleArchived(): Promise<void> {
    const account = this.existing();
    if (!account) {
      return;
    }
    this.busy.set(true);
    const result = await this.accounts.setArchived(account.id, !account.archived_at);
    this.busy.set(false);
    if (!result.ok) {
      this.actionError.set(result.message);
      return;
    }
    this.inUse.set(false);
    this.actionError.set(null);
    void this.toast.show(account.archived_at ? 'Cuenta restaurada.' : 'Cuenta archivada.');
    if (!account.archived_at) {
      this.markSaved();
      await this.backToList();
    }
  }

  protected async remove(): Promise<void> {
    const account = this.existing();
    if (!account) {
      return;
    }
    const confirmed = await this.confirm.confirm({
      title: `¿Eliminar ${account.name}?`,
      message:
        'Se elimina para siempre. Si solo quieres ocultarla y conservar su historial, archívala.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    const result = await this.accounts.remove(account.id);
    this.busy.set(false);
    if (!result.ok) {
      this.actionError.set(result.message);
      this.inUse.set(isInUse(result));
      return;
    }
    void this.toast.show('Cuenta eliminada.');
    this.markSaved();
    // Under Cuentas the edit screen hangs from the account's detail, which no longer exists.
    const afterDelete = this.route.snapshot.data[ROUTE_DATA_KEYS.afterDelete] as
      string[] | undefined;
    await this.router.navigate(afterDelete ?? ['..'], { relativeTo: this.route });
  }

  private async save(): Promise<void> {
    this.error.set(null);
    this.inUse.set(false);
    const value = this.model();
    const row = accountFormToRow(value, FALLBACK_COLOR);
    const account = this.existing();
    const result = account
      ? await this.accounts.update(account.id, row, value.isDefault)
      : await this.accounts.create(row, value.isDefault);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    void this.toast.show(account ? 'Cuenta guardada.' : 'Cuenta creada.');
    this.markSaved();
    await this.backToList();
  }

  /** Back to where the screen hangs from: the account's detail, Cuentas, or the wizard step. */
  private async backToList(): Promise<void> {
    await this.router.navigate(['..'], { relativeTo: this.route });
  }

  /** Leaving after saving, archiving or deleting needs no confirmation. */
  private markSaved(): void {
    this.baseline.set(JSON.stringify(this.model()));
  }

  private toFormValue(account: Account): AccountFormValue {
    return accountToFormValue(account, this.spaces.defaultAccountId() === account.id);
  }

  private newFormValue(group: ReturnType<typeof accountGroupFromParam>): AccountFormValue {
    const currency = this.spaces.activeSettings()?.main_currency ?? SPACE_DEFAULTS.mainCurrency;
    return newAccountFormValue(currency, undefined, defaultKindFor(group));
  }
}
