import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output } from '@angular/core';

let nextDisplayId = 0;

/**
 * The amount being typed on the keypad (spec §7): what was typed above, e.g. `12.000 + 3.500`, and
 * the formatted result below. With `interactive`, tapping it makes it the amount the keypad writes,
 * as the two amounts of a transfer between currencies do.
 */
@Component({
  selector: 'cc-amount-display',
  imports: [NgTemplateOutlet],
  templateUrl: './amount-display.html',
  styleUrl: './amount-display.scss',
  host: { '[class.active]': 'active()', '[class.invalid]': 'error() !== null' },
})
export class AmountDisplay {
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
