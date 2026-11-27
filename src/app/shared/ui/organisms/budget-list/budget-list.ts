import { Component, input, output } from '@angular/core';
import { CurrencyAmount } from '../../../../domain/money/money';
import { Amount } from '../../atoms/amount/amount';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { ListItem } from '../../molecules/list-item/list-item';

/** A category with its monthly amount, as the list shows it. */
export interface BudgetListEntry {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string | null;
  /** Null while it has no amount. */
  readonly amount: CurrencyAmount | null;
}

/**
 * Categories with their monthly amount (budget or expected income) and the totals per currency;
 * choosing one emits `opened`, e.g. to type its amount in a sheet.
 */
@Component({
  selector: 'cc-budget-list',
  imports: [ListItem, IconBadge, Amount],
  templateUrl: './budget-list.html',
  styleUrl: './budget-list.scss',
})
export class BudgetList {
  readonly entries = input.required<readonly BudgetListEntry[]>();
  /** Accessible name of the list. */
  readonly label = input.required<string>();
  /** Shown instead of an amount. */
  readonly emptyText = input('Sin monto');
  /** Totals per currency; hidden when empty. */
  readonly totals = input<readonly CurrencyAmount[]>([]);
  readonly totalLabel = input('Total');
  /** Under the total, e.g. what it compares with. */
  readonly totalNote = input<string>();
  readonly opened = output<string>();
}
