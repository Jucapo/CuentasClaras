import { Component, input, output } from '@angular/core';
import { Button } from '../../atoms/button/button';
import { UI_TEXT } from '../../ui.constants';
import { OverlayPanel } from '../overlay-panel/overlay-panel';

/** A question that needs an explicit answer, e.g. before deleting. */
export interface ConfirmOptions {
  readonly title: string;
  readonly message: string;
  /** Items affected besides the main one, listed under the message. */
  readonly details?: readonly string[];
  readonly confirmLabel: string;
  /** Paints the confirm button in the error color (irreversible actions). */
  readonly destructive?: boolean;
}

/**
 * A confirmation: the question, what it affects, Cancelar and the confirm button. Its own overlay
 * through ConfirmService, or a view inside another one with `backButton` (spec §13.5).
 */
@Component({
  selector: 'cc-confirm-panel',
  imports: [OverlayPanel, Button],
  templateUrl: './confirm-panel.html',
  styleUrl: './confirm-panel.scss',
})
export class ConfirmPanel {
  readonly options = input.required<ConfirmOptions>();
  /** ← instead of no close button, for a view inside another overlay. */
  readonly backButton = input(false);
  /** Saving what was confirmed: the confirm button shows its progress. */
  readonly busy = input(false);
  /** True when confirmed; false when cancelled or left with ←. */
  readonly answered = output<boolean>();

  protected readonly cancelLabel = UI_TEXT.cancel;
  protected readonly savingLabel = UI_TEXT.saving;

  protected answer(confirmed: boolean): void {
    if (!this.busy()) {
      this.answered.emit(confirmed);
    }
  }
}
