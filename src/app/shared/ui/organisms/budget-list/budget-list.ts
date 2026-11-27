import { Component, input, output, signal, viewChildren } from '@angular/core';
import { currencyLabel, SUPPORTED_CURRENCIES } from '../../../../core/config/space.constants';
import { CurrencyAmount } from '../../../../domain/money/money';
import { Amount } from '../../atoms/amount/amount';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import {
  BudgetProgress,
  BudgetProgressKind,
} from '../../molecules/budget-progress/budget-progress';
import { MoneyRow, MoneyRowCommit } from '../../molecules/money-row/money-row';
import { PanelOption } from '../../molecules/option-panel/option-panel';

/** What was spent (or received) against the amount of a row, in one currency. */
export interface BudgetListProgress {
  readonly spent: number;
  /** Null without a budget. */
  readonly budget: number | null;
  readonly currency: string;
  readonly kind: BudgetProgressKind;
}

/** A category with its monthly amount, as the list shows it. */
export interface BudgetListEntry {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string | null;
  /** Null while it has no amount. */
  readonly amount: CurrencyAmount | null;
  /** The bar and what remains under the row (the Presupuesto screen); the wizard has none. */
  readonly progress?: BudgetListProgress;
  /** A note under the amount, e.g. which later months keep their own. */
  readonly hint?: string;
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
 * currency symbol of a row picks its currency. With `progress`, each row shows its bar and what
 * remains; `readonly` shows the amounts without editing them.
 */
@Component({
  selector: 'cc-budget-list',
  imports: [MoneyRow, IconBadge, Amount, BudgetProgress],
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
  /** Amounts that cannot change here, e.g. a year or a reader. */
  readonly readonly = input(false);
  /** An amount was confirmed in a row (Enter, leaving it or a new currency). */
  readonly changed = output<BudgetAmountChange>();
  /**
   * Whether some row holds an amount other than 0, saved or still being typed; emitted as the
   * user types, e.g. so "Saltar" becomes "Continuar" right away.
   */
  readonly hasAmountsChange = output<boolean>();

  private readonly rows = viewChildren(MoneyRow);
  /** What each row holds while the user types, before it is saved. */
  private readonly typed = signal<ReadonlyMap<string, number | null>>(new Map());

  protected readonly currencyOptions = CURRENCY_OPTIONS;

  protected onValueChange(categoryId: string, amount: number | null): void {
    const typed = new Map(this.typed()).set(categoryId, amount);
    this.typed.set(typed);
    this.hasAmountsChange.emit(
      this.entries().some((entry) => {
        const value = typed.has(entry.id) ? typed.get(entry.id) : entry.amount?.amount;
        return value !== null && value !== undefined && value !== 0;
      }),
    );
  }

  protected emitChange(categoryId: string, commit: MoneyRowCommit): void {
    this.changed.emit({ ...commit, categoryId });
  }

  protected focusAfter(index: number): void {
    this.rows()[index + 1]?.focus();
  }
}
