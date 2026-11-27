import { Component, input, output, signal, viewChildren } from '@angular/core';
import { currencyLabel, SUPPORTED_CURRENCIES } from '../../../../core/config/space.constants';
import {
  budgetFill,
  BudgetFigures,
  budgetStanding,
} from '../../../../domain/budgets/budget-lines';
import { CurrencyAmount } from '../../../../domain/money/money';
import { Amount } from '../../atoms/amount/amount';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { IconButton } from '../../atoms/icon-button/icon-button';
import { ProgressBar } from '../../atoms/progress-bar/progress-bar';
import { BudgetKind, BudgetPill } from '../../molecules/budget-pill/budget-pill';
import { MoneyRow, MoneyRowCommit } from '../../molecules/money-row/money-row';
import { PanelOption } from '../../molecules/option-panel/option-panel';

/** What was spent (or received) against the amount of a row, in the main currency. */
export interface BudgetListProgress extends BudgetFigures {
  readonly currency: string;
  readonly kind: BudgetKind;
  /** Spending without a budget counts as over it (a line of a category that has one). */
  readonly counted?: boolean;
}

/** A category with its monthly amount, as the list shows it. */
export interface BudgetListEntry {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string | null;
  /** Null while it has no amount. */
  readonly amount: CurrencyAmount | null;
  /**
   * The Presupuesto screen: the bar behind the row, what was spent, what is left in a pill and the
   * calculator. The wizard has none.
   */
  readonly progress?: BudgetListProgress;
  /** A discreet mark, e.g. "Solo diciembre". */
  readonly mark?: string;
  /** A note under the amount, e.g. from when a later month keeps its own. */
  readonly hint?: string;
}

const BUDGET_LIST_TEXT = {
  spent: { expense: 'gastado', income: 'recibido' },
  calculator: (name: string) => `Calculadora de ${name}`,
  bar: (name: string) => `Avance de ${name}`,
} as const;

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
 * currency symbol of a row picks its currency. With `progress` (the Presupuesto screen, spec §4.7),
 * a row has the bar behind it, what was spent, what is left in a pill and a calculator button.
 */
@Component({
  selector: 'cc-budget-list',
  imports: [MoneyRow, IconBadge, IconButton, Amount, ProgressBar, BudgetPill],
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
  /** The calculator of a row with `progress` was asked for, with the id of its entry. */
  readonly calculate = output<string>();
  /**
   * Whether some row holds an amount other than 0, saved or still being typed; emitted as the
   * user types, e.g. so "Saltar" becomes "Continuar" right away.
   */
  readonly hasAmountsChange = output<boolean>();

  private readonly rows = viewChildren(MoneyRow);
  /** What each row holds while the user types, before it is saved. */
  private readonly typed = signal<ReadonlyMap<string, number | null>>(new Map());

  protected readonly currencyOptions = CURRENCY_OPTIONS;
  protected readonly text = BUDGET_LIST_TEXT;

  protected standing(progress: BudgetListProgress) {
    return budgetStanding(progress, progress.counted);
  }

  protected fill(progress: BudgetListProgress): number {
    return budgetFill(progress, progress.counted);
  }

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
