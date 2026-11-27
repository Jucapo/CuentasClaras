import { Component, input, output } from '@angular/core';
import { DragDismiss } from '../../services/drag-dismiss';

/**
 * The drag handle of a bottom sheet (spec §13.5): a pill floating above the sheet's top edge, over
 * the dimmed backdrop. Dragging it down closes the sheet (asking first when something changed).
 * With a `label` it is also a button that closes the sheet, as in the quick entry, which has no ✕;
 * without one it is only for dragging, and assistive technology skips it.
 */
@Component({
  selector: 'cc-sheet-handle',
  imports: [DragDismiss],
  templateUrl: './sheet-handle.html',
  styleUrl: './sheet-handle.scss',
})
export class SheetHandle {
  /** Accessible name when it is a button, e.g. "Cerrar". */
  readonly label = input<string | null>(null);
  readonly activate = output<void>();
}
