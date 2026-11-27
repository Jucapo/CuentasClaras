import { WINDOW_BREAKPOINTS } from '../ui.constants';

/** Material 3 window size class (spec §13.5). */
export type WindowClass = 'compact' | 'medium' | 'expanded';

/** Media query that matches from `width` pixels up. */
export function minWidthQuery(width: number): string {
  return `(min-width: ${width}px)`;
}

/** Media queries that mark the start of the medium and expanded classes. */
export const WINDOW_QUERIES = {
  medium: minWidthQuery(WINDOW_BREAKPOINTS.medium),
  expanded: minWidthQuery(WINDOW_BREAKPOINTS.expanded),
} as const;

/** Window class given which of the medium and expanded queries match. */
export function windowClassFor(atLeastMedium: boolean, atLeastExpanded: boolean): WindowClass {
  if (atLeastExpanded) {
    return 'expanded';
  }
  return atLeastMedium ? 'medium' : 'compact';
}
