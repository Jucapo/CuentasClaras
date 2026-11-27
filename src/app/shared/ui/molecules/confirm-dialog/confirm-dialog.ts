import { Component, inject } from '@angular/core';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { ConfirmOptions, ConfirmPanel } from '../confirm-panel/confirm-panel';

export type { ConfirmOptions } from '../confirm-panel/confirm-panel';

/** `cc-confirm-panel` as its own overlay. Open it with ConfirmService. */
@Component({
  selector: 'cc-confirm-dialog',
  imports: [ConfirmPanel],
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  protected readonly options = inject<ConfirmOptions>(OVERLAY_DATA);
  protected readonly handle = inject<OverlayHandle<boolean>>(OverlayHandle);
}
