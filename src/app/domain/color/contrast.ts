/** WCAG 1.4.11: minimum contrast of graphical objects such as icons. */
export const MIN_GRAPHIC_CONTRAST = 3;

/** WCAG 1.4.3 (AA): minimum contrast of normal text. */
export const MIN_TEXT_CONTRAST = 4.5;

/** Red, green and blue channels of a `#rrggbb` color, from 0 to 255. */
export function parseHexColor(hex: string): readonly [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) {
    throw new Error(`Not a #rrggbb color: ${hex}`);
  }
  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  ];
}

/** WCAG relative luminance of a `#rrggbb` color, from 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [red, green, blue] = parseHexColor(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG contrast ratio between two `#rrggbb` colors, from 1 to 21. */
export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}
