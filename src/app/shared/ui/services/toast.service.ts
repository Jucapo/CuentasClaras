import { inject, Injectable, Injector } from '@angular/core';
import { SNACK_BAR_DURATION_MS } from '../../../core/config/app.constants';

/** Class of the toast container; styled in _theme.scss so it clears the bottom navigation. */
export const TOAST_PANEL_CLASS = 'cc-toast';

/** Brief notifications at the bottom of the screen. Pages use this instead of Material directly. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly injector = inject(Injector);

  /** Shows a message for a few seconds. */
  async show(message: string): Promise<void> {
    // Loaded on demand to keep the snack bar out of the initial bundle.
    const { MatSnackBar } = await import('@angular/material/snack-bar');
    this.injector.get(MatSnackBar).open(message, undefined, {
      duration: SNACK_BAR_DURATION_MS,
      panelClass: TOAST_PANEL_CLASS,
    });
  }
}
