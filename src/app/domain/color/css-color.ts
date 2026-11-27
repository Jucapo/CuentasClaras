/** Red, green and blue channels, from 0 to 255. */
export type RgbColor = readonly [number, number, number];

/**
 * The side of `light-dark(a, b)` for a scheme; any other value comes back as it is. Computed styles
 * keep `light-dark()` as written, so code that needs the actual color (a canvas, a meta tag) picks it.
 */
export function resolveLightDark(value: string, dark: boolean): string {
  const match = /^light-dark\((.*)\)$/.exec(value.trim());
  if (!match) {
    return value;
  }
  const inner = match[1];
  let depth = 0;
  for (let index = 0; index < inner.length; index++) {
    const character = inner[index];
    if (character === '(') {
      depth++;
    } else if (character === ')') {
      depth--;
    } else if (character === ',' && depth === 0) {
      return (dark ? inner.slice(index + 1) : inner.slice(0, index)).trim();
    }
  }
  return value;
}

/** Channels of `#rgb`, `#rrggbb`, `rgb()` or `rgba()` (alpha ignored); null for anything else. */
export function parseCssColor(value: string): RgbColor | null {
  const text = value.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short) {
    return [short[1], short[2], short[3]].map((digit) => Number.parseInt(digit + digit, 16)) as [
      number,
      number,
      number,
    ];
  }
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(text);
  if (long) {
    return [long[1], long[2], long[3]].map((pair) => Number.parseInt(pair, 16)) as [
      number,
      number,
      number,
    ];
  }
  const functional = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text);
  if (functional) {
    return [functional[1], functional[2], functional[3]].map((channel) =>
      Math.min(255, Math.max(0, Math.round(Number(channel)))),
    ) as [number, number, number];
  }
  return null;
}

/** `#rrggbb` of some channels. */
export function toHexColor([red, green, blue]: RgbColor): string {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** The color seen when `overlay` covers `base` with an opacity from 0 to 1, as `#rrggbb`. */
export function blendColors(base: RgbColor, overlay: RgbColor, opacity: number): string {
  const alpha = Math.min(1, Math.max(0, opacity));
  return toHexColor(
    base.map((channel, index) => Math.round(channel * (1 - alpha) + overlay[index] * alpha)) as [
      number,
      number,
      number,
    ],
  );
}

/** Opacity of `count` stacked layers of the same translucent color. */
export function stackedOpacity(opacity: number, count: number): number {
  return count <= 0 ? 0 : 1 - (1 - opacity) ** count;
}
