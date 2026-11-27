import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Account } from '../../core/accounts/account.models';
import { AccountsService } from '../../core/accounts/accounts.service';
import { SPACE_DEFAULTS } from '../../core/config/space.constants';
import { APP_PATHS, NEW_ITEM_PATH } from '../../core/routing/app-paths';
import { SpaceService } from '../../core/spaces/space.service';
import { accountsTotal } from '../../domain/accounts/account-kinds';
import { Button } from '../../shared/ui/atoms/button/button';
import { IconButton } from '../../shared/ui/atoms/icon-button/icon-button';
import { Icon } from '../../shared/ui/atoms/icon/icon';
import { Message } from '../../shared/ui/atoms/message/message';
import { Disclosure } from '../../shared/ui/molecules/disclosure/disclosure';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../shared/ui/molecules/section/section';
import { AccountList } from '../../shared/ui/organisms/account-list/account-list';
import { useShortcuts } from '../../shared/ui/services/keyboard-shortcuts';
import { OverlayService } from '../../shared/ui/services/overlay.service';
import { ListDetailLayout } from '../../shared/ui/templates/list-detail-layout/list-detail-layout';
import { AccountEditPage } from './account-edit/account-edit-page';
import { chooseAccountGroup, newAccountQueryParams } from './account-group-chooser';
import { toAccountListGroups } from './account-list-groups';

/**
 * Accounts of the active space grouped as in spec §4.1, with totals per currency. Creating and
 * editing open next to the list (expanded) or over it (spec §13.5).
 */
@Component({
  selector: 'app-accounts-page',
  imports: [
    RouterOutlet,
    ListDetailLayout,
    PageHeader,
    Button,
    IconButton,
    Icon,
    Message,
    Section,
    Disclosure,
    AccountList,
  ],
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.scss',
})
export class AccountsPage {
  private readonly accountsService = inject(AccountsService);
  private readonly spaces = inject(SpaceService);
  private readonly overlay = inject(OverlayService);
  private readonly router = inject(Router);

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly loaded = this.accountsService.loaded;
  protected readonly loadError = this.accountsService.loadError;
  /** The account screen open in the detail pane, if any. */
  private readonly detail = signal<AccountEditPage | null>(null);
  protected readonly detailOpen = computed(() => this.detail() !== null);
  private readonly selectedId = computed(() => this.detail()?.id() ?? null);

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
  protected readonly archivedLabel = computed(() => `Archivadas (${this.archived().length})`);
  protected readonly hasArchived = computed(() => this.archived().length > 0);
  protected readonly totals = computed(() => accountsTotal(this.active(), this.mainCurrency()));
  protected readonly groups = computed(() => this.toGroups(this.active()));
  protected readonly archivedGroups = computed(() => this.toGroups(this.archived()));

  constructor() {
    useShortcuts({ n: () => void this.create() });
  }

  protected onActivate(component: unknown): void {
    this.detail.set(component instanceof AccountEditPage ? component : null);
  }

  protected onDeactivate(): void {
    this.detail.set(null);
  }

  /** "¿Qué vas a crear?" (spec §7), then the new account screen for the chosen group. */
  protected async create(): Promise<void> {
    if (!this.canEdit()) {
      return;
    }
    const group = await chooseAccountGroup(this.overlay);
    if (group) {
      await this.router.navigate(['/', APP_PATHS.accounts, NEW_ITEM_PATH], {
        queryParams: newAccountQueryParams(group),
      });
    }
  }

  private toGroups(accounts: readonly Account[]) {
    return toAccountListGroups(accounts, {
      mainCurrency: this.mainCurrency(),
      defaultAccountId: this.spaces.defaultAccountId(),
      selectedId: this.selectedId(),
      linkFor: (id) => ['/', APP_PATHS.accounts, id],
    });
  }
}
