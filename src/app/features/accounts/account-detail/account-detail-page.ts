import { Component, computed, effect, inject, input, resource, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountsService } from '../../../core/accounts/accounts.service';
import { AuthService } from '../../../core/auth/auth.service';
import {
  TRANSACTION_PAGE_SIZE,
  TRANSACTION_SAVED_TEXT,
} from '../../../core/config/transaction.constants';
import { PeriodService } from '../../../core/periods/period.service';
import { ACCOUNT_PATHS } from '../../../core/routing/app-paths';
import { SpaceService } from '../../../core/spaces/space.service';
import { Transaction } from '../../../core/transactions/transaction.models';
import { TransactionsService } from '../../../core/transactions/transactions.service';
import {
  isDebtKind,
  toDisplayedBalance,
  toStoredBalance,
} from '../../../domain/accounts/account-kinds';
import { adjustmentFor } from '../../../domain/transactions/transactions';
import { Amount } from '../../../shared/ui/atoms/amount/amount';
import { Button } from '../../../shared/ui/atoms/button/button';
import { IconBadge } from '../../../shared/ui/atoms/icon-badge/icon-badge';
import { IconButton } from '../../../shared/ui/atoms/icon-button/icon-button';
import { Message } from '../../../shared/ui/atoms/message/message';
import {
  AmountPanel,
  AmountPanelData,
  AmountPanelResult,
} from '../../../shared/ui/molecules/amount-panel/amount-panel';
import { FormActions } from '../../../shared/ui/molecules/form-actions/form-actions';
import { PageHeader } from '../../../shared/ui/molecules/page-header/page-header';
import {
  TransactionList,
  TransactionListGroup,
} from '../../../shared/ui/organisms/transaction-list/transaction-list';
import { OverlayService } from '../../../shared/ui/services/overlay.service';
import { ToastService } from '../../../shared/ui/services/toast.service';
import { QuickEntryFlow } from '../../transactions/quick-entry-flow';
import {
  injectTransactionLookups,
  toTransactionGroups,
} from '../../transactions/transaction-items';
import { AccountPane } from '../account-pane';

/**
 * An account (spec §7): its balance and its movements by day, newest first. A movement opens in the
 * quick entry to edit or delete it. Transfers start here, and "Ajustar al saldo real" records the
 * difference with the bank as an adjustment.
 */
@Component({
  selector: 'app-account-detail-page',
  imports: [
    PageHeader,
    IconBadge,
    IconButton,
    Amount,
    Button,
    FormActions,
    Message,
    TransactionList,
  ],
  templateUrl: './account-detail-page.html',
  styleUrl: './account-detail-page.scss',
})
export class AccountDetailPage implements AccountPane {
  /** Route param, inherited from the componentless `:id` route. */
  readonly id = input<string>();

  private readonly accounts = inject(AccountsService);
  private readonly auth = inject(AuthService);
  private readonly lookups = injectTransactionLookups();
  private readonly spaces = inject(SpaceService);
  private readonly periods = inject(PeriodService);
  private readonly transactions = inject(TransactionsService);
  private readonly quickEntry = inject(QuickEntryFlow);
  private readonly overlay = inject(OverlayService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** The account in the detail pane of Cuentas. */
  readonly accountId = computed(() => this.id() ?? null);

  protected readonly account = computed(() => {
    const id = this.id();
    return id ? this.accounts.find(id) : null;
  });
  protected readonly editLink = [ACCOUNT_PATHS.edit];
  protected readonly isDebt = computed(() => {
    const account = this.account();
    return !!account && isDebtKind(account.kind);
  });
  /** As the user sees it: debts in positive. */
  protected readonly displayedBalance = computed(() => {
    const account = this.account();
    return account ? toDisplayedBalance(account.kind, account.balance) : 0;
  });
  /** Owners and editors write shared accounts; private ones only their owner (spec §8). */
  protected readonly canWrite = computed(() => {
    const account = this.account();
    return (
      !!account &&
      this.spaces.canEdit() &&
      (account.visibility === 'shared' || account.owner_id === this.auth.user()?.id)
    );
  });

  private readonly pages = signal(1);
  private readonly page = resource({
    params: () => {
      const id = this.id();
      return id ? { id, pages: this.pages(), revision: this.transactions.revision() } : undefined;
    },
    loader: async ({ params }) => {
      const result = await this.transactions.forAccount(
        params.id,
        0,
        params.pages * TRANSACTION_PAGE_SIZE,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });
  private readonly movements = computed<readonly Transaction[]>(() =>
    this.page.hasValue() ? this.page.value().items : [],
  );
  protected readonly hasMore = computed(() => this.page.hasValue() && this.page.value().hasMore);
  protected readonly loadingMovements = computed(() => this.page.isLoading());
  protected readonly movementsError = computed(() => this.page.error()?.message ?? null);
  protected readonly listLabel = computed(() => `Movimientos de ${this.account()?.name ?? ''}`);

  protected readonly groups = computed<TransactionListGroup[]>(() => {
    const account = this.account();
    if (!account) {
      return [];
    }
    return toTransactionGroups(
      this.movements(),
      this.lookups(),
      { accountId: account.id, currency: account.currency },
      this.periods.today(),
    );
  });

  constructor() {
    // A deleted (or unknown) account has no detail: back to the list.
    effect(() => {
      if (this.accounts.loaded() && this.id() && !this.account()) {
        void this.router.navigate(['..'], { relativeTo: this.route });
      }
    });
  }

  protected loadMore(): void {
    this.pages.update((pages) => pages + 1);
  }

  protected transfer(): void {
    const account = this.account();
    if (account) {
      void this.quickEntry.transferFrom(account.id);
    }
  }

  protected open(id: string): void {
    const movement = this.movements().find((candidate) => candidate.id === id);
    if (movement) {
      void this.quickEntry.edit(movement);
    }
  }

  /** "Ajustar al saldo real": the balance the bank shows, as the user sees it (spec §5.1 a). */
  protected async adjust(): Promise<void> {
    const account = this.account();
    if (!account) {
      return;
    }
    const result = await this.overlay.open<AmountPanelResult, AmountPanelData>(AmountPanel, {
      label: 'Ajustar al saldo real',
      autoFocus: 'input',
      data: {
        title: 'Ajustar al saldo real',
        label: isDebtKind(account.kind) ? 'Lo que debes según el banco' : 'Saldo según el banco',
        hint: 'Se registra un ajuste por la diferencia.',
        currency: account.currency,
        value: toDisplayedBalance(account.kind, account.balance),
        allowNegative: true,
        requiredMessage: 'Escribe el saldo real; puede ser 0.',
      },
    });
    if (!result) {
      return;
    }
    // Compared as stored, so debts (negative) move in the right direction.
    const adjustment = adjustmentFor(account.balance, toStoredBalance(account.kind, result.amount));
    if (!adjustment) {
      void this.toast.show('El saldo ya coincide.');
      return;
    }
    const id = crypto.randomUUID();
    const saved = await this.transactions.save({
      id,
      type: 'adjustment',
      date: this.periods.today(),
      amount: adjustment.amount,
      accountId: account.id,
      categoryId: null,
      toAccountId: null,
      toAmount: null,
      adjustmentDirection: adjustment.direction,
      note: '',
      includeInSpace: false,
      tagIds: [],
      installments: 1,
      monthlyRate: 0,
    });
    if (!saved.ok) {
      void this.toast.show(saved.message);
      return;
    }
    const undo = await this.toast.showWithAction(
      TRANSACTION_SAVED_TEXT.created.adjustment,
      TRANSACTION_SAVED_TEXT.undo,
    );
    if (undo) {
      const removed = await this.transactions.remove(id);
      void this.toast.show(removed.ok ? TRANSACTION_SAVED_TEXT.undone : removed.message);
    }
  }
}
