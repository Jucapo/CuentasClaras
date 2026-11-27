import { Component, computed, input, output } from '@angular/core';
import { KeypadKey } from '../../../../domain/money/amount-expression';
import { Icon } from '../../atoms/icon/icon';
import { IconName } from '../../icons/icon-glyphs';
import { KEYPAD_TEXT } from '../../ui.constants';

interface KeypadButton {
  readonly key: KeypadKey;
  readonly text?: string;
  readonly icon?: IconName;
  readonly label?: string;
  readonly kind: 'digit' | 'operator';
  /** Columns it takes: the zero is wider when there is no decimal key. */
  readonly span?: 2 | 3;
}

const digit = (key: KeypadKey): KeypadButton => ({ key, text: key, kind: 'digit' });

/** The rows above the last one: an operator, three digits and a side key. */
const UPPER_ROWS: readonly KeypadButton[] = [
  { key: 'divide', text: '÷', label: KEYPAD_TEXT.divide, kind: 'operator' },
  digit('7'),
  digit('8'),
  digit('9'),
  { key: 'backspace', icon: 'backspace', label: KEYPAD_TEXT.backspace, kind: 'operator' },
  { key: 'times', text: '×', label: KEYPAD_TEXT.times, kind: 'operator' },
  digit('4'),
  digit('5'),
  digit('6'),
  { key: '000', text: '000', label: KEYPAD_TEXT.thousands, kind: 'digit' },
  { key: 'minus', icon: 'remove', label: KEYPAD_TEXT.minus, kind: 'operator' },
  digit('1'),
  digit('2'),
  digit('3'),
];

/**
 * The keypad of the quick entry and the budget calculator (spec §7, §4.7), in five columns like
 * 1Money: divide, multiply, subtract and add on the left, the digits, erase and thousands on the
 * right, and the main action tall in the corner. Physical keys are handled by whoever holds the
 * amount; the buttons stay out of the tab order except the main action.
 */
@Component({
  selector: 'cc-keypad',
  imports: [Icon],
  templateUrl: './keypad.html',
  styleUrl: './keypad.scss',
})
export class Keypad {
  /** Decimal separator of the user, shown on its key. */
  readonly decimalSeparator = input('.');
  /** Hidden when the currency has no decimals or the user hides them. */
  readonly showDecimal = input(true);
  /** Accessible name of the main action, e.g. "Guardar". */
  readonly submitLabel = input.required<string>();
  readonly submitDisabled = input(false);
  readonly pressed = output<KeypadKey>();
  readonly submitted = output<void>();

  protected readonly label = KEYPAD_TEXT.label;

  /** In grid order; the main action is placed apart, in the last column of the last two rows. */
  protected readonly keys = computed<readonly KeypadButton[]>(() => [
    ...UPPER_ROWS,
    { key: 'plus', icon: 'add', label: KEYPAD_TEXT.plus, kind: 'operator' },
    ...(this.showDecimal()
      ? [
          { ...digit('0'), span: 2 as const },
          {
            key: 'decimal' as const,
            text: this.decimalSeparator(),
            label: KEYPAD_TEXT.decimal,
            kind: 'digit' as const,
          },
        ]
      : [{ ...digit('0'), span: 3 as const }]),
  ]);
}
