// Single source of the color palette (spec §13.3): the pickers and every colored element read it.
// The database stores the key; each color has a variant per theme, applied with light-dark().
import { contrastRatio, MIN_GRAPHIC_CONTRAST } from '../../../domain/color/contrast';

/** A tone of the palette with its Material Design tonal scale, steps 200 to 900. */
interface ToneDefinition {
  readonly key: string;
  /** Spanish name, the start of every accessible label of the tone. */
  readonly label: string;
  /** `#rrggbb` of the steps 200, 300, 400, 500, 600, 700, 800 and 900. */
  readonly scale: readonly [string, string, string, string, string, string, string, string];
}

/** Tones around the color wheel, then the neutrals, in display order. */
export const COLOR_TONES = [
  {
    key: 'red',
    label: 'Rojo',
    scale: ['#ef9a9a', '#e57373', '#ef5350', '#f44336', '#e53935', '#d32f2f', '#c62828', '#b71c1c'],
  },
  {
    key: 'orange',
    label: 'Naranja',
    scale: ['#ffcc80', '#ffb74d', '#ffa726', '#ff9800', '#fb8c00', '#f57c00', '#ef6c00', '#e65100'],
  },
  {
    key: 'amber',
    label: 'Ámbar',
    scale: ['#ffe082', '#ffd54f', '#ffca28', '#ffc107', '#ffb300', '#ffa000', '#ff8f00', '#ff6f00'],
  },
  {
    key: 'yellow',
    label: 'Amarillo',
    scale: ['#fff59d', '#fff176', '#ffee58', '#ffeb3b', '#fdd835', '#fbc02d', '#f9a825', '#f57f17'],
  },
  {
    key: 'lime',
    label: 'Lima',
    scale: ['#c5e1a5', '#aed581', '#9ccc65', '#8bc34a', '#7cb342', '#689f38', '#558b2f', '#33691e'],
  },
  {
    key: 'green',
    label: 'Verde',
    scale: ['#a5d6a7', '#81c784', '#66bb6a', '#4caf50', '#43a047', '#388e3c', '#2e7d32', '#1b5e20'],
  },
  {
    key: 'teal',
    label: 'Verde azulado',
    scale: ['#80cbc4', '#4db6ac', '#26a69a', '#009688', '#00897b', '#00796b', '#00695c', '#004d40'],
  },
  {
    key: 'cyan',
    label: 'Cian',
    scale: ['#80deea', '#4dd0e1', '#26c6da', '#00bcd4', '#00acc1', '#0097a7', '#00838f', '#006064'],
  },
  {
    key: 'sky',
    label: 'Celeste',
    scale: ['#81d4fa', '#4fc3f7', '#29b6f6', '#03a9f4', '#039be5', '#0288d1', '#0277bd', '#01579b'],
  },
  {
    key: 'blue',
    label: 'Azul',
    scale: ['#90caf9', '#64b5f6', '#42a5f5', '#2196f3', '#1e88e5', '#1976d2', '#1565c0', '#0d47a1'],
  },
  {
    key: 'indigo',
    label: 'Índigo',
    scale: ['#9fa8da', '#7986cb', '#5c6bc0', '#3f51b5', '#3949ab', '#303f9f', '#283593', '#1a237e'],
  },
  {
    key: 'violet',
    label: 'Violeta',
    scale: ['#b39ddb', '#9575cd', '#7e57c2', '#673ab7', '#5e35b1', '#512da8', '#4527a0', '#311b92'],
  },
  {
    key: 'purple',
    label: 'Morado',
    scale: ['#ce93d8', '#ba68c8', '#ab47bc', '#9c27b0', '#8e24aa', '#7b1fa2', '#6a1b9a', '#4a148c'],
  },
  {
    key: 'pink',
    label: 'Rosado',
    scale: ['#f48fb1', '#f06292', '#ec407a', '#e91e63', '#d81b60', '#c2185b', '#ad1457', '#880e4f'],
  },
  {
    key: 'brown',
    label: 'Café',
    scale: ['#bcaaa4', '#a1887f', '#8d6e63', '#795548', '#6d4c41', '#5d4037', '#4e342e', '#3e2723'],
  },
  {
    key: 'gray',
    label: 'Gris',
    scale: ['#eeeeee', '#e0e0e0', '#bdbdbd', '#9e9e9e', '#757575', '#616161', '#424242', '#212121'],
  },
] as const satisfies readonly ToneDefinition[];

/**
 * Intensities of every tone, lightest first, with the tonal step used in each theme. The dark
 * theme takes one step softer at both ends. The base intensity keeps the bare tone key, close to
 * the colors of the first palette.
 */
export const COLOR_INTENSITIES = [
  { suffix: 'pale', label: 'pálido', light: 200, dark: 300 },
  { suffix: 'light', label: 'claro', light: 400, dark: 400 },
  { suffix: null, label: '', light: 700, dark: 600 },
  { suffix: 'deep', label: 'intenso', light: 800, dark: 700 },
  { suffix: 'dark', label: 'oscuro', light: 900, dark: 800 },
] as const;

/** Key of a tone, e.g. `blue`. */
export type ToneKey = (typeof COLOR_TONES)[number]['key'];

type IntensitySuffix = NonNullable<(typeof COLOR_INTENSITIES)[number]['suffix']>;

/** Key of a palette color, as stored in the database: `blue` or `blue-pale`. */
export type ColorKey = ToneKey | `${ToneKey}-${IntensitySuffix}`;

/** Icon color over a palette color when white does not reach 3:1 (neutral 10 of the theme). */
export const PALETTE_DARK_FOREGROUND = '#1a1c20';
const WHITE = '#ffffff';

/** A color users can pick for categories, accounts, spaces and tags. */
export interface PaletteColor {
  readonly key: ColorKey;
  /** Spanish name, used as the accessible label, e.g. "Azul pálido". */
  readonly label: string;
  readonly tone: ToneKey;
  readonly intensity: IntensitySuffix | null;
  /** `#rrggbb` for the light theme. */
  readonly light: string;
  /** `#rrggbb` for the dark theme. */
  readonly dark: string;
  /** Icon color over it in the light theme: white when it reaches 3:1, else dark. */
  readonly onLight: string;
  /** Icon color over it in the dark theme. */
  readonly onDark: string;
}

/** A tone with its colors, lightest first: a row (or column) of the color grid. */
export interface PaletteTone {
  readonly key: ToneKey;
  readonly label: string;
  readonly colors: readonly PaletteColor[];
}

function stepColor(scale: readonly string[], step: number): string {
  return scale[step / 100 - 2];
}

/** White over a color when it keeps 3:1 (WCAG 1.4.11); otherwise the dark foreground. */
export function readableForeground(background: string): string {
  return contrastRatio(WHITE, background) >= MIN_GRAPHIC_CONTRAST ? WHITE : PALETTE_DARK_FOREGROUND;
}

/** The palette as tones of five intensities, in display order. */
export const PALETTE_TONES: readonly PaletteTone[] = COLOR_TONES.map((tone) => ({
  key: tone.key,
  label: tone.label,
  colors: COLOR_INTENSITIES.map((intensity) => {
    const light = stepColor(tone.scale, intensity.light);
    const dark = stepColor(tone.scale, intensity.dark);
    return {
      key: (intensity.suffix ? `${tone.key}-${intensity.suffix}` : tone.key) as ColorKey,
      label: intensity.label ? `${tone.label} ${intensity.label}` : tone.label,
      tone: tone.key,
      intensity: intensity.suffix,
      light,
      dark,
      onLight: readableForeground(light),
      onDark: readableForeground(dark),
    };
  }),
}));

/** Every palette color, tone by tone. */
export const COLOR_PALETTE: readonly PaletteColor[] = PALETTE_TONES.flatMap((tone) => tone.colors);

/**
 * Keys of the first palette (F1b) that are no longer a tone, with the nearest color of the grid
 * (distance in OKLab). What is stored keeps working; it changes only when the user picks again.
 */
export const LEGACY_COLOR_ALIASES: Readonly<Record<string, ColorKey>> = {
  crimson: 'red-dark',
  tangerine: 'orange-dark',
  mustard: 'brown-light',
  olive: 'lime-deep',
  emerald: 'green-deep',
  forest: 'green-dark',
  navy: 'indigo-dark',
  lavender: 'violet-light',
  plum: 'pink-dark',
  magenta: 'pink-deep',
  rose: 'pink',
  mocha: 'brown-light',
  sand: 'brown-light',
  slate: 'gray',
  graphite: 'gray-deep',
};

/** Color shown when a stored key is not in the palette. */
export const FALLBACK_COLOR: ColorKey = 'gray';

const COLORS_BY_KEY = new Map<string, PaletteColor>(
  COLOR_PALETTE.map((color) => [color.key, color]),
);

/** Whether a stored key names a palette color (not an alias). */
export function isColorKey(value: string): value is ColorKey {
  return COLORS_BY_KEY.has(value);
}

/** The palette color a stored key means, following the aliases of the first palette; or null. */
export function resolveColorKey(value: string | null | undefined): ColorKey | null {
  if (!value) {
    return null;
  }
  if (isColorKey(value)) {
    return value;
  }
  return Object.hasOwn(LEGACY_COLOR_ALIASES, value) ? LEGACY_COLOR_ALIASES[value] : null;
}

/** The palette color for a stored key (aliases included), or the fallback when it is unknown. */
export function colorOrFallback(value: string | null | undefined): ColorKey {
  return resolveColorKey(value) ?? FALLBACK_COLOR;
}

function paletteEntry(key: ColorKey): PaletteColor | undefined {
  return COLORS_BY_KEY.get(key) ?? COLORS_BY_KEY.get(FALLBACK_COLOR);
}

/** CSS value of a color that follows the theme: `light-dark(<light>, <dark>)`. */
export function paletteColor(key: ColorKey): string {
  const color = paletteEntry(key);
  return color ? `light-dark(${color.light}, ${color.dark})` : '';
}

/** CSS value of the icon color over a palette color, chosen by contrast in each theme. */
export function paletteForeground(key: ColorKey): string {
  const color = paletteEntry(key);
  return color ? `light-dark(${color.onLight}, ${color.onDark})` : '';
}

/** Spanish name of a palette color. */
export function colorLabel(key: ColorKey): string {
  return COLORS_BY_KEY.get(key)?.label ?? key;
}
