import { Location } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

/** Router's id in the history state: 1 for the page the app opened on. */
interface RouterHistoryState {
  readonly navigationId?: number;
}

/**
 * The ← of a screen that opens from anywhere, e.g. Configuración from the menu (spec §13.5): back to
 * where it was opened from, like the system back button; to `fallback` when the app opened on it.
 */
@Injectable({ providedIn: 'root' })
export class BackNavigation {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  back(fallback: readonly unknown[]): void {
    const state = this.location.getState() as RouterHistoryState | null;
    if ((state?.navigationId ?? 1) > 1) {
      this.location.back();
    } else {
      void this.router.navigate(fallback);
    }
  }
}
