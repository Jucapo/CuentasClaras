/**
 * How a navigation moves through the screens, from their paths (query and fragment ignored):
 * - `same`: only the query changed, e.g. an inner tab;
 * - `deeper`: into a screen below, e.g. Cuentas → an account;
 * - `shallower`: back up to a screen above, e.g. an account → Cuentas;
 * - `sideways`: anywhere else, e.g. another tab.
 */
export type NavigationKind = 'same' | 'deeper' | 'shallower' | 'sideways';

/** The segments of a URL's path: `/cuentas/a1?vista=x` → `['cuentas', 'a1']`. */
export function pathSegments(url: string): readonly string[] {
  const path = url.split(/[?#]/, 1)[0];
  return path.split('/').filter((segment) => segment.length > 0);
}

function startsWith(segments: readonly string[], prefix: readonly string[]): boolean {
  return prefix.every((segment, index) => segments[index] === segment);
}

/**
 * Classifies a navigation (spec §13.5): screens slide forward into a deeper one and back out of it,
 * fade between tabs, and keep their scroll when only the query changes.
 */
export function navigationKind(fromUrl: string, toUrl: string): NavigationKind {
  const from = pathSegments(fromUrl);
  const to = pathSegments(toUrl);
  if (from.length === to.length && startsWith(to, from)) {
    return 'same';
  }
  if (to.length > from.length && startsWith(to, from)) {
    return 'deeper';
  }
  if (from.length > to.length && startsWith(from, to)) {
    return 'shallower';
  }
  return 'sideways';
}
