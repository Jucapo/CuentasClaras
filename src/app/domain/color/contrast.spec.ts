import { contrastRatio, parseHexColor, relativeLuminance } from './contrast';

describe('contrast', () => {
  it('parses #rrggbb colors in any case', () => {
    expect(parseHexColor('#1565C0')).toEqual([21, 101, 192]);
    expect(parseHexColor('#ffffff')).toEqual([255, 255, 255]);
  });

  it('rejects other notations', () => {
    expect(() => parseHexColor('#fff')).toThrow();
    expect(() => parseHexColor('teal')).toThrow();
  });

  it('computes the WCAG relative luminance', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2159, 4);
  });

  it('computes the WCAG contrast ratio in either order', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
    // The WebAIM reference pair: #767676 on white is the lightest gray that passes AA (4.54:1).
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});
