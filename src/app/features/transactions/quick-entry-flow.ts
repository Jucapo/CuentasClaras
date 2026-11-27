import { inject, Injectable } from '@angular/core';
import { Account } from '../../core/accounts/account.models';
import { AccountsService } from '../../core/accounts/accounts.service';
import { ActionResult } from '../../core/action-result';
import { AuthService } from '../../core/auth/auth.service';
import { CategoriesService } from '../../core/categories/categories.service';
import { Category } from '../../core/categories/category.models';
import { TagsService } from '../../core/categories/tags.service';
import { ACCOUNT_GROUP_LABELS } from '../../core/config/catalog.constants';
import {
  DELETE_TRANSACTION_CONFIRM,
  TRANSACTION_SAVED_TEXT,
  TRANSACTION_TYPE_LABELS,
} from '../../core/config/transaction.constants';
import { PeriodService } from '../../core/periods/period.service';
import { SpaceService } from '../../core/spaces/space.service';
import { NOT_ALLOWED_MESSAGE } from '../../core/supabase/data-error-messages';
import { Transaction } from '../../core/transactions/transaction.models';
import { TransactionsService } from '../../core/transactions/transactions.service';
import { expressionFromMinor } from '../../domain/money/amount-expression';
import { currencyMinorUnits } from '../../domain/money/currencies';
import {
  QuickEntrySheet,
  QuickEntrySheetData,
  QuickEntrySheetResult,
} from '../../shared/ui/organisms/quick-entry-sheet/quick-entry-sheet';
import {
  defaultTagIds,
  includeInSpaceDefault,
  QuickEntryAccount,
  QuickEntryCategory,
  QuickEntryValue,
  toTransactionEntry,
} from '../../shared/ui/organisms/quick-entry-sheet/quick-entry.model';
import { ConfirmService } from '../../shared/ui/services/confirm.service';
import { OverlayService } from '../../shared/ui/services/overlay.service';
import { ToastService } from '../../shared/ui/services/toast.service';

/** Shown when there is no account to record a movement in. */
const NO_ACCOUNTS_MESSAGE = 'Crea una cuenta para registrar movimientos.';

function toEntryCategory(category: Category): QuickEntryCategory {
  return { id: category.id, name: category.name, defaultTagIds: category.default_tag_ids };
}

/**
 * Opens the quick entry (spec §7) for a category, a transfer or an existing movement, saves what
 * it returns and offers "Deshacer" after creating one. Deleting asks first.
 */
@Injectable({ providedIn: 'root' })
export class QuickEntryFlow {
  private readonly accounts = inject(AccountsService);
  private readonly auth = inject(AuthService);
  private readonly categories = inject(CategoriesService);
  private readonly tags = inject(TagsService);
  private readonly spaces = inject(SpaceService);
  private readonly periods = inject(PeriodService);
  private readonly transactions = inject(TransactionsService);
  private readonly overlay = inject(OverlayService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  /** A new expense or income in a category (from its bubble). */
  async forCategory(categoryId: string): Promise<void> {
    const category = this.categories.find(categoryId);
    const accounts = this.writableAccounts();
    if (!category || !this.canRecord(accounts)) {
      return;
    }
    const subcategories = this.subcategoriesOf(category.id);
    const account = this.defaultAccount(accounts);
    await this.open(
      {
        mode: 'create',
        title: category.name,
        category: toEntryCategory(category),
        subcategories,
        value: {
          ...this.blank(category.kind, account),
          categoryId: category.id,
          tagIds: defaultTagIds(category.id, toEntryCategory(category), subcategories),
        },
      },
      accounts,
      crypto.randomUUID(),
    );
  }

  /** A new transfer from an account (from its detail). */
  async transferFrom(accountId: string): Promise<void> {
    const accounts = this.writableAccounts();
    if (!this.canRecord(accounts)) {
      return;
    }
    const source =
      accounts.find((account) => account.id === accountId) ?? this.defaultAccount(accounts);
    await this.open(
      {
        mode: 'create',
        title: TRANSACTION_TYPE_LABELS.transfer,
        category: null,
        subcategories: [],
        value: {
          ...this.blank('transfer', source),
          toAccountId: accounts.find((account) => account.id !== source?.id)?.id ?? '',
        },
      },
      accounts,
      crypto.randomUUID(),
    );
  }

  /** An existing movement, to edit or delete it. */
  async edit(transaction: Transaction): Promise<void> {
    const accounts = this.writableAccounts();
    if (!accounts.some((account) => account.id === transaction.account_id)) {
      void this.toast.show(NOT_ALLOWED_MESSAGE);
      return;
    }
    const chosen = transaction.category_id ? this.categories.find(transaction.category_id) : null;
    const top = chosen?.parent_id ? this.categories.find(chosen.parent_id) : chosen;
    const source = accounts.find((account) => account.id === transaction.account_id);
    const destination = accounts.find((account) => account.id === transaction.to_account_id);
    const exponent = currencyMinorUnits(source?.currency ?? transaction.currency);
    await this.open(
      {
        mode: 'edit',
        title: top?.name ?? TRANSACTION_TYPE_LABELS[transaction.type],
        category: top ? toEntryCategory(top) : null,
        subcategories: top ? this.subcategoriesOf(top.id) : [],
        value: {
          type: transaction.type,
          expression: expressionFromMinor(transaction.amount, exponent),
          toExpression:
            transaction.to_amount !== null
              ? expressionFromMinor(
                  transaction.to_amount,
                  currencyMinorUnits(destination?.currency ?? ''),
                )
              : '',
          categoryId: transaction.category_id,
          accountId: transaction.account_id,
          toAccountId: transaction.to_account_id ?? '',
          date: transaction.date,
          tagIds: transaction.tag_ids,
          note: transaction.note ?? '',
          includeInSpace: transaction.include_in_space,
          installments: transaction.installments,
          monthlyRatePercent: transaction.monthly_rate * 100,
          adjustmentDirection: transaction.adjustment_direction ?? 'increase',
        },
      },
      accounts,
      transaction.id,
    );
  }

  private async open(
    entry: Pick<QuickEntrySheetData, 'mode' | 'title' | 'category' | 'subcategories' | 'value'>,
    accounts: readonly QuickEntryAccount[],
    id: string,
  ): Promise<void> {
    const context = { accounts };
    let saved: QuickEntryValue | null = null;
    const result = await this.overlay.open<QuickEntrySheetResult, QuickEntrySheetData>(
      QuickEntrySheet,
      {
        label: entry.title,
        size: 'entry',
        autoFocus: 'cc-amount-display .display',
        data: {
          ...entry,
          accounts,
          tags: this.tags
            .activeTags()
            .map((tag) => ({ value: tag.id, label: tag.name, color: tag.color })),
          today: this.periods.today(),
          save: async (value): Promise<ActionResult> => {
            const result = await this.transactions.save(toTransactionEntry(id, value, context));
            if (result.ok) {
              saved = value;
            }
            return result;
          },
        },
      },
    );
    if (result === 'saved' && saved) {
      void this.announceSaved(entry.mode, (saved as QuickEntryValue).type, id);
    } else if (result === 'delete') {
      await this.remove(id);
    }
  }

  // A new movement can be undone from the toast; an edited one cannot (spec §4.2).
  private async announceSaved(
    mode: QuickEntrySheetData['mode'],
    type: QuickEntryValue['type'],
    id: string,
  ): Promise<void> {
    if (mode === 'edit') {
      void this.toast.show(TRANSACTION_SAVED_TEXT.updated);
      return;
    }
    const undo = await this.toast.showWithAction(
      TRANSACTION_SAVED_TEXT.created[type],
      TRANSACTION_SAVED_TEXT.undo,
    );
    if (undo) {
      const removed = await this.transactions.remove(id);
      void this.toast.show(removed.ok ? TRANSACTION_SAVED_TEXT.undone : removed.message);
    }
  }

  private async remove(id: string): Promise<void> {
    const confirmed = await this.confirm.confirm({
      ...DELETE_TRANSACTION_CONFIRM,
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    const removed = await this.transactions.remove(id);
    void this.toast.show(removed.ok ? TRANSACTION_SAVED_TEXT.deleted : removed.message);
  }

  private canRecord(accounts: readonly QuickEntryAccount[]): boolean {
    if (!this.spaces.canEdit()) {
      void this.toast.show(NOT_ALLOWED_MESSAGE);
      return false;
    }
    if (accounts.length === 0) {
      void this.toast.show(NO_ACCOUNTS_MESSAGE);
      return false;
    }
    return true;
  }

  /** Active accounts the user can write: shared ones for editors, plus their own private ones. */
  private writableAccounts(): QuickEntryAccount[] {
    if (!this.spaces.canEdit()) {
      return [];
    }
    const userId = this.auth.user()?.id;
    return this.accounts
      .accounts()
      .filter(
        (account) =>
          !account.archived_at && (account.visibility === 'shared' || account.owner_id === userId),
      )
      .map((account: Account) => ({
        id: account.id,
        name: account.name,
        currency: account.currency,
        isCard: account.kind === 'credit_card',
        isPrivate: account.visibility === 'private',
        includeInSpaceByDefault: account.include_in_space_by_default,
        group: ACCOUNT_GROUP_LABELS[account.account_group],
      }));
  }

  /** The member's default account, else the first one (spec §3.1). */
  private defaultAccount(accounts: readonly QuickEntryAccount[]): QuickEntryAccount | null {
    const defaultId = this.spaces.defaultAccountId();
    return accounts.find((account) => account.id === defaultId) ?? accounts[0] ?? null;
  }

  private subcategoriesOf(categoryId: string): QuickEntryCategory[] {
    return this.categories
      .categories()
      .filter((category) => category.parent_id === categoryId && !category.archived_at)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(toEntryCategory);
  }

  private blank(type: QuickEntryValue['type'], account: QuickEntryAccount | null): QuickEntryValue {
    return {
      type,
      expression: '',
      toExpression: '',
      categoryId: null,
      accountId: account?.id ?? '',
      toAccountId: '',
      date: this.periods.today(),
      tagIds: [],
      note: '',
      includeInSpace: includeInSpaceDefault(account),
      installments: 1,
      monthlyRatePercent: 0,
      adjustmentDirection: 'increase',
    };
  }
}
