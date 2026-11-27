import { Component, input, output } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import { IconName } from '../../icons/icon-glyphs';

let nextRowId = 0;

/**
 * List row of a flow that opens a focused sheet or dialog to change one value (spec §13.5):
 * icon (or projected preview), label, current value, hint or error.
 */
@Component({
  selector: 'cc-field-row',
  imports: [Icon],
  templateUrl: './field-row.html',
  styleUrl: './field-row.scss',
})
export class FieldRow {
  readonly label = input.required<string>();
  /** Current value as the user reads it, e.g. "Tarjeta de crédito". */
  readonly valueText = input.required<string>();
  /** Leading icon; without it the projected content is the leading visual. */
  readonly icon = input<IconName>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly disabled = input(false);
  readonly activate = output<void>();

  protected readonly supportId = `cc-field-row-${nextRowId++}`;
}
