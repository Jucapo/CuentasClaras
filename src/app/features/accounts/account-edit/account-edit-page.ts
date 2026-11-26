import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { apply, disabled, form } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { AccountsService } from '../../../core/accounts/accounts.service';
import { isInUse } from '../../../core/catalogs/catalog-result';
import { SPACE_DEFAULTS } from '../../../core/config/space.constants';
import { APP_PATHS } from '../../../core/routing/app-paths';
import { SpaceService } from '../../../core/spaces/space.service';
import { Button } from '../../../shared/ui/atoms/button/button';
import { Message } from '../../../shared/ui/atoms/message/message';
import { FALLBACK_COLOR } from '../../../shared/ui/colors/color-palette';
import { FormActions } from '../../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../../shared/ui/molecules/form/form';
import { PageHeader } from '../../../shared/ui/molecules/page-header/page-header';
import { AccountForm } from '../../../shared/ui/organisms/account-form/account-form';
import {
  accountFormSchema,
  accountFormToRow,
  AccountFormValue,
  accountToFormValue,
  newAccountFormValue,
} from '../../../shared/ui/organisms/account-form/account-form.model';
import { ConfirmService } from '../../../shared/ui/services/confirm.service';
import { ToastService } from '../../../shared/ui/services/toast.service';

/** Creates an account (`/cuentas/nueva`) or edits, archives and deletes one (`/cuentas/:id`). */
@Component({
  selector: 'app-account-edit-page',
  imports: [PageHeader, Form, FormActions, Button, Message, AccountForm],
  templateUrl: './account-edit-page.html',
  styleUrl: './account-edit-page.scss',
})
export class AccountEditPage {
  /** Route param; absent when creating. */
  readonly id = input<string>();

  private readonly accounts = inject(AccountsService);
  private readonly spaces = inject(SpaceService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly backLink = ['/', APP_PATHS.accounts];
  protected readonly existing = computed(() => {
    const id = this.id();
    return id ? (this.accounts.accounts().find((account) => account.id === id) ?? null) : null;
  });
  protected readonly notFound = computed(
    () => !!this.id() && this.accounts.loaded() && !this.existing(),
  );
  protected readonly title = computed(() =>
    this.id() ? (this.existing()?.name ?? 'Cuenta') : 'Nueva cuenta',
  );
  protected readonly archived = computed(() => !!this.existing()?.archived_at);
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

  protected readonly error = signal<string | null>(null);
  /** Error of archiving or deleting, shown next to those buttons. */
  protected readonly actionError = signal<string | null>(null);
  protected readonly inUse = signal(false);
  protected readonly busy = signal(false);

  private readonly model = linkedSignal<AccountFormValue>(() => {
    const account = this.existing();
    return account
      ? accountToFormValue(account, this.spaces.defaultAccountId() === account.id)
      : newAccountFormValue(
          this.spaces.activeSettings()?.main_currency ?? SPACE_DEFAULTS.mainCurrency,
        );
  });
  protected readonly form = form(
    this.model,
    (path) => {
      apply(path, accountFormSchema);
      disabled(path, () => !this.canEdit());
      // Only the owner may hide an account from the other members (spec §3.2).
      disabled(path.isPrivate, () => !this.ownsAccount());
      disabled(path.isDefault, () => this.archived());
    },
    { submission: { action: () => this.save() } },
  );

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
      await this.router.navigate(this.backLink);
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
    await this.router.navigate(this.backLink);
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
    await this.router.navigate(this.backLink);
  }
}
