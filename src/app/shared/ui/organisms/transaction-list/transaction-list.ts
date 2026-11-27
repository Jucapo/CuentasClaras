import { Component, input, output } from '@angular/core';
import { Amount } from '../../atoms/amount/amount';
import { Button } from '../../atoms/button/button';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { Icon } from '../../atoms/icon/icon';
import { ListItem } from '../../molecules/list-item/list-item';
import { SkeletonList } from '../../molecules/skeleton-list/skeleton-list';
import { UI_TEXT } from '../../ui.constants';

/** A movement as the list shows it, already worded by the page. */
export interface TransactionListItem {
  readonly id: string;
  /** e.g. "Mercado (Supermercado)" or "Transferencia a Dólares". */
  readonly title: string;
  /** e.g. the account, tags and installments. */
  readonly subtitle?: string;
  /** Icon key before the subtitle, e.g. the account's. */
  readonly subtitleIcon?: string;
  /** The note, on its own line. */
  readonly note?: string;
  readonly icon: string;
  readonly color: string | null;
  /** Signed effect on the account (or the space), in minor units of `currency`. */
  readonly amount: number;
  readonly currency: string;
  /** Shows the sign of `amount`; false for transfers seen from the space. */
  readonly signed?: boolean;
  /** Paints the amount in the tone of its type (Transacciones, spec §7); neutral by default. */
  readonly tone?: 'expense' | 'income' | 'neutral';
  /** Touches a private account: a small lock explains why space totals may differ (spec §7). */
  readonly private?: boolean;
  /** Can be opened to edit it. */
  readonly editable: boolean;
}

/** Movements of one day. */
export interface TransactionListGroup {
  /** e.g. "Hoy" or "Martes 24 nov". */
  readonly title: string;
  /** What the day adds up to, e.g. its incomes minus its expenses (spec §7); none when absent. */
  readonly total?: { readonly amount: number; readonly currency: string };
  readonly items: readonly TransactionListItem[];
}

/**
 * Movements grouped by day, newest first (spec §7), each day with its total when it has one, and
 * "Ver más" when there are more. Tapping an editable one emits `opened`; `selectedId` marks the one
 * open beside the list.
 */
@Component({
  selector: 'cc-transaction-list',
  imports: [ListItem, IconBadge, Icon, Amount, Button, SkeletonList],
  templateUrl: './transaction-list.html',
  styleUrl: './transaction-list.scss',
})
export class TransactionList {
  readonly groups = input.required<readonly TransactionListGroup[]>();
  /** Accessible name of the list, e.g. "Movimientos de Efectivo". */
  readonly label = input.required<string>();
  readonly emptyText = input('');
  readonly hasMore = input(false);
  readonly loading = input(false);
  readonly selectedId = input<string | null>(null);
  readonly opened = output<string>();
  readonly more = output<void>();

  protected readonly text = UI_TEXT;
}
