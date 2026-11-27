import { DOCUMENT, inject } from '@angular/core';
import { ActivatedRouteSnapshot, Data, ViewTransitionInfo } from '@angular/router';
import { navigationKind } from '../../domain/navigation/navigation-kind';
import { LayoutService } from '../../shared/ui/services/layout.service';
import { OverlayService } from '../../shared/ui/services/overlay.service';
import { ROUTE_DATA_KEYS } from './app-paths';

/** How screens change (spec §13.5): a fade between tabs, a slide into and out of a deeper one. */
export type ScreenTransition = 'fade' | 'forward' | 'back';

/**
 * What moves: only the `content` (the header and the navigation stay), or the whole `page` when they
 * appear or disappear (a flow or a subscreen in the compact class), as a native screen covers them.
 */
export type TransitionScope = 'content' | 'page';

/** Where a navigation goes and what it shows, for `screenTransition`. */
export interface TransitionEnd {
  readonly url: string;
  /** Whether it shows the header and the navigation. */
  readonly chrome: boolean;
  /** Whether it is a list with its detail beside it. */
  readonly sideBySide: boolean;
}

/** The transition of a navigation, or null when screens should just swap. */
export function screenTransition(
  from: TransitionEnd,
  to: TransitionEnd,
): { readonly kind: ScreenTransition; readonly scope: TransitionScope } | null {
  const kind = navigationKind(from.url, to.url);
  if (kind === 'same') {
    return null;
  }
  // The header and the navigation come or go: the whole screen slides.
  if (from.chrome !== to.chrome) {
    return { kind: to.chrome ? 'back' : 'forward', scope: 'page' };
  }
  // A list and its detail side by side: only the detail pane changes.
  if (from.sideBySide && to.sideBySide && firstSegment(from.url) === firstSegment(to.url)) {
    return null;
  }
  switch (kind) {
    case 'deeper':
      return { kind: 'forward', scope: 'content' };
    case 'shallower':
      return { kind: 'back', scope: 'content' };
    default:
      return { kind: 'fade', scope: 'content' };
  }
}

function firstSegment(url: string): string {
  return (
    url
      .split(/[?#]/, 1)[0]
      .split('/')
      .find((segment) => segment.length > 0) ?? ''
  );
}

/** The URL path and the merged route data of a router state, from its root snapshot. */
function describe(root: ActivatedRouteSnapshot): { url: string; data: Data } {
  const segments: string[] = [];
  let data: Data = {};
  for (let route: ActivatedRouteSnapshot | null = root; route; route = route.firstChild) {
    segments.push(...route.url.map((segment) => segment.path));
    data = { ...data, ...route.data };
  }
  return { url: `/${segments.join('/')}`, data };
}

let nextTransitionId = 0;

/**
 * Router hook (withViewTransitions): picks the transition of each navigation and marks it on
 * `<html>` for the styles in src/styles/_transitions.scss, or skips it: with reduced motion, while
 * an overlay or its backdrop is on screen (they would end up under the header), and when only the
 * query or the detail beside a list changes.
 */
export function onViewTransitionCreated({ transition, from, to }: ViewTransitionInfo): void {
  const document = inject(DOCUMENT);
  const layout = inject(LayoutService);
  const overlay = inject(OverlayService);
  const view = document.defaultView;
  if (
    view?.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    overlay.anyOpen() ||
    document.querySelector('.cdk-overlay-backdrop')
  ) {
    transition.skipTransition();
    return;
  }
  const end = (snapshot: ActivatedRouteSnapshot): TransitionEnd => {
    const { url, data } = describe(snapshot);
    const fullScreen =
      data[ROUTE_DATA_KEYS.flow] === true || data[ROUTE_DATA_KEYS.subscreen] === true;
    return {
      url,
      chrome: !(fullScreen && layout.isCompact()),
      sideBySide: data[ROUTE_DATA_KEYS.listDetail] === true && layout.isExpanded(),
    };
  };
  const chosen = screenTransition(end(from), end(to));
  if (!chosen) {
    transition.skipTransition();
    return;
  }
  const root = document.documentElement;
  const id = String(++nextTransitionId);
  root.dataset['ccTransition'] = chosen.kind;
  root.dataset['ccTransitionScope'] = chosen.scope;
  root.dataset['ccTransitionId'] = id;
  // A newer navigation may have replaced the marks already: only clear our own.
  void transition.finished.finally(() => {
    if (root.dataset['ccTransitionId'] === id) {
      delete root.dataset['ccTransition'];
      delete root.dataset['ccTransitionScope'];
      delete root.dataset['ccTransitionId'];
    }
  });
}
