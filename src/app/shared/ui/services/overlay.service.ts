import { BreakpointObserver } from '@angular/cdk/layout';
import { inject, Injectable, InjectionToken, Injector, Type } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OVERLAY_DESKTOP_QUERY } from '../ui.constants';

/** Data handed to the component shown in an overlay. */
export const OVERLAY_DATA = new InjectionToken<unknown>('OVERLAY_DATA');

/** Lets the component inside an overlay close it with a result. */
export class OverlayHandle<R> {
  private closeOverlay: ((result?: R) => void) | null = null;

  /** Closes the overlay; no result means it was dismissed. */
  close(result?: R): void {
    this.closeOverlay?.(result);
  }

  /** Connects the handle to the opened overlay. */
  attach(close: (result?: R) => void): void {
    this.closeOverlay = close;
  }
}

/** Options of `OverlayService.open`. */
export interface OverlayOptions<D> {
  readonly data: D;
  /** Accessible name of the dialog or sheet. */
  readonly label: string;
  /** `picker` is wide enough for grids; `confirm` is a short question. */
  readonly size?: 'picker' | 'confirm';
}

const PANEL_CLASS = { dialog: 'cc-overlay-dialog', sheet: 'cc-overlay-sheet' } as const;

/**
 * Shows a component as a bottom sheet on mobile and as a dialog on wider screens (spec §13.3).
 * Pages and molecules use this instead of Material directly.
 */
@Injectable({ providedIn: 'root' })
export class OverlayService {
  private readonly injector = inject(Injector);
  private readonly breakpoints = inject(BreakpointObserver);

  /** Opens `component`; resolves with what it passes to `OverlayHandle.close`, or undefined. */
  async open<R, D = unknown>(
    component: Type<unknown>,
    options: OverlayOptions<D>,
  ): Promise<R | undefined> {
    const handle = new OverlayHandle<R>();
    const injector = Injector.create({
      parent: this.injector,
      providers: [
        { provide: OVERLAY_DATA, useValue: options.data },
        { provide: OverlayHandle, useValue: handle },
      ],
    });
    const sizeClass = `cc-overlay-${options.size ?? 'picker'}`;

    // Loaded on demand to keep dialogs and sheets out of the initial bundle.
    if (this.breakpoints.isMatched(OVERLAY_DESKTOP_QUERY)) {
      const { MatDialog } = await import('@angular/material/dialog');
      const ref = this.injector.get(MatDialog).open<unknown, D, R>(component, {
        injector,
        data: options.data,
        ariaLabel: options.label,
        panelClass: [PANEL_CLASS.dialog, sizeClass],
        autoFocus: 'first-heading',
      });
      handle.attach((result) => ref.close(result));
      return firstValueFrom(ref.afterClosed());
    }

    const { MatBottomSheet } = await import('@angular/material/bottom-sheet');
    const ref = this.injector.get(MatBottomSheet).open<unknown, D, R>(component, {
      injector,
      data: options.data,
      ariaLabel: options.label,
      panelClass: [PANEL_CLASS.sheet, sizeClass],
      autoFocus: 'first-heading',
    });
    handle.attach((result) => ref.dismiss(result));
    return firstValueFrom(ref.afterDismissed());
  }
}
