import {
  contrastRatio,
  MIN_GRAPHIC_CONTRAST,
  MIN_LARGE_TEXT_CONTRAST,
  MIN_TEXT_CONTRAST,
} from '../../../domain/color/contrast';
import {
  COLOR_INTENSITIES,
  COLOR_PALETTE,
  COLOR_TONES,
  colorLabel,
  colorOrFallback,
  FALLBACK_COLOR,
  isColorKey,
  LEGACY_COLOR_ALIASES,
  PALETTE_DARK_FOREGROUND,
  PALETTE_TEXT_SURFACES,
  paletteAccent,
  paletteColor,
  paletteForeground,
  paletteLargeTextColor,
  paletteOnColorText,
  paletteTextColor,
  PALETTE_TONES,
  readableForeground,
  readableTextForeground,
  resolveColorKey,
} from './color-palette';

const WHITE = '#ffffff';

function lightDarkSides(value: string): [string, string] {
  const [, light, dark] = /^light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)$/.exec(value) ?? [
    '',
    '',
    '',
  ];
  return [light, dark];
}

/** Every key the first palette (F1b) could store; production data only has these. */
const FIRST_PALETTE_KEYS = [
  'red',
  'crimson',
  'tangerine',
  'orange',
  'amber',
  'mustard',
  'olive',
  'lime',
  'green',
  'emerald',
  'forest',
  'teal',
  'cyan',
  'sky',
  'blue',
  'navy',
  'indigo',
  'violet',
  'lavender',
  'purple',
  'plum',
  'magenta',
  'pink',
  'rose',
  'brown',
  'mocha',
  'sand',
  'slate',
  'gray',
  'graphite',
];

describe('color palette', () => {
  it('is a grid of about sixteen tones by five intensities with unique keys', () => {
    expect(COLOR_TONES.length).toBe(16);
    expect(COLOR_INTENSITIES.length).toBe(5);
    expect(COLOR_PALETTE.length).toBe(80);
    expect(new Set(COLOR_PALETTE.map((color) => color.key)).size).toBe(COLOR_PALETTE.length);
    for (const tone of PALETTE_TONES) {
      expect(tone.colors.map((color) => color.intensity)).toEqual([
        'pale',
        'light',
        null,
        'deep',
        'dark',
      ]);
    }
  });

  // The color_key domain of the database: letters and hyphens, at most 32 characters.
  it('uses keys the database accepts, never hex values', () => {
    for (const color of COLOR_PALETTE) {
      expect(color.key).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(color.key.length).toBeLessThanOrEqual(32);
    }
  });

  // Spec §13.3: the icon over a color is white when it reaches 3:1, else dark, in both themes.
  for (const color of COLOR_PALETTE) {
    it(`keeps the icon readable on ${color.key} in light and dark`, () => {
      for (const [background, foreground] of [
        [color.light, color.onLight],
        [color.dark, color.onDark],
      ]) {
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST);
        const whiteReaches = contrastRatio(WHITE, background) >= MIN_GRAPHIC_CONTRAST;
        expect(foreground).toBe(whiteReaches ? WHITE : PALETTE_DARK_FOREGROUND);
      }
    });
  }

  // Spec §7: an amount in the color of its category keeps AA on the surfaces of both themes.
  for (const color of COLOR_PALETTE) {
    it(`keeps text in ${color.key} readable in light and dark`, () => {
      const [, light, dark] = /^light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)$/.exec(
        paletteTextColor(color.key),
      ) ?? ['', '', ''];
      for (const surface of PALETTE_TEXT_SURFACES.light) {
        expect(contrastRatio(light, surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      }
      for (const surface of PALETTE_TEXT_SURFACES.dark) {
        expect(contrastRatio(dark, surface)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      }
    });
  }

  // Spec §7: text over a palette color (the blocks of the quick entry, a selected chip) keeps AA.
  for (const color of COLOR_PALETTE) {
    it(`keeps text over ${color.key} readable in light and dark`, () => {
      const [light, dark] = lightDarkSides(paletteOnColorText(color.key));
      expect(contrastRatio(light, color.light)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastRatio(dark, color.dark)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    });
  }

  // Spec §7: the amount of the quick entry is large text, so 3:1 is enough.
  for (const color of COLOR_PALETTE) {
    it(`keeps large text in ${color.key} readable in light and dark`, () => {
      const [light, dark] = lightDarkSides(paletteLargeTextColor(color.key));
      for (const surface of PALETTE_TEXT_SURFACES.light) {
        expect(contrastRatio(light, surface)).toBeGreaterThanOrEqual(MIN_LARGE_TEXT_CONTRAST);
      }
      for (const surface of PALETTE_TEXT_SURFACES.dark) {
        expect(contrastRatio(dark, surface)).toBeGreaterThanOrEqual(MIN_LARGE_TEXT_CONTRAST);
      }
    });
  }

  it('lets large text keep more of the color than normal text', () => {
    // Green (700) reaches 3:1 as it is; orange (700) takes the dark orange, not the neutral fallback.
    expect(lightDarkSides(paletteLargeTextColor('green'))[0]).toBe('#388e3c');
    expect(lightDarkSides(paletteLargeTextColor('orange'))[0]).toBe('#e65100');
    expect(lightDarkSides(paletteTextColor('orange'))[0]).toBe('#1a1c20');
  });

  it('picks white text over dark colors and dark or black text over the rest', () => {
    expect(readableTextForeground('#1a237e')).toBe(WHITE);
    expect(readableTextForeground('#fff59d')).toBe(PALETTE_DARK_FOREGROUND);
    // A mid tone where neither white nor the dark foreground reach 4.5:1.
    expect(readableTextForeground('#7c7c7c')).toBe('#000000');
  });

  it('gives an accent whose text pairs keep AA', () => {
    for (const color of COLOR_PALETTE) {
      const accent = paletteAccent(color.key);
      const [textLight, textDark] = lightDarkSides(accent.text);
      const [onLight, onDark] = lightDarkSides(accent.onText);
      expect(contrastRatio(onLight, textLight)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(contrastRatio(onDark, textDark)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      expect(accent.color).toBe(paletteColor(color.key));
      expect(accent.text).toBe(paletteTextColor(color.key));
    }
  });

  it('keeps the color of the text when it already reads, and deepens it when it does not', () => {
    // Blue dark (900) reads in light; yellow (700) needs the dark yellow, or the fallback.
    expect(paletteTextColor('blue-dark').startsWith('light-dark(#0d47a1,')).toBe(true);
    expect(paletteTextColor('yellow')).not.toContain('#fbc02d,');
  });

  it('picks a dark icon only where white falls short', () => {
    expect(readableForeground('#1a237e')).toBe(WHITE);
    expect(readableForeground('#fff59d')).toBe(PALETTE_DARK_FOREGROUND);
  });

  it('applies the variant of the active theme, for the color and its icon', () => {
    expect(paletteColor('teal')).toBe('light-dark(#00796b, #00897b)');
    expect(paletteColor('yellow-pale')).toBe('light-dark(#fff59d, #fff176)');
    expect(paletteForeground('teal')).toBe(`light-dark(${WHITE}, ${WHITE})`);
    expect(paletteForeground('yellow-pale')).toBe(
      `light-dark(${PALETTE_DARK_FOREGROUND}, ${PALETTE_DARK_FOREGROUND})`,
    );
  });

  // Compatibility: no color stored before the grid falls back or breaks.
  it('resolves every key of the first palette to a color of the grid', () => {
    for (const key of FIRST_PALETTE_KEYS) {
      const resolved = resolveColorKey(key);
      expect(resolved, key).not.toBeNull();
      expect(isColorKey(resolved ?? '')).toBe(true);
    }
  });

  it('maps the retired keys to their nearest color and keeps the tones as they are', () => {
    expect(colorOrFallback('navy')).toBe('indigo-dark');
    expect(colorOrFallback('graphite')).toBe('gray-deep');
    expect(colorOrFallback('teal')).toBe('teal');
    for (const target of Object.values(LEGACY_COLOR_ALIASES)) {
      expect(isColorKey(target)).toBe(true);
    }
    for (const alias of Object.keys(LEGACY_COLOR_ALIASES)) {
      expect(isColorKey(alias)).toBe(false);
    }
  });

  it('falls back for unknown keys', () => {
    expect(isColorKey('teal')).toBe(true);
    expect(isColorKey('#00796b')).toBe(false);
    expect(colorOrFallback('not-a-color')).toBe(FALLBACK_COLOR);
    expect(colorOrFallback(null)).toBe(FALLBACK_COLOR);
    expect(colorOrFallback('toString')).toBe(FALLBACK_COLOR);
  });

  it('names colors in Spanish, with their intensity', () => {
    expect(colorLabel('teal')).toBe('Verde azulado');
    expect(colorLabel('blue-pale')).toBe('Azul pálido');
    expect(colorLabel('red-dark')).toBe('Rojo oscuro');
  });
});
