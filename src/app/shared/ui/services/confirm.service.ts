import { inject, Injectable } from '@angular/core';
import type { ConfirmOptions } from '../molecules/confirm-dialog/confirm-dialog';
import { OverlayService } from './overlay.service';

/** Asks the user to confirm an action, as a dialog or a bottom sheet. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly overlay = inject(OverlayService);

  /** Resolves true only when the user confirms; dismissing counts as no. */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    // Loaded on demand: the unsaved-changes guard is part of the initial bundle, the dialog is not.
    const { ConfirmDialog } = await import('../molecules/confirm-dialog/confirm-dialog');
    const answer = await this.overlay.open<boolean, ConfirmOptions>(ConfirmDialog, {
      data: options,
      label: options.title,
      size: 'confirm',
    });
    return answer === true;
  }
}
