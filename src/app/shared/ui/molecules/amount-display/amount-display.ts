import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { colorOrFallback, paletteTextColor } from '../../colors/color-palette';

let nextDisplayId = 0;

/**
 * The amount being typed on the keypad (spec §7): what was typed above, e.g. `12.000 + 3.500`, and
 * the formatted result below. With `interactive`, tapping it makes it the amount the keypad writes,
 * as the two amounts of a transfer between currencies do, or brings the keypad up. `lg` centers a
 * large amount on the surface, in the color of `color` (a palette key) with AA contrast.
 */
@Component({
  selector: 'cc-amount-display',
  imports: [NgTemplateOutlet],
  templateUrl: './amount-display.html',
  styleUrl: './amount-display.scss',
  host: {
    '[class.active]': 'active()',
    '[class.invalid]': 'error() !== null',
    '[class.lg]': "size() === 'lg'",
    '[style.--cc-amount-color]': 'textColor()',
  },
})
export class AmountDisplay {
  readonly size = input<'md' | 'lg'>('md');
  /** Palette key of the amount, e.g. the category's; the text keeps AA. */
  readonly color = input<string | null>(null);
  protected readonly textColor = computed(() => {
    const color = this.color();
    return color === null ? null : paletteTextColor(colorOrFallback(color));
  });
  readonly label = input.required<string>();
  /** What was typed, formatted; shown above the result while it has operators. */
  readonly expression = input('');
  /** The formatted result, e.g. `$ 15.500`. */
  readonly result = input.required<string>();
  readonly active = input(true);
  readonly interactive = input(false);
  readonly error = input<string | null>(null);
  readonly activate = output<void>();

  protected readonly labelId = `cc-amount-display-${nextDisplayId++}`;
}
