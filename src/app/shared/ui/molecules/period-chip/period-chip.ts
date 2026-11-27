import { Component, input, output } from '@angular/core';
import { IconButton } from '../../atoms/icon-button/icon-button';
import { UI_TEXT } from '../../ui.constants';

/**
 * The global period selector (spec §4.5, §7): arrows to the previous and next period and a chip
 * with its name and range that opens the options.
 */
@Component({
  selector: 'cc-period-chip',
  imports: [IconButton],
  templateUrl: './period-chip.html',
  styleUrl: './period-chip.scss',
})
export class PeriodChip {
  /** Name of the period, e.g. "Diciembre". */
  readonly title = input.required<string>();
  /** Its range, e.g. "28 nov – 27 dic"; empty for "Siempre". */
  readonly range = input('');
  /** Whether the arrows work; "Siempre" has none. */
  readonly canShift = input(true);
  readonly previous = output<void>();
  readonly next = output<void>();
  readonly opened = output<void>();

  protected readonly text = UI_TEXT;
}
