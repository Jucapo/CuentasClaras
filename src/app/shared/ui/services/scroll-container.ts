import { Injectable, signal } from '@angular/core';

/**
 * The element that scrolls the content of the app (spec §13.5): only the content moves, between the
 * fixed header and navigation, so the window itself never scrolls. The app shell registers it.
 */
@Injectable({ providedIn: 'root' })
export class ScrollContainer {
  private readonly current = signal<HTMLElement | null>(null);

  /** The scrolling element, while the signed-in shell is on screen. */
  readonly element = this.current.asReadonly();

  /** Registers the scroller; returns what unregisters it, if it is still the one registered. */
  register(element: HTMLElement): () => void {
    this.current.set(element);
    return () => {
      if (this.current() === element) {
        this.current.set(null);
      }
    };
  }
}
