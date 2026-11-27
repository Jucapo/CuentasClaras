import { DOCUMENT } from '@angular/common';
import { inject, Injectable, InjectionToken, Injector, Type } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter, firstValueFrom, Observable, take } from 'rxjs';
import { OVERLAY_HISTORY_CLEANUP_TIMEOUT_MS } from '../ui.constants';
import { LayoutService } from './layout.service';

/** Data handed to the component shown in an overlay. */
export const OVERLAY_DATA = new InjectionToken<unknown>('OVERLAY_DATA');

/** Leaves a view entered with `OverlayHandle.enterView` from the interface (its ←). */
export type LeaveView = () => void;

/** Lets the component inside an overlay close it with a result. */
export class OverlayHandle<R> {
  private closeOverlay: ((result?: R) => void) | null = null;
  private openView: ((onBack: () => void) => LeaveView) | null = null;
  private guard: (() => boolean) | null = null;

  /** Closes the overlay; no result means it was dismissed. */
  close(result?: R): void {
    this.closeOverlay?.(result);
  }

  /**
   * Asked before the backdrop, Esc or the system back button dismiss the overlay (spec §13.5):
   * true lets it close; false keeps it open, and the component then asks, e.g. "¿Descartar los
   * cambios?", once this call returns (so its view goes on top of the overlay's history entry).
   * Closing from the component (`close`) does not ask.
   */
  guardClose(guard: () => boolean): void {
    this.guard = guard;
  }

  /** Whether the overlay may be dismissed now; see `guardClose`. */
  mayDismiss(): boolean {
    return this.guard?.() ?? true;
  }

  /** Dismisses the overlay unless its guard keeps it open. */
  requestClose(): void {
    if (this.mayDismiss()) {
      this.close();
    }
  }

  /**
   * Enters a view inside the overlay, e.g. a calculator within a detail (spec §13.5: still one
   * overlay). The system back button then calls `onBack` and stays in the overlay; the returned
   * function leaves the view from the interface.
   */
  enterView(onBack: () => void): LeaveView {
    return this.openView?.(onBack) ?? (() => undefined);
  }

  /** Connects the handle to the opened overlay. */
  attach(close: (result?: R) => void, enterView?: (onBack: () => void) => LeaveView): void {
    this.closeOverlay = close;
    this.openView = enterView ?? null;
  }
}

/** Options of `OverlayService.open`. */
export interface OverlayOptions<D> {
  readonly data: D;
  /** Accessible name of the dialog or sheet. */
  readonly label: string;
  /**
   * `picker` is wide enough for grids; `confirm` is a short question; `entry` is the quick entry,
   * a tall sheet on phones and a two-column dialog elsewhere.
   */
  readonly size?: 'picker' | 'confirm' | 'entry' | 'calculator';
  /** What gets the focus: the title by default, or a CSS selector, e.g. `input` for a new item. */
  readonly autoFocus?: string;
}

const PANEL_CLASS = { dialog: 'cc-overlay-dialog', sheet: 'cc-overlay-sheet' } as const;

/** Key of the history entry an open overlay adds, so "back" closes it instead of navigating. */
const HISTORY_KEY = 'ccOverlay';

/** Key of the history entry a view inside an overlay adds, so "back" leaves only the view. */
const VIEW_HISTORY_KEY = 'ccOverlayView';

let nextOverlayId = 1;
let nextViewId = 1;

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
      // The backdrop and Esc go through the handle's guard (see dismissOn).
      disableClose: true,
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
      handle.attach(
        (result) => ref.dismiss(result),
        (onBack) => history.enterView(onBack),
      );
      dismissOn(ref.backdropClick(), ref.keydownEvents(), handle);
      closed = ref.afterDismissed();
    } else {
      const { MatDialog } = await import('@angular/material/dialog');
      const ref = this.injector.get(MatDialog).open<unknown, D, R>(component, {
        ...config,
        panelClass: [PANEL_CLASS.dialog, sizeClass],
      });
      handle.attach(
        (result) => ref.close(result),
        (onBack) => history.enterView(onBack),
      );
      dismissOn(ref.backdropClick(), ref.keydownEvents(), handle);
      closed = ref.afterClosed();
    }

    // Views are entered once the overlay is open, after this.
    const history = this.trackHistory(handle);
    const result = await firstValueFrom(closed);
    await history.release();
    return result;
  }

  /**
   * Adds a history entry for the overlay: popping it ("back") dismisses the overlay, unless its
   * guard keeps it (then the entry comes back), and closing the overlay any other way removes the
   * entry, and those of its views. No entry while a navigation is running, e.g. the confirmation of
   * a guard.
   */
  private trackHistory<R>(handle: OverlayHandle<R>): OverlayHistory {
    const window = this.window;
    if (!window || this.router.currentNavigation() !== null) {
      return { enterView: () => () => undefined, release: async () => undefined };
    }
    const id = nextOverlayId++;
    const views = new Set<() => void>();
    const isOpen = () => (overlayIdIn(window.history.state) ?? 0) >= id;
    const pushEntry = () =>
      window.history.pushState(
        { ...window.history.state, [HISTORY_KEY]: id },
        '',
        window.location.href,
      );
    pushEntry();

    const onPopState = () => {
      if (isOpen()) {
        return;
      }
      if (handle.mayDismiss()) {
        stopListening();
        handle.close();
        return;
      }
      // Kept open: its entry comes back, under the question the component is about to show.
      pushEntry();
    };
    // A navigation elsewhere (a link, the session ending) also closes the overlay.
    const navigation = this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        take(1),
      )
      .subscribe(() => {
        stopListening();
        handle.close();
      });
    const stopListening = () => {
      window.removeEventListener('popstate', onPopState);
      navigation.unsubscribe();
    };
    window.addEventListener('popstate', onPopState);

    return {
      enterView: (onBack) => {
        const viewId = nextViewId++;
        // Copies the overlay's id, so the overlay stays open on this entry and the one below.
        window.history.pushState(
          { ...window.history.state, [VIEW_HISTORY_KEY]: viewId },
          '',
          window.location.href,
        );
        const onViewPopState = () => {
          if (viewIdIn(window.history.state) !== viewId) {
            stopView();
            onBack();
          }
        };
        const stopView = () => {
          views.delete(stopView);
          window.removeEventListener('popstate', onViewPopState);
        };
        views.add(stopView);
        window.addEventListener('popstate', onViewPopState);
        return () => {
          if (!views.has(stopView)) {
            return;
          }
          stopView();
          if (viewIdIn(window.history.state) === viewId) {
            window.history.back();
          }
        };
      },
      release: async () => {
        views.forEach((stopView) => stopView());
        stopListening();
        // The overlay's entry, and the one of a view left open on top of it.
        while (overlayIdIn(window.history.state) === id && (await goBack(window))) {
          // Each step waits for its popstate.
        }
        // The router handles popstate in a later task; once it has, a navigation of the caller
        // is the newest one and is not cancelled by it.
        await new Promise<void>((resolve) => window.setTimeout(resolve));
      },
    };
  }
}

/** The history entries of an open overlay. */
interface OverlayHistory {
  /** Adds the entry of a view inside the overlay; see `OverlayHandle.enterView`. */
  readonly enterView: (onBack: () => void) => LeaveView;
  /** Removes the entries once the overlay closed. */
  readonly release: () => Promise<void>;
}

/** The backdrop and Esc dismiss the overlay through its guard (Esc a view handled stays put). */
function dismissOn<R>(
  backdropClick: Observable<MouseEvent>,
  keydown: Observable<KeyboardEvent>,
  handle: OverlayHandle<R>,
): void {
  backdropClick.subscribe(() => handle.requestClose());
  keydown
    .pipe(filter((event) => event.key === 'Escape' && !event.defaultPrevented))
    .subscribe((event) => {
      event.preventDefault();
      handle.requestClose();
    });
}

/** Goes one entry back; false if the browser did not move in time. */
function goBack(window: Window): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (moved: boolean) => {
      window.removeEventListener('popstate', onPopState);
      window.clearTimeout(timer);
      resolve(moved);
    };
    const onPopState = () => done(true);
    const timer = window.setTimeout(() => done(false), OVERLAY_HISTORY_CLEANUP_TIMEOUT_MS);
    window.addEventListener('popstate', onPopState);
    window.history.back();
  });
}

function idIn(state: unknown, key: string): number | null {
  if (typeof state !== 'object' || state === null) {
    return null;
  }
  const value = (state as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : null;
}

function overlayIdIn(state: unknown): number | null {
  return idIn(state, HISTORY_KEY);
}

function viewIdIn(state: unknown): number | null {
  return idIn(state, VIEW_HISTORY_KEY);
}
