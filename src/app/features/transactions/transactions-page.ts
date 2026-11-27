import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { AccountsService } from '../../core/accounts/accounts.service';
import { CategoriesService } from '../../core/categories/categories.service';
import { TagsService } from '../../core/categories/tags.service';
import { ACCOUNT_GROUP_LABELS, CATEGORY_KIND_LABELS } from '../../core/config/catalog.constants';
import { SPACE_DEFAULTS } from '../../core/config/space.constants';
import {
  TRANSACTION_PAGE_SIZE,
  TRANSACTION_SEARCH_DEBOUNCE_MS,
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
} from '../../core/config/transaction.constants';
import { ExchangeRateFlow } from '../../core/exchange-rates/exchange-rate-flow';
import { ExchangeRatesService } from '../../core/exchange-rates/exchange-rates.service';
import { PeriodService } from '../../core/periods/period.service';
import {
  HasUnsavedChanges,
  UNSAVED_CHANGES_CONFIRM,
} from '../../core/routing/unsaved-changes.guard';
import { SpaceMembersService } from '../../core/spaces/space-members.service';
import { SpaceService } from '../../core/spaces/space.service';
import { TotalsService } from '../../core/totals/totals.service';
import { TransactionPage, TransactionQuery } from '../../core/transactions/transaction.models';
import { TransactionsService } from '../../core/transactions/transactions.service';
import { formatMoney } from '../../domain/money/money';
import {
  activeFilterCount,
  filterChipText,
  searchArguments,
  TRANSACTION_FILTER_KEYS,
  TransactionFilterKey,
  TransactionFilters,
} from '../../domain/transactions/transaction-filters';
import { Button } from '../../shared/ui/atoms/button/button';
import { IconButton } from '../../shared/ui/atoms/icon-button/icon-button';
import { Icon } from '../../shared/ui/atoms/icon/icon';
import { Message } from '../../shared/ui/atoms/message/message';
import { TextField } from '../../shared/ui/atoms/text-field/text-field';
import { FilterChip, FilterChips } from '../../shared/ui/molecules/filter-chips/filter-chips';
import {
  OptionPanel,
  OptionPanelData,
  PanelOption,
} from '../../shared/ui/molecules/option-panel/option-panel';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { StatGroup, StatItem } from '../../shared/ui/molecules/stat-group/stat-group';
import { MONEY_FORMAT } from '../../shared/ui/money/money-format';
import { MissingRatesNotice } from '../../shared/ui/organisms/missing-rates-notice/missing-rates-notice';
import { QuickEntry, QuickEntryResult } from '../../shared/ui/organisms/quick-entry/quick-entry';
import {
  TransactionList,
  TransactionListGroup,
} from '../../shared/ui/organisms/transaction-list/transaction-list';
import { ConfirmService } from '../../shared/ui/services/confirm.service';
import { useShortcuts } from '../../shared/ui/services/keyboard-shortcuts';
import { LayoutService } from '../../shared/ui/services/layout.service';
import { OverlayService } from '../../shared/ui/services/overlay.service';
import { ListDetailLayout } from '../../shared/ui/templates/list-detail-layout/list-detail-layout';
import { QuickEntryFlow, QuickEntrySession } from './quick-entry-flow';
import { injectTransactionLookups, toTransactionGroups } from './transaction-items';
import { TransactionFiltersStore } from './transaction-filters.store';
import {
  outsideSpaceNote,
  TRANSACTION_FILTER_LABELS,
  TRANSACTIONS_TEXT,
} from './transaction-texts';

/**
 * Transacciones (spec §7): the movements of the global period that the user sees, by day, with a
 * search, filters as chips and the totals of what is listed. A movement opens in the quick entry:
 * in an overlay in the compact and medium classes, and beside the list in the expanded one, where
 * leaving it with unsaved changes asks first.
 */
@Component({
  selector: 'app-transactions-page',
  imports: [
    PageHeader,
    IconButton,
    Icon,
    Button,
    Message,
    TextField,
    FilterChips,
    StatGroup,
    MissingRatesNotice,
    TransactionList,
    ListDetailLayout,
    QuickEntry,
  ],
  templateUrl: './transactions-page.html',
  styleUrl: './transactions-page.scss',
})
export class TransactionsPage implements HasUnsavedChanges {
  private readonly accounts = inject(AccountsService);
  private readonly categories = inject(CategoriesService);
  private readonly tags = inject(TagsService);
  private readonly members = inject(SpaceMembersService);
  private readonly spaces = inject(SpaceService);
  private readonly periods = inject(PeriodService);
  private readonly transactions = inject(TransactionsService);
  private readonly totalsService = inject(TotalsService);
  private readonly rates = inject(ExchangeRatesService);
  private readonly rateFlow = inject(ExchangeRateFlow);
  private readonly flow = inject(QuickEntryFlow);
  private readonly overlay = inject(OverlayService);
  private readonly confirm = inject(ConfirmService);
  private readonly layout = inject(LayoutService);
  private readonly format = inject(MONEY_FORMAT);
  private readonly store = inject(TransactionFiltersStore);
  private readonly lookups = injectTransactionLookups();

  protected readonly text = TRANSACTIONS_TEXT;
  protected readonly canEdit = this.spaces.canEdit;
  protected readonly query = this.store.query;

  private readonly mainCurrency = computed(
    () => this.spaces.activeSettings()?.main_currency ?? SPACE_DEFAULTS.mainCurrency,
  );

  // The search runs a moment after the last key, not on every one.
  private readonly settledQuery = signal(this.store.query());
  private readonly transactionQuery = computed<TransactionQuery>(() => ({
    range: this.periods.range(),
    search: searchArguments(this.settledQuery(), this.format().numberFormat, this.mainCurrency()),
    filters: this.store.filters(),
  }));

  /** Pages shown; back to one when the period, the search or the filters change. */
  private readonly pages = linkedSignal({ source: this.transactionQuery, computation: () => 1 });

  private readonly listStore = resource({
    params: () => ({
      spaceId: this.spaces.activeSpace()?.id,
      query: this.transactionQuery(),
      pages: this.pages(),
      revision: this.transactions.revision(),
    }),
    loader: async ({ params }) => {
      const result = await this.transactions.search(
        params.query,
        0,
        params.pages * TRANSACTION_PAGE_SIZE,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  private readonly totalsStore = resource({
    params: () => ({
      spaceId: this.spaces.activeSpace()?.id,
      query: this.transactionQuery(),
      revision: this.transactions.revision(),
      rates: this.rates.revision(),
    }),
    loader: async ({ params }) => {
      const result = await this.totalsService.forTransactions(params.query);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  // Keeps what was listed while the next page or search loads, instead of emptying the list.
  private readonly page = linkedSignal<TransactionPage | undefined, TransactionPage | null>({
    source: () => (this.listStore.hasValue() ? this.listStore.value() : undefined),
    computation: (value, previous) => value ?? previous?.value ?? null,
  });
  private readonly movements = computed(() => this.page()?.items ?? []);

  protected readonly loading = computed(() => this.listStore.isLoading());
  protected readonly hasMore = computed(() => this.page()?.hasMore ?? false);
  protected readonly listError = computed(() => this.listStore.error()?.message ?? null);
  protected readonly groups = computed<TransactionListGroup[]>(() =>
    toTransactionGroups(this.movements(), this.lookups(), 'space', this.periods.today()),
  );
  protected readonly filtering = computed(
    () =>
      this.transactionQuery().search.terms.length > 0 ||
      activeFilterCount(this.store.filters()) > 0,
  );
  protected readonly emptyText = computed(() =>
    this.filtering() ? TRANSACTIONS_TEXT.noMatches : TRANSACTIONS_TEXT.empty(this.periods.title()),
  );
  protected readonly showClearAll = computed(
    () => this.filtering() && !this.loading() && this.movements().length === 0,
  );

  private readonly totals = computed(() =>
    this.totalsStore.hasValue() ? this.totalsStore.value() : null,
  );
  protected readonly statItems = computed<StatItem[]>(() => {
    const totals = this.totals();
    if (!totals) {
      return [];
    }
    return [
      {
        label: TRANSACTIONS_TEXT.income,
        amount: totals.income,
        currency: totals.currency,
        signed: true,
      },
      { label: TRANSACTIONS_TEXT.expense, amount: -totals.expense, currency: totals.currency },
      {
        label: TRANSACTIONS_TEXT.net,
        amount: totals.net,
        currency: totals.currency,
        tone: 'auto',
        signed: true,
      },
    ];
  });
  /** Why the totals may differ from Inicio and Presupuesto (spec §7). */
  protected readonly outsideSpaceNote = computed(() => {
    const totals = this.totals();
    if (!totals) {
      return null;
    }
    const format = this.format();
    const text = (amount: number) =>
      amount > 0 ? formatMoney(amount, totals.currency, format) : null;
    return outsideSpaceNote(text(totals.outsideSpace.expense), text(totals.outsideSpace.income));
  });
  protected readonly missingRates = computed(() => this.totals()?.missingRateCurrencies ?? []);

  /** What each filter can pick, in the order its panel lists them. */
  private readonly filterOptions = computed<
    Readonly<Record<TransactionFilterKey, readonly PanelOption<string>[]>>
  >(() => ({
    accountIds: this.accountOptions(),
    categoryIds: this.categoryOptions(),
    tagIds: this.tagOptions(),
    types: Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    authorIds: this.members
      .members()
      .map((member) => ({ value: member.userId, label: member.displayName })),
    statuses: Object.entries(TRANSACTION_STATUS_LABELS).map(([value, label]) => ({ value, label })),
  }));
  /** "Persona" only makes sense with more than one member (spec §7). */
  private readonly filterKeys = computed(() =>
    TRANSACTION_FILTER_KEYS.filter(
      (key) => key !== 'authorIds' || this.members.members().length > 1,
    ),
  );
  /** The filter whose options are open. */
  protected readonly openFilterKey = signal<TransactionFilterKey | null>(null);
  protected readonly chips = computed<FilterChip[]>(() => {
    const filters = this.store.filters();
    const options = this.filterOptions();
    return this.filterKeys().map((key) => {
      const picked: readonly string[] = filters[key];
      const labels = options[key]
        .filter((option) => picked.includes(option.value))
        .map((option) => option.label);
      return { key, label: TRANSACTION_FILTER_LABELS[key], summary: filterChipText(labels) };
    });
  });

  /** The quick entry beside the list (expanded class), if one is open. */
  protected readonly session = signal<QuickEntrySession | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  private readonly entry = viewChild(QuickEntry);

  constructor() {
    effect((onCleanup) => {
      const query = this.store.query();
      const timer = setTimeout(() => this.settledQuery.set(query), TRANSACTION_SEARCH_DEBOUNCE_MS);
      onCleanup(() => clearTimeout(timer));
    });
    useShortcuts({ n: () => void this.create() });
  }

  hasUnsavedChanges(): boolean {
    return this.entry()?.hasUnsavedChanges() ?? false;
  }

  protected loadMore(): void {
    this.pages.update((pages) => pages + 1);
  }

  protected async open(id: string): Promise<void> {
    const movement = this.movements().find((candidate) => candidate.id === id);
    if (!movement) {
      return;
    }
    if (!this.layout.isExpanded()) {
      await this.flow.edit(movement);
      return;
    }
    if (this.selectedId() === id || !(await this.confirmDiscard())) {
      return;
    }
    const session = this.flow.editSession(movement);
    if (session) {
      this.session.set(session);
      this.selectedId.set(id);
    }
  }

  protected async create(): Promise<void> {
    if (!this.canEdit() || !(await this.confirmDiscard())) {
      return;
    }
    const session = await this.flow.chooseNew();
    if (!session) {
      return;
    }
    if (this.layout.isExpanded()) {
      this.session.set(session);
      this.selectedId.set(null);
    } else {
      await this.flow.present(session);
    }
  }

  protected async closed(result: QuickEntryResult): Promise<void> {
    const session = this.session();
    if (!session) {
      return;
    }
    if (result === 'cancel') {
      if (await this.confirmDiscard()) {
        this.closePane();
      }
      return;
    }
    // Deleting asks first; keeping the movement leaves it open.
    if (await session.finish(result)) {
      this.closePane();
    }
  }

  protected async openFilter(key: string): Promise<void> {
    const filterKey = key as TransactionFilterKey;
    const label = TRANSACTION_FILTER_LABELS[filterKey];
    this.openFilterKey.set(filterKey);
    const picked = await this.overlay.open<readonly string[], OptionPanelData<string>>(
      OptionPanel,
      {
        label,
        data: {
          title: label,
          mode: 'multiple',
          options: this.filterOptions()[filterKey],
          selected: this.store.filters()[filterKey],
        },
      },
    );
    this.openFilterKey.set(null);
    if (picked) {
      this.store.set(filterKey, picked as TransactionFilters[typeof filterKey]);
    }
  }

  protected clearFilter(key: string): void {
    this.store.set(key as TransactionFilterKey, []);
  }

  protected clearFilters(): void {
    this.store.clearFilters();
  }

  protected clearAll(): void {
    this.store.reset();
    this.settledQuery.set('');
  }

  protected defineRate(currency: string): void {
    void this.rateFlow.open(currency);
  }

  private closePane(): void {
    this.session.set(null);
    this.selectedId.set(null);
  }

  private async confirmDiscard(): Promise<boolean> {
    if (!this.hasUnsavedChanges()) {
      return true;
    }
    return this.confirm.confirm({ ...UNSAVED_CHANGES_CONFIRM, destructive: true });
  }

  private accountOptions(): PanelOption<string>[] {
    const accounts = this.accounts.accounts();
    const active = accounts.filter((account) => !account.archived_at);
    const archived = accounts.filter((account) => account.archived_at);
    return [
      ...active.map((account) => ({
        value: account.id,
        label: account.name,
        icon: account.icon,
        color: account.color,
        group: ACCOUNT_GROUP_LABELS[account.account_group],
      })),
      ...archived.map((account) => ({
        value: account.id,
        label: account.name,
        icon: account.icon,
        color: account.color,
        group: TRANSACTIONS_TEXT.archived,
      })),
    ];
  }

  /** Each category followed by its subcategories ("Padre › Hija"), expenses first. */
  private categoryOptions(): PanelOption<string>[] {
    return (['expense', 'income'] as const).flatMap((kind) =>
      this.categories.tree(kind).flatMap(({ category, children }) => [
        {
          value: category.id,
          label: category.name,
          icon: category.icon,
          color: category.color,
          group: CATEGORY_KIND_LABELS[kind],
        },
        ...children.map((child) => ({
          value: child.id,
          label: `${category.name} › ${child.name}`,
          icon: child.icon,
          color: child.color ?? category.color,
          group: CATEGORY_KIND_LABELS[kind],
        })),
      ]),
    );
  }

  private tagOptions(): PanelOption<string>[] {
    const tags = this.tags.tags();
    return [
      ...tags.filter((tag) => !tag.archived_at),
      ...tags.filter((tag) => tag.archived_at),
    ].map((tag) => ({
      value: tag.id,
      label: tag.name,
      color: tag.color,
      icon: 'sell',
      description: tag.archived_at ? TRANSACTIONS_TEXT.archivedOne : undefined,
    }));
  }
}
