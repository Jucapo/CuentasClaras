import { Component, input, output, viewChildren } from '@angular/core';
import { currencyLabel, SUPPORTED_CURRENCIES } from '../../../../core/config/space.constants';
import { CurrencyAmount } from '../../../../domain/money/money';
import { Amount } from '../../atoms/amount/amount';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { MoneyRow, MoneyRowCommit } from '../../molecules/money-row/money-row';
import { PanelOption } from '../../molecules/option-panel/option-panel';

/** A category with its monthly amount, as the list shows it. */
export interface BudgetListEntry {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string | null;
  /** Null while it has no amount. */
  readonly amount: CurrencyAmount | null;
}

/** An amount typed in a row of `cc-budget-list`. */
export interface BudgetAmountChange extends MoneyRowCommit {
  readonly categoryId: string;
}

const CURRENCY_OPTIONS: readonly PanelOption<string>[] = SUPPORTED_CURRENCIES.map((code) => ({
  value: code,
  label: currencyLabel(code),
}));

/**
 * Categories with their monthly amount (budget or expected income) typed in each row (spec §13.5),
 * and the totals per currency. Enter moves to the next row, so the amounts fill in one go; the
 * currency symbol of a row picks its currency.
 */
@Component({
  selector: 'cc-budget-list',
  imports: [MoneyRow, IconBadge, Amount],
  templateUrl: './budget-list.html',
  styleUrl: './budget-list.scss',
})
export class BudgetList {
  readonly entries = input.required<readonly BudgetListEntry[]>();
  /** Accessible name of the list. */
  readonly label = input.required<string>();
  /** Currency of the rows without an amount, the space's main one. */
  readonly defaultCurrency = input.required<string>();
  /** Shown in an empty row. */
  readonly emptyText = input('Sin monto');
  /** Totals per currency; hidden when empty. */
  readonly totals = input<readonly CurrencyAmount[]>([]);
  readonly totalLabel = input('Total');
  /** Under the total, e.g. what it compares with. */
  readonly totalNote = input<string>();
  /** An amount was confirmed in a row (Enter, leaving it or a new currency). */
  readonly changed = output<BudgetAmountChange>();

  private readonly rows = viewChildren(MoneyRow);

  protected readonly currencyOptions = CURRENCY_OPTIONS;

  protected emitChange(categoryId: string, commit: MoneyRowCommit): void {
    this.changed.emit({ ...commit, categoryId });
  }

  protected focusAfter(index: number): void {
    this.rows()[index + 1]?.focus();
  }
}
