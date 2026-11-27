import { Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { Account } from '../../core/accounts/account.models';
import { AccountsService } from '../../core/accounts/accounts.service';
import { NetWorthService } from '../../core/accounts/net-worth.service';
import { ACCOUNT_GROUP_CHOICES, ACCOUNT_GROUP_LABELS } from '../../core/config/catalog.constants';
import { SPACE_DEFAULTS } from '../../core/config/space.constants';
import { ExchangeRateFlow } from '../../core/exchange-rates/exchange-rate-flow';
import {
  ACCOUNT_QUERY_PARAMS,
  APP_PATHS,
  NET_WORTH_VIEW,
  NEW_ITEM_PATH,
} from '../../core/routing/app-paths';
import { SpaceService } from '../../core/spaces/space.service';
import { accountsTotal } from '../../domain/accounts/account-kinds';
import { Button } from '../../shared/ui/atoms/button/button';
import { IconButton } from '../../shared/ui/atoms/icon-button/icon-button';
import { Icon } from '../../shared/ui/atoms/icon/icon';
import { Message } from '../../shared/ui/atoms/message/message';
import { TabOption, Tabs } from '../../shared/ui/atoms/tabs/tabs';
import { Disclosure } from '../../shared/ui/molecules/disclosure/disclosure';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../shared/ui/molecules/section/section';
import { AccountList } from '../../shared/ui/organisms/account-list/account-list';
import { MissingRatesNotice } from '../../shared/ui/organisms/missing-rates-notice/missing-rates-notice';
import { NetWorthGroupView, NetWorthPanel } from '../../shared/ui/organisms/net-worth/net-worth';
import { useShortcuts } from '../../shared/ui/services/keyboard-shortcuts';
import { OverlayService } from '../../shared/ui/services/overlay.service';
import { ListDetailLayout } from '../../shared/ui/templates/list-detail-layout/list-detail-layout';
import { chooseAccountGroup, newAccountQueryParams } from './account-group-chooser';
import { AccountPane, isAccountPane } from './account-pane';
import { toAccountListGroups } from './account-list-groups';

/** The tabs of Cuentas: the list, or "Mis finanzas" (spec §7). */
type AccountsView = 'accounts' | 'net-worth';

const VIEW_TABS: readonly TabOption<AccountsView>[] = [
  { value: 'accounts', label: 'Cuentas' },
  { value: 'net-worth', label: 'Mis finanzas' },
];

/**
 * Accounts of the active space grouped as in spec §4.1, with totals per currency, and their net
 * worth in the "Mis finanzas" tab. An account's detail, and creating or editing one, open next to
 * the list (expanded) or over it (spec §13.5).
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
    Tabs,
    NetWorthPanel,
    MissingRatesNotice,
  ],
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.scss',
})
export class AccountsPage {
  private readonly accountsService = inject(AccountsService);
  private readonly netWorthService = inject(NetWorthService);
  private readonly spaces = inject(SpaceService);
  private readonly overlay = inject(OverlayService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly rateFlow = inject(ExchangeRateFlow);

  /** Query param `vista`: "mis-finanzas" shows the net worth. */
  readonly vista = input<string>();
  protected readonly viewTabs = VIEW_TABS;
  protected readonly view = computed<AccountsView>(() =>
    this.vista() === NET_WORTH_VIEW ? 'net-worth' : 'accounts',
  );
  protected readonly netWorth = this.netWorthService.netWorth;
  protected readonly netWorthError = this.netWorthService.error;
  protected readonly netWorthGroups = computed<NetWorthGroupView[]>(() =>
    (this.netWorth()?.groups ?? []).map((group) => ({
      id: group.group,
      label: ACCOUNT_GROUP_LABELS[group.group],
      icon: ACCOUNT_GROUP_CHOICES[group.group].icon,
      color: ACCOUNT_GROUP_CHOICES[group.group].color,
      totals: group.totals,
      converted: group.converted,
      debt: group.group === 'debts',
    })),
  );

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly loaded = this.accountsService.loaded;
  protected readonly loadError = this.accountsService.loadError;
  /** The account screen open in the detail pane, if any. */
  private readonly detail = signal<AccountPane | null>(null);
  protected readonly detailOpen = computed(() => this.detail() !== null);
  private readonly selectedId = computed(() => this.detail()?.accountId() ?? null);

  protected readonly mainCurrency = computed(
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

  /** The tab goes in the URL, so going back and reloading keep it; an open account stays. */
  protected changeView(view: AccountsView): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [ACCOUNT_QUERY_PARAMS.view]: view === 'net-worth' ? NET_WORTH_VIEW : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected defineRate(currency: string): void {
    void this.rateFlow.open(currency);
  }

  protected onActivate(component: unknown): void {
    this.detail.set(isAccountPane(component) ? component : null);
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
