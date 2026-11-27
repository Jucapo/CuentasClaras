import { computed, inject, Signal } from '@angular/core';
import { Account } from '../../core/accounts/account.models';
import { AccountsService } from '../../core/accounts/accounts.service';
import { AuthService } from '../../core/auth/auth.service';
import { CategoriesService } from '../../core/categories/categories.service';
import { Category } from '../../core/categories/category.models';
import { TagsService } from '../../core/categories/tags.service';
import { SpaceService } from '../../core/spaces/space.service';
import {
  TRANSACTION_TYPE_LABELS,
  UNCATEGORIZED_LOOK,
} from '../../core/config/transaction.constants';
import { Transaction } from '../../core/transactions/transaction.models';
import { effectiveColor } from '../../domain/categories/category-tree';
import { IsoDate } from '../../domain/dates/local-date';
import { dayTitle } from '../../domain/periods/period-labels';
import { groupByDay } from '../../domain/transactions/group-by-day';
import {
  balanceDelta,
  isPrivateMovement,
  spaceAmount,
} from '../../domain/transactions/transactions';
import {
  TransactionListGroup,
  TransactionListItem,
} from '../../shared/ui/organisms/transaction-list/transaction-list';

/** What wording a movement needs from the rest of the space. */
export interface TransactionLookups {
  /** A visible account; null for someone else's private one. */
  readonly account: (id: string) => Account | null;
  readonly category: (id: string) => Category | null;
  readonly tagNames: (ids: readonly string[]) => string[];
  readonly userId: string | null;
  /** Whether the user is an owner or editor of the space. */
  readonly canEdit: boolean;
}

/**
 * Where the list is seen from: an account (its detail, amounts signed by their effect on it) or the
 * whole space (Transacciones).
 */
export type TransactionPerspective =
  { readonly accountId: string; readonly currency: string } | 'space';

const SEPARATOR = ' · ';

/** Lookups over the catalogs of the active space, kept current; call in an injection context. */
export function injectTransactionLookups(): Signal<TransactionLookups> {
  const accounts = inject(AccountsService);
  const categories = inject(CategoriesService);
  const tags = inject(TagsService);
  const auth = inject(AuthService);
  const spaces = inject(SpaceService);
  return computed(() => {
    const accountById = new Map(accounts.accounts().map((account) => [account.id, account]));
    const categoryById = new Map(
      categories.categories().map((category) => [category.id, category]),
    );
    const tagList = tags.tags();
    return {
      account: (id) => accountById.get(id) ?? null,
      category: (id) => categoryById.get(id) ?? null,
      // In the order of the tags of the space, not of the movement.
      tagNames: (ids) => tagList.filter((tag) => ids.includes(tag.id)).map((tag) => tag.name),
      userId: auth.user()?.id ?? null,
      canEdit: spaces.canEdit(),
    };
  });
}

/** Name of an account, or "Cuenta privada de X" when the user cannot see it (spec §3.2). */
function accountName(id: string | null, movement: Transaction, lookups: TransactionLookups) {
  const account = id ? lookups.account(id) : null;
  if (account) {
    return account.name;
  }
  return movement.author_name ? `Cuenta privada de ${movement.author_name}` : 'Cuenta privada';
}

function look(movement: Transaction, lookups: TransactionLookups) {
  if (movement.type === 'transfer' || movement.type === 'adjustment') {
    return UNCATEGORIZED_LOOK[movement.type];
  }
  const category = movement.category_id ? lookups.category(movement.category_id) : null;
  const parent = category?.parent_id ? lookups.category(category.parent_id) : null;
  return {
    icon: category?.icon ?? 'category',
    color: category ? effectiveColor(category, parent) : null,
  };
}

function title(
  movement: Transaction,
  lookups: TransactionLookups,
  perspective: TransactionPerspective,
): string {
  if (movement.type === 'transfer') {
    const from = accountName(movement.account_id, movement, lookups);
    const to = accountName(movement.to_account_id, movement, lookups);
    if (perspective === 'space') {
      return `${from} → ${to}`;
    }
    return movement.account_id === perspective.accountId
      ? `Transferencia a ${to}`
      : `Transferencia desde ${from}`;
  }
  if (movement.type === 'adjustment') {
    return 'Ajuste de saldo';
  }
  const category = movement.category_id ? lookups.category(movement.category_id) : null;
  const parent = category?.parent_id ? lookups.category(category.parent_id) : null;
  if (!category) {
    return TRANSACTION_TYPE_LABELS[movement.type];
  }
  return parent ? `${parent.name} (${category.name})` : category.name;
}

const TYPE_TONES: Readonly<Record<Transaction['type'], TransactionListItem['tone']>> = {
  expense: 'expense',
  income: 'income',
  transfer: 'neutral',
  adjustment: 'neutral',
};

/**
 * A movement as `cc-transaction-list` shows it (spec §7): "Categoría (Subcategoría)", then a line
 * with its tags and installments and the note on its own. Seen from the space, that line starts
 * with its account and its icon, the amount takes the tone of its type, transfers read "Efectivo →
 * Nequi" without a sign, and private accounts get a lock.
 */
export function toTransactionListItem(
  movement: Transaction,
  lookups: TransactionLookups,
  perspective: TransactionPerspective,
): TransactionListItem {
  const fromSpace = perspective === 'space';
  const withAccount = fromSpace && movement.type !== 'transfer';
  const details = [
    ...(withAccount ? [accountName(movement.account_id, movement, lookups)] : []),
    ...lookups.tagNames(movement.tag_ids),
    ...(movement.installments > 1 ? [`${movement.installments} cuotas`] : []),
  ];
  const source = lookups.account(movement.account_id);
  return {
    id: movement.id,
    title: title(movement, lookups, perspective),
    ...look(movement, lookups),
    subtitle: details.join(SEPARATOR) || undefined,
    subtitleIcon: withAccount ? (source?.icon ?? 'lock') : undefined,
    note: movement.note || undefined,
    amount: fromSpace ? spaceAmount(movement) : balanceDelta(movement, perspective.accountId),
    currency: fromSpace ? movement.currency : perspective.currency,
    signed: !fromSpace || movement.type !== 'transfer',
    tone: fromSpace ? TYPE_TONES[movement.type] : 'neutral',
    private: fromSpace && isPrivateMovement(movement, lookups.account),
    // Editing needs write access to the source account (spec §8).
    editable:
      lookups.canEdit &&
      !!source &&
      (source.visibility === 'shared' || source.owner_id === lookups.userId),
  };
}

/** What each day adds up to, in one currency, e.g. the net of Transacciones (spec §7). */
export interface DayTotals {
  readonly byDate: ReadonlyMap<IsoDate, number>;
  readonly currency: string;
}

/**
 * Movements grouped by day for `cc-transaction-list`, titled "Hoy", "Ayer" or the date, with the
 * total of each day when `totals` has it.
 */
export function toTransactionGroups(
  movements: readonly Transaction[],
  lookups: TransactionLookups,
  perspective: TransactionPerspective,
  today: IsoDate,
  totals: DayTotals | null = null,
): TransactionListGroup[] {
  return groupByDay(movements, (movement) => movement.date).map((day) => {
    const total = totals?.byDate.get(day.date);
    return {
      title: dayTitle(day.date, today),
      ...(total !== undefined && totals
        ? { total: { amount: total, currency: totals.currency } }
        : {}),
      items: day.items.map((movement) => toTransactionListItem(movement, lookups, perspective)),
    };
  });
}
