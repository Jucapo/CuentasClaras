import { DOCUMENT } from '@angular/common';
import { inject, Injectable, InjectionToken, Injector, Type } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter, firstValueFrom, Observable, take } from 'rxjs';
import { OVERLAY_HISTORY_CLEANUP_TIMEOUT_MS } from '../ui.constants';
import { LayoutService } from './layout.service';

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
  /** What gets the focus: the title by default, or a CSS selector, e.g. `input` for a new item. */
  readonly autoFocus?: string;
}

const PANEL_CLASS = { dialog: 'cc-overlay-dialog', sheet: 'cc-overlay-sheet' } as const;

/** Key of the history entry an open overlay adds, so "back" closes it instead of navigating. */
const HISTORY_KEY = 'ccOverlay';

let nextOverlayId = 1;

/**
 * Shows a component as a bottom sheet in the compact window class and as a dialog in the others
 * (spec §13.3, §13.5). The system back button closes the overlay without leaving the page.
 * Pages and molecules use this instead of Material directly.
 */
@Injectable({ providedIn: 'root' })
export class OverlayService {
  private readonly injector = inject(Injector);
  private readonly layout = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly window = inject(DOCUMENT).defaultView;

  /**
   * Opens `component`; resolves with what it passes to `OverlayHandle.close`, or undefined.
   * Resolves once the overlay's history entry is gone, so callers may navigate right away.
   */
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
    const config = {
      injector,
      data: options.data,
      ariaLabel: options.label,
      autoFocus: options.autoFocus ?? 'first-heading',
      // Back and navigation are handled below: back closes only the top overlay.
      closeOnNavigation: false,
    };
    const sizeClass = `cc-overlay-${options.size ?? 'picker'}`;

    // Loaded on demand to keep dialogs and sheets out of the initial bundle.
    let closed: Observable<R | undefined>;
    if (this.layout.isCompact()) {
      const { MatBottomSheet } = await import('@angular/material/bottom-sheet');
      const ref = this.injector.get(MatBottomSheet).open<unknown, D, R>(component, {
        ...config,
        panelClass: [PANEL_CLASS.sheet, sizeClass],
      });
      handle.attach((result) => ref.dismiss(result));
      closed = ref.afterDismissed();
    } else {
      const { MatDialog } = await import('@angular/material/dialog');
      const ref = this.injector.get(MatDialog).open<unknown, D, R>(component, {
        ...config,
        panelClass: [PANEL_CLASS.dialog, sizeClass],
      });
      handle.attach((result) => ref.close(result));
      closed = ref.afterClosed();
    }

    const history = this.trackHistory(() => handle.close());
    const result = await firstValueFrom(closed);
    await history.release();
    return result;
  }

  /**
   * Adds a history entry for the overlay: popping it ("back") dismisses the overlay, and closing
   * the overlay any other way removes the entry. No entry while a navigation is running, e.g. the
   * confirmation of a guard.
   */
  private trackHistory(dismiss: () => void): { release: () => Promise<void> } {
    const window = this.window;
    if (!window || this.router.currentNavigation() !== null) {
      return { release: async () => undefined };
    }
    const id = nextOverlayId++;
    const isOpen = () => (overlayIdIn(window.history.state) ?? 0) >= id;
    window.history.pushState(
      { ...window.history.state, [HISTORY_KEY]: id },
      '',
      window.location.href,
    );

    const onPopState = () => {
      if (!isOpen()) {
        stopListening();
        dismiss();
      }
    };
    // A navigation elsewhere (a link, the session ending) also closes the overlay.
    const navigation = this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        take(1),
      )
      .subscribe(() => {
        stopListening();
        dismiss();
      });
    const stopListening = () => {
      window.removeEventListener('popstate', onPopState);
      navigation.unsubscribe();
    };
    window.addEventListener('popstate', onPopState);

    return {
      release: async () => {
        const ownsCurrentEntry = overlayIdIn(window.history.state) === id;
        stopListening();
        if (!ownsCurrentEntry) {
          return;
        }
        await new Promise<void>((resolve) => {
          const done = () => {
            window.removeEventListener('popstate', done);
            window.clearTimeout(timer);
            resolve();
          };
          const timer = window.setTimeout(done, OVERLAY_HISTORY_CLEANUP_TIMEOUT_MS);
          window.addEventListener('popstate', done);
          window.history.back();
        });
      },
    };
  }
}

function overlayIdIn(state: unknown): number | null {
  if (typeof state !== 'object' || state === null) {
    return null;
  }
  const value = (state as Record<string, unknown>)[HISTORY_KEY];
  return typeof value === 'number' ? value : null;
}
