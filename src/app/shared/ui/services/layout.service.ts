import { BreakpointObserver } from '@angular/cdk/layout';
import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { WINDOW_QUERIES, WindowClass, windowClassFor } from './window-class';

/** Current Material 3 window size class; templates and overlays adapt to it (spec §13.5). */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly breakpoints = inject(BreakpointObserver);

  /** Compact below 600 px, medium up to 839 px, expanded from 840 px. */
  readonly windowClass = toSignal(
    this.breakpoints
      .observe([WINDOW_QUERIES.medium, WINDOW_QUERIES.expanded])
      .pipe(
        map(({ breakpoints }) =>
          windowClassFor(
            breakpoints[WINDOW_QUERIES.medium] ?? false,
            breakpoints[WINDOW_QUERIES.expanded] ?? false,
          ),
        ),
      ),
    { requireSync: true },
  );

  readonly isCompact = computed(() => this.windowClass() === 'compact');
  readonly isExpanded = computed(() => this.windowClass() === 'expanded');
}

/** Values of `LayoutService` for tests and catalog demos that need a fixed window class. */
export function fixedLayout(windowClass: WindowClass): Pick<
  LayoutService,
  'windowClass' | 'isCompact' | 'isExpanded'
> {
  const value = computed(() => windowClass);
  return {
    windowClass: value,
    isCompact: computed(() => value() === 'compact'),
    isExpanded: computed(() => value() === 'expanded'),
  };
}
