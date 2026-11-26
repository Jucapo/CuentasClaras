// Single source of the color palette (spec §13.3): the pickers and every colored element read it.
// The database stores the key; each color has a variant per theme, applied with light-dark().

/** A color users can pick for categories, accounts, spaces and tags. */
export interface PaletteColor {
  readonly key: string;
  /** Spanish name, used as the accessible label. */
  readonly label: string;
  /** `#rrggbb` for the light theme. */
  readonly light: string;
  /** `#rrggbb` for the dark theme. */
  readonly dark: string;
}

/** Curated colors in display order (around the color wheel, then neutrals). */
export const COLOR_PALETTE = [
  { key: 'red', label: 'Rojo', light: '#d32f2f', dark: '#e05252' },
  { key: 'crimson', label: 'Granate', light: '#a4262c', dark: '#c0474c' },
  { key: 'tangerine', label: 'Mandarina', light: '#d84315', dark: '#e5603b' },
  { key: 'orange', label: 'Naranja', light: '#e65100', dark: '#e36414' },
  { key: 'amber', label: 'Ámbar', light: '#b26a00', dark: '#c47a00' },
  { key: 'mustard', label: 'Mostaza', light: '#9e7c0c', dark: '#a8861a' },
  { key: 'olive', label: 'Oliva', light: '#6b7f1a', dark: '#7c9128' },
  { key: 'lime', label: 'Lima', light: '#558b2f', dark: '#689f38' },
  { key: 'green', label: 'Verde', light: '#2e7d32', dark: '#388e3c' },
  { key: 'emerald', label: 'Esmeralda', light: '#00875a', dark: '#009b6a' },
  { key: 'forest', label: 'Bosque', light: '#1b5e20', dark: '#2f6b33' },
  { key: 'teal', label: 'Verde azulado', light: '#00796b', dark: '#00897b' },
  { key: 'cyan', label: 'Cian', light: '#00838f', dark: '#0097a7' },
  { key: 'sky', label: 'Celeste', light: '#0277bd', dark: '#0288d1' },
  { key: 'blue', label: 'Azul', light: '#1565c0', dark: '#1e88e5' },
  { key: 'navy', label: 'Azul marino', light: '#1a237e', dark: '#283593' },
  { key: 'indigo', label: 'Índigo', light: '#3949ab', dark: '#5c6bc0' },
  { key: 'violet', label: 'Violeta', light: '#5e35b1', dark: '#7353c6' },
  { key: 'lavender', label: 'Lavanda', light: '#7e57c2', dark: '#9575cd' },
  { key: 'purple', label: 'Morado', light: '#8e24aa', dark: '#a33dbf' },
  { key: 'plum', label: 'Ciruela', light: '#7b1f5a', dark: '#9a3374' },
  { key: 'magenta', label: 'Magenta', light: '#b0127d', dark: '#c2389a' },
  { key: 'pink', label: 'Rosado', light: '#d81b60', dark: '#e2487f' },
  { key: 'rose', label: 'Frambuesa', light: '#c62853', dark: '#d9506f' },
  { key: 'brown', label: 'Café', light: '#6d4c41', dark: '#8a6355' },
  { key: 'mocha', label: 'Moca', light: '#8d6e63', dark: '#a1887f' },
  { key: 'sand', label: 'Arena', light: '#8d7b4a', dark: '#a08d5a' },
  { key: 'slate', label: 'Pizarra', light: '#546e7a', dark: '#6e8a97' },
  { key: 'gray', label: 'Gris', light: '#757575', dark: '#8a8a8a' },
  { key: 'graphite', label: 'Grafito', light: '#424242', dark: '#5c5c5c' },
] as const satisfies readonly PaletteColor[];

/** Key of a palette color, as stored in the database. */
export type ColorKey = (typeof COLOR_PALETTE)[number]['key'];

/** Color shown when a stored key is not in the palette. */
export const FALLBACK_COLOR: ColorKey = 'gray';

const COLORS_BY_KEY = new Map<string, PaletteColor>(
  COLOR_PALETTE.map((color) => [color.key, color]),
);

/** Whether a stored key names a palette color. */
export function isColorKey(value: string): value is ColorKey {
  return COLORS_BY_KEY.has(value);
}

/** The palette color for a stored key, or the fallback when the key is unknown. */
export function colorOrFallback(value: string | null | undefined): ColorKey {
  return value && isColorKey(value) ? value : FALLBACK_COLOR;
}

/** CSS value of a color that follows the theme: `light-dark(<light>, <dark>)`. */
export function paletteColor(key: ColorKey): string {
  const color = COLORS_BY_KEY.get(key) ?? COLORS_BY_KEY.get(FALLBACK_COLOR);
  return color ? `light-dark(${color.light}, ${color.dark})` : '';
}

/** Spanish name of a palette color. */
export function colorLabel(key: ColorKey): string {
  return COLORS_BY_KEY.get(key)?.label ?? key;
}
