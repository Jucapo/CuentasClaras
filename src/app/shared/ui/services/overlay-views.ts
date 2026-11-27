import { afterNextRender, Injector, signal } from '@angular/core';
import { LeaveView, OverlayHandle } from './overlay.service';

/** The scrolled elements of a screen and of the overlay around it. */
export function scrollPositions(root: HTMLElement): (readonly [Element, number])[] {
  const elements: Element[] = Array.from(root.querySelectorAll('*'));
  for (let element = root.parentElement; element; element = element.parentElement) {
    elements.push(element);
  }
  return elements
    .filter((element) => element.scrollTop > 0)
    .map((element) => [element, element.scrollTop] as const);
}

/** The focused element, if it is inside `root`. */
export function activeElementIn(root: HTMLElement): HTMLElement | null {
  const active = root.ownerDocument.activeElement;
  return active instanceof HTMLElement && root.contains(active) ? active : null;
}

/** The title of a view gets the focus, so it is announced and the keyboard types into it. */
export function focusHeading(view: Element | null): void {
  const heading = view?.querySelector<HTMLElement>('h2');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus();
  }
}

/** Where the main screen was when a view covered it. */
interface Place {
  readonly scroll: readonly (readonly [Element, number])[];
  readonly focus: HTMLElement | null;
}

/**
 * Views inside an overlay or a pane (spec §13.5), e.g. the pickers of the quick entry: one at a
 * time over the main screen. In an overlay each view adds a history entry, so the system back
 * button returns to the main screen; ← and Esc do too (`back`). The main screen gets its scroll and
 * focus back. Entering a view while another one shows replaces it.
 */
export class OverlayViews<V> {
  /** The view shown; `home` is the main screen. */
  readonly current;
  private leaveView: LeaveView | null = null;
  private place: Place | null = null;
  private destroyed = false;

  constructor(
    private readonly home: V,
    private readonly host: HTMLElement,
    private readonly injector: Injector,
    /** Null in a pane: no history entries, ← and Esc only. */
    private readonly handle: OverlayHandle<unknown> | null,
    /** The selector of the view's container, whose title gets the focus. */
    private readonly viewSelector: string,
  ) {
    this.current = signal<V>(home);
  }

  atHome(): boolean {
    return this.current() === this.home;
  }

  enter(view: V): void {
    if (this.atHome()) {
      this.place = { scroll: scrollPositions(this.host), focus: activeElementIn(this.host) };
      this.leaveView =
        this.handle?.enterView(() => {
          // The system back button.
          this.leaveView = null;
          this.showHome();
        }) ?? null;
    }
    this.current.set(view);
    afterNextRender(() => focusHeading(this.host.querySelector(this.viewSelector)), {
      injector: this.injector,
    });
  }

  /** ← and Esc in a view. */
  back(): void {
    const leave = this.leaveView;
    this.leaveView = null;
    leave?.();
    this.showHome();
  }

  /** Stops restoring anything, e.g. once the host is gone. */
  destroy(): void {
    this.destroyed = true;
  }

  private showHome(): void {
    if (this.destroyed || this.atHome()) {
      return;
    }
    const place = this.place;
    this.place = null;
    this.current.set(this.home);
    afterNextRender(
      () => {
        place?.focus?.focus({ preventScroll: true });
        for (const [element, top] of place?.scroll ?? []) {
          element.scrollTop = top;
        }
      },
      { injector: this.injector },
    );
  }
}
