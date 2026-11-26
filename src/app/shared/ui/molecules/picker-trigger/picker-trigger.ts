import { Component, input, output } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';

let nextTriggerId = 0;

/** Form row that opens a picker: preview (projected), label, current value, hint or error. */
@Component({
  selector: 'cc-picker-trigger',
  imports: [Icon],
  templateUrl: './picker-trigger.html',
  styleUrl: './picker-trigger.scss',
})
export class PickerTrigger {
  readonly label = input.required<string>();
  /** Name of the current value, e.g. "Carrito". */
  readonly valueText = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly disabled = input(false);
  readonly activate = output<void>();
  readonly blurred = output<void>();

  protected readonly supportId = `cc-picker-trigger-${nextTriggerId++}`;
}
