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
  readonly wide?: boolean;
}

const DIGIT_ROWS: readonly (readonly KeypadKey[])[] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
];

const SIDE_KEYS: readonly KeypadButton[] = [
  { key: 'backspace', icon: 'backspace', label: KEYPAD_TEXT.backspace, kind: 'operator' },
  { key: 'minus', icon: 'remove', label: KEYPAD_TEXT.minus, kind: 'operator' },
  { key: 'plus', icon: 'add', label: KEYPAD_TEXT.plus, kind: 'operator' },
];

/**
 * The keypad of the quick entry (spec §7): digits, thousands, the decimal separator of the user,
 * add, subtract, erase and the main action. Physical keys are handled by whoever holds the amount;
 * the buttons stay out of the tab order except the main action.
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

  protected readonly rows = computed<readonly (readonly KeypadButton[])[]>(() => [
    ...DIGIT_ROWS.map((digits, index) => [
      ...digits.map((key) => ({ key, text: key, kind: 'digit' as const })),
      SIDE_KEYS[index],
    ]),
    [
      ...(this.showDecimal()
        ? [
            {
              key: 'decimal' as const,
              text: this.decimalSeparator(),
              label: KEYPAD_TEXT.decimal,
              kind: 'digit' as const,
            },
            { key: '0' as const, text: '0', kind: 'digit' as const },
          ]
        : [{ key: '0' as const, text: '0', kind: 'digit' as const, wide: true }]),
      { key: '000' as const, text: '000', label: KEYPAD_TEXT.thousands, kind: 'digit' as const },
    ],
  ]);
}
