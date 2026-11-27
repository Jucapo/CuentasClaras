import { Component, input, output } from '@angular/core';
import { Amount } from '../../atoms/amount/amount';
import { Button } from '../../atoms/button/button';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { ListItem } from '../../molecules/list-item/list-item';
import { UI_TEXT } from '../../ui.constants';

/** A movement as the list shows it, already worded by the page. */
export interface TransactionListItem {
  readonly id: string;
  /** e.g. "Mercado › Supermercado" or "Transferencia a Dólares". */
  readonly title: string;
  /** e.g. tags and note. */
  readonly subtitle?: string;
  readonly icon: string;
  readonly color: string | null;
  /** Signed effect on the account, in minor units of `currency`. */
  readonly amount: number;
  readonly currency: string;
  /** Can be opened to edit it. */
  readonly editable: boolean;
}

/** Movements of one day. */
export interface TransactionListGroup {
  /** e.g. "Hoy" or "Martes 24 nov". */
  readonly title: string;
  readonly items: readonly TransactionListItem[];
}

/**
 * Movements grouped by day, newest first (spec §7), with "Ver más" when there are more. Tapping an
 * editable one emits `opened`.
 */
@Component({
  selector: 'cc-transaction-list',
  imports: [ListItem, IconBadge, Amount, Button],
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
  readonly opened = output<string>();
  readonly more = output<void>();

  protected readonly loadMoreLabel = UI_TEXT.loadMore;
}
