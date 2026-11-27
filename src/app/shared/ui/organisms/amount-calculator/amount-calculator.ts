import { Component, computed, inject, signal } from '@angular/core';
import { BudgetFigures } from '../../../../domain/budgets/budget-lines';
import {
  evaluateAmount,
  evaluateExpression,
  expressionFromMinor,
  formatExpression,
  hasOperator,
  KeypadKey,
  pressKey,
} from '../../../../domain/money/amount-expression';
import { currencyMinorUnits } from '../../../../domain/money/currencies';
import { formatMoney } from '../../../../domain/money/money';
import { NUMBER_FORMAT_SEPARATORS } from '../../../../domain/money/number-format';
import { AmountDisplay } from '../../molecules/amount-display/amount-display';
import { BudgetKind } from '../../molecules/budget-pill/budget-pill';
import { BudgetRow } from '../../molecules/budget-row/budget-row';
import { Keypad, keypadKeyOf } from '../../molecules/keypad/keypad';
import { OverlayPanel } from '../../molecules/overlay-panel/overlay-panel';
import { MONEY_FORMAT } from '../../money/money-format';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { AMOUNT_EXPRESSION_MESSAGES } from '../quick-entry/quick-entry.model';

/** Data of `cc-amount-calculator`: the amount and what it is for (spec §4.7). */
export interface AmountCalculatorData {
  /** E.g. "Mercado › Supermercado". */
  readonly title: string;
  /** The context row: the period, what was spent and the budget, in `figuresCurrency`. */
  readonly period: string;
  readonly figures: BudgetFigures;
  readonly figuresCurrency: string;
  readonly kind: BudgetKind;
  readonly counted: boolean;
  readonly color: string | null;
  /** Over the amount, e.g. "Presupuesto para el mes". */
  readonly label: string;
  /** Minor units of `currency` it opens with; null without one. */
  readonly value: number | null;
  readonly currency: string;
}

const NEGATIVE_MESSAGE = 'El monto no puede ser negativo.';

const OPERATOR_KEYS: readonly KeypadKey[] = ['plus', 'minus', 'times', 'divide'];

/**
 * The calculator of a budget row (spec §4.7): the keypad of the quick entry over the amount, with
 * the context of the row on top. The first digit replaces the amount it opened with, while an
 * operator works on it; ✓ (or Enter) returns the result in minor units. A sheet in the compact
 * window class, a dialog elsewhere, where the physical keyboard types too.
 */
@Component({
  selector: 'cc-amount-calculator',
  imports: [OverlayPanel, BudgetRow, AmountDisplay, Keypad],
  templateUrl: './amount-calculator.html',
  styleUrl: './amount-calculator.scss',
  host: { '(keydown)': 'onKeydown($event)' },
})
export class AmountCalculator {
  protected readonly data = inject<AmountCalculatorData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<number>>(OverlayHandle);
  private readonly format = inject(MONEY_FORMAT);

  protected readonly ui = UI_TEXT;
  private readonly exponent = currencyMinorUnits(this.data.currency);
  private readonly expression = signal(
    this.data.value === null ? '' : expressionFromMinor(this.data.value, this.exponent),
  );
  /** Until a key is pressed, the amount it opened with. */
  private fresh = true;
  protected readonly error = signal<string | null>(null);

  protected readonly decimalSeparator = computed(
    () => NUMBER_FORMAT_SEPARATORS[this.format().numberFormat].decimal,
  );
  protected readonly showDecimal = computed(() => this.format().showDecimals && this.exponent > 0);
  protected readonly display = computed(() => {
    const expression = this.expression();
    const format = this.format();
    return {
      expression: hasOperator(expression) ? formatExpression(expression, format.numberFormat) : '',
      result: formatMoney(
        evaluateExpression(expression, this.exponent),
        this.data.currency,
        format,
      ),
    };
  });

  protected press(key: KeypadKey): void {
    this.error.set(null);
    const replaces = this.fresh && !OPERATOR_KEYS.includes(key) && key !== 'backspace';
    this.fresh = false;
    this.expression.set(pressKey(replaces ? '' : this.expression(), key, this.exponent));
  }

  protected submit(): void {
    const evaluation = evaluateAmount(this.expression(), this.exponent);
    if (!evaluation.ok) {
      this.error.set(AMOUNT_EXPRESSION_MESSAGES[evaluation.error]);
      return;
    }
    if (evaluation.value < 0) {
      this.error.set(NEGATIVE_MESSAGE);
      return;
    }
    this.handle.close(evaluation.value);
  }

  protected close(): void {
    this.handle.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        this.submit();
      }
      return;
    }
    const key = keypadKeyOf(event, this.decimalSeparator());
    if (key) {
      event.preventDefault();
      this.press(key);
      return;
    }
    // Enter on a button presses that button.
    if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      this.submit();
    }
  }
}
