import { afterNextRender, inject, Injectable, Injector } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { navigationKind, pathSegments } from '../../domain/navigation/navigation-kind';
import { ScrollContainer } from '../../shared/ui/services/scroll-container';
import { SCROLL_RESTORE_TIMEOUT_MS } from '../config/app.constants';

/** What to do with the scroll after a navigation (spec §13.5). */
export type ScrollAction = 'keep' | 'top' | 'restore';

/**
 * Each screen keeps its scroll: coming back to a tab or up from a detail restores where it was; a
 * deeper screen starts at the top; changing only the query (an inner tab) leaves it alone.
 */
export function scrollActionFor(fromUrl: string, toUrl: string): ScrollAction {
  switch (navigationKind(fromUrl, toUrl)) {
    case 'same':
      return 'keep';
    case 'deeper':
      return 'top';
    default:
      return 'restore';
  }
}

/** The key of a screen: its path, without the query. */
function screenKey(url: string): string {
  return `/${pathSegments(url).join('/')}`;
}

/**
 * Remembers the scroll of each screen of the app's scroller and puts it back (spec §13.5). The
 * content may still be loading when a screen comes back: it waits until it is tall enough, a short
 * while, and gives up as soon as the user scrolls.
 */
@Injectable({ providedIn: 'root' })
export class ScrollMemory {
  private readonly router = inject(Router);
  private readonly container = inject(ScrollContainer);
  private readonly injector = inject(Injector);
  private readonly positions = new Map<string, number>();
  private pending: (() => void) | null = null;

  /** Starts watching the navigations; for the life of the app. */
  init(): void {
    let fromUrl = this.router.url;
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        const scroller = this.container.element();
        if (scroller) {
          this.positions.set(screenKey(this.router.url), scroller.scrollTop);
        }
        fromUrl = this.router.url;
      } else if (event instanceof NavigationEnd) {
        const toUrl = event.urlAfterRedirects;
        const action = scrollActionFor(fromUrl, toUrl);
        if (action !== 'keep') {
          const top = action === 'top' ? 0 : (this.positions.get(screenKey(toUrl)) ?? 0);
          // Written once the new screen is in place, before the view transition takes it.
          afterNextRender({ write: () => this.scrollTo(top) }, { injector: this.injector });
        }
      }
    });
  }

  /** Forgets every position, e.g. on another space or after signing out. */
  clear(): void {
    this.positions.clear();
  }

  private scrollTo(top: number): void {
    this.pending?.();
    const scroller = this.container.element();
    if (!scroller) {
      return;
    }
    scroller.scrollTop = top;
    if (top === 0 || scroller.scrollTop >= top) {
      return;
    }
    // Not tall enough yet: try again as the content grows, until the user takes over.
    const content = scroller.firstElementChild ?? scroller;
    const observer = new ResizeObserver(() => {
      scroller.scrollTop = top;
      if (scroller.scrollTop >= top) {
        stop();
      }
    });
    const timer = setTimeout(() => stop(), SCROLL_RESTORE_TIMEOUT_MS);
    const events = ['wheel', 'touchstart', 'keydown'] as const;
    const stop = () => {
      observer.disconnect();
      clearTimeout(timer);
      events.forEach((name) => scroller.removeEventListener(name, stop));
      this.pending = null;
    };
    events.forEach((name) => scroller.addEventListener(name, stop, { passive: true }));
    observer.observe(content);
    this.pending = stop;
  }
}
