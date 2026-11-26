import { ICON_CODEPOINTS, IconName } from './icon-codepoints.generated';

export type { IconName };

/** Icon shown when a stored key is not in the font subset (e.g. after trimming the catalog). */
export const FALLBACK_ICON: IconName = 'category';

/** Whether a stored key names an icon of the font subset. */
export function isIconName(value: string): value is IconName {
  return Object.hasOwn(ICON_CODEPOINTS, value);
}

/** The icon for a stored key, or the fallback when the key is unknown. */
export function iconOrFallback(value: string | null | undefined): IconName {
  return value && isIconName(value) ? value : FALLBACK_ICON;
}

/** Character that renders an icon with the self-hosted font (icons render by codepoint). */
export function iconGlyph(name: IconName): string {
  return String.fromCodePoint(ICON_CODEPOINTS[name]);
}
