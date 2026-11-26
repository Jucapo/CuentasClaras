import { Component, inject } from '@angular/core';
import { Button } from '../../atoms/button/button';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
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

/** Content of the confirmation overlay. Open it with ConfirmService. */
@Component({
  selector: 'cc-confirm-dialog',
  imports: [OverlayPanel, Button],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  protected readonly options = inject<ConfirmOptions>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<boolean>>(OverlayHandle);

  protected readonly cancelLabel = UI_TEXT.cancel;

  protected answer(confirmed: boolean): void {
    this.handle.close(confirmed);
  }
}
