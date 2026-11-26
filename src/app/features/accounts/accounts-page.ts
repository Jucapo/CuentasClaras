import { Component, computed, inject, signal } from '@angular/core';
import { Account } from '../../core/accounts/account.models';
import { AccountsService } from '../../core/accounts/accounts.service';
import { ACCOUNT_GROUP_LABELS } from '../../core/config/catalog.constants';
import { SPACE_DEFAULTS } from '../../core/config/space.constants';
import { APP_PATHS, NEW_ITEM_PATH } from '../../core/routing/app-paths';
import { SpaceService } from '../../core/spaces/space.service';
import {
  ACCOUNT_KIND_GROUP,
  accountsTotal,
  groupAccounts,
} from '../../domain/accounts/account-kinds';
import { Button } from '../../shared/ui/atoms/button/button';
import { Message } from '../../shared/ui/atoms/message/message';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../shared/ui/molecules/section/section';
import {
  AccountList,
  AccountListGroup,
  AccountListItem,
} from '../../shared/ui/organisms/account-list/account-list';

/** Accounts of the active space grouped as in spec §4.1, with totals per currency. */
@Component({
  selector: 'app-accounts-page',
  imports: [PageHeader, Button, Message, Section, AccountList],
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.scss',
})
export class AccountsPage {
  private readonly accountsService = inject(AccountsService);
  private readonly spaces = inject(SpaceService);

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly loaded = this.accountsService.loaded;
  protected readonly loadError = this.accountsService.loadError;
  protected readonly newAccountLink = ['/', APP_PATHS.accounts, NEW_ITEM_PATH];
  protected readonly showArchived = signal(false);

  private readonly mainCurrency = computed(
    () => this.spaces.activeSettings()?.main_currency ?? SPACE_DEFAULTS.mainCurrency,
  );
  private readonly active = computed(() =>
    this.accountsService.accounts().filter((account) => !account.archived_at),
  );
  private readonly archived = computed(() =>
    this.accountsService.accounts().filter((account) => account.archived_at),
  );

  protected readonly isEmpty = computed(() => this.loaded() && this.active().length === 0);
  protected readonly archivedCount = computed(() => this.archived().length);
  protected readonly totals = computed(() => accountsTotal(this.active(), this.mainCurrency()));
  protected readonly groups = computed(() => this.toGroups(this.active()));
  protected readonly archivedGroups = computed(() => this.toGroups(this.archived()));

  private toGroups(accounts: readonly Account[]): AccountListGroup[] {
    return groupAccounts(accounts, this.mainCurrency()).map((summary) => ({
      id: summary.group,
      label: ACCOUNT_GROUP_LABELS[summary.group],
      totals: summary.totals,
      accounts: summary.accounts.map((account) => this.toItem(account)),
    }));
  }

  private toItem(account: Account): AccountListItem {
    const notes = [
      account.visibility === 'private' ? 'Privada' : null,
      account.id === this.spaces.defaultAccountId() ? 'Predeterminada' : null,
      // Only the Accounts group counts by default, so only an exception there is worth noting.
      ACCOUNT_KIND_GROUP[account.kind] === 'accounts' && !account.include_in_total
        ? 'No suma en el total'
        : null,
    ].filter(Boolean);
    return {
      id: account.id,
      name: account.name,
      icon: account.icon,
      color: account.color,
      balance: account.balance,
      currency: account.currency,
      notes: notes.join(' · ') || undefined,
      link: ['/', APP_PATHS.accounts, account.id],
      archived: !!account.archived_at,
    };
  }
}
