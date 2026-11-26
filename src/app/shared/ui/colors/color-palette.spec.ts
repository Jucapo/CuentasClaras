import { contrastRatio, MIN_GRAPHIC_CONTRAST } from '../../../domain/color/contrast';
import {
  COLOR_PALETTE,
  colorLabel,
  colorOrFallback,
  FALLBACK_COLOR,
  isColorKey,
  paletteColor,
} from './color-palette';

const WHITE = '#ffffff';

describe('color palette', () => {
  it('has about thirty colors with unique keys', () => {
    expect(COLOR_PALETTE.length).toBeGreaterThanOrEqual(28);
    expect(new Set(COLOR_PALETTE.map((color) => color.key)).size).toBe(COLOR_PALETTE.length);
  });

  it('uses keys the database accepts, never hex values', () => {
    for (const color of COLOR_PALETTE) {
      expect(color.key).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(color.key.length).toBeLessThanOrEqual(32);
    }
  });

  // Spec §13.3: a white icon must stay visible on every color, in both themes.
  for (const color of COLOR_PALETTE) {
    it(`keeps a white icon readable on ${color.key} in light and dark`, () => {
      expect(contrastRatio(WHITE, color.light)).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST);
      expect(contrastRatio(WHITE, color.dark)).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST);
    });
  }

  it('applies the variant of the active theme', () => {
    expect(paletteColor('teal')).toBe('light-dark(#00796b, #00897b)');
  });

  it('falls back for unknown keys', () => {
    expect(isColorKey('teal')).toBe(true);
    expect(isColorKey('#00796b')).toBe(false);
    expect(colorOrFallback('not-a-color')).toBe(FALLBACK_COLOR);
    expect(colorOrFallback(null)).toBe(FALLBACK_COLOR);
  });

  it('names colors in Spanish', () => {
    expect(colorLabel('teal')).toBe('Verde azulado');
  });
});
