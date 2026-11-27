import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { KeypadKey } from '../../../../domain/money/amount-expression';
import { Icon } from '../../atoms/icon/icon';
import {
  colorOrFallback,
  paletteColor,
  paletteForeground,
} from '../../colors/color-palette';
import { IconName } from '../../icons/icon-glyphs';
import { KEYPAD_TEXT } from '../../ui.constants';

interface KeypadButton {
  readonly key: KeypadKey;
  readonly text?: string;
  readonly icon?: IconName;
  readonly label?: string;
  /** Digits are light; operators and erase are neutral gray. */
  readonly kind: 'digit' | 'operator';
  /** Columns it takes: the zero takes two when there is no decimal key. */
  readonly span?: 2;
  /** Erase takes two rows when there is no date key. */
  readonly tall?: boolean;
}

const digit = (key: KeypadKey): KeypadButton => ({ key, text: key, kind: 'digit' });

const PHYSICAL_KEYS: Readonly<Record<string, KeypadKey>> = {
  '+': 'plus',
  '-': 'minus',
  '−': 'minus',
  '*': 'times',
  '×': 'times',
  '/': 'divide',
  '÷': 'divide',
  Backspace: 'backspace',
};

/** The keypad key a physical key types, with the decimal separator of the user; null for others. */
export function keypadKeyOf(event: KeyboardEvent, decimalSeparator: string): KeypadKey | null {
  if (/^\d$/.test(event.key)) {
    return event.key as KeypadKey;
  }
  if (event.key === decimalSeparator || event.code === 'NumpadDecimal') {
    return 'decimal';
  }
  return PHYSICAL_KEYS[event.key] ?? null;
}

/**
 * The keypad of the quick entry and the budget calculator (spec §7, §4.7), in five columns like
 * 1Money: divide, multiply, subtract and add on the left; the digits, with 000 and 0 in one cell
 * each; erase, the date (in the quick entry) and the main action, tall, on the right. Physical keys
 * are handled by whoever holds the amount; the buttons stay out of the tab order except the main
 * action. The main action takes the color of `accent`, a palette key.
 */
@Component({
  selector: 'cc-keypad',
  imports: [NgTemplateOutlet, Icon],
  templateUrl: './keypad.html',
  styleUrl: './keypad.scss',
  host: {
    '[style.--cc-keypad-accent]': 'accentColor()',
    '[style.--cc-keypad-on-accent]': 'accentForeground()',
  },
})
export class Keypad {
  /** Decimal separator of the user, shown on its key. */
  readonly decimalSeparator = input('.');
  /** Hidden when the currency has no decimals or the user hides them. */
  readonly showDecimal = input(true);
  /** Accessible name of the main action, e.g. "Guardar". */
  readonly submitLabel = input.required<string>();
  readonly submitDisabled = input(false);
  /** Shows the date key under erase, which emits `dateRequested` (the quick entry). */
  readonly dateKey = input(false);
  /** Palette key of the main action, e.g. the category's; the brand color without it. */
  readonly accent = input<string | null>(null);
  readonly pressed = output<KeypadKey>();
  readonly submitted = output<void>();
  readonly dateRequested = output<void>();

  protected readonly label = KEYPAD_TEXT.label;
  protected readonly dateLabel = KEYPAD_TEXT.date;

  private readonly accentKey = computed(() => {
    const accent = this.accent();
    return accent === null ? null : colorOrFallback(accent);
  });
  protected readonly accentColor = computed(() => {
    const key = this.accentKey();
    return key ? paletteColor(key) : null;
  });
  protected readonly accentForeground = computed(() => {
    const key = this.accentKey();
    return key ? paletteForeground(key) : null;
  });

  /** The keys of the first three rows; the date key and the main action are placed apart. */
  protected readonly upperKeys = computed<readonly KeypadButton[]>(() => [
    { key: 'divide', text: '÷', label: KEYPAD_TEXT.divide, kind: 'operator' },
    digit('7'),
    digit('8'),
    digit('9'),
    {
      key: 'backspace',
      icon: 'backspace',
      label: KEYPAD_TEXT.backspace,
      kind: 'operator',
      tall: !this.dateKey(),
    },
    { key: 'times', text: '×', label: KEYPAD_TEXT.times, kind: 'operator' },
    digit('4'),
    digit('5'),
    digit('6'),
  ]);

  protected readonly lowerKeys = computed<readonly KeypadButton[]>(() => [
    { key: 'minus', icon: 'remove', label: KEYPAD_TEXT.minus, kind: 'operator' },
    digit('1'),
    digit('2'),
    digit('3'),
    { key: 'plus', icon: 'add', label: KEYPAD_TEXT.plus, kind: 'operator' },
    { key: '000', text: '000', label: KEYPAD_TEXT.thousands, kind: 'digit' },
    ...(this.showDecimal()
      ? [
          digit('0'),
          {
            key: 'decimal' as const,
            text: this.decimalSeparator(),
            label: KEYPAD_TEXT.decimal,
            kind: 'digit' as const,
          },
        ]
      : [{ ...digit('0'), span: 2 as const }]),
  ]);
}
