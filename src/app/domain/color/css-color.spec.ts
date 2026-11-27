import {
  blendColors,
  parseCssColor,
  resolveLightDark,
  stackedOpacity,
  toHexColor,
} from './css-color';

describe('css colors', () => {
  it('picks the side of light-dark() for the scheme and leaves other values alone', () => {
    expect(resolveLightDark('light-dark(#ededf3, #1e2024)', false)).toBe('#ededf3');
    expect(resolveLightDark('light-dark(#ededf3, #1e2024)', true)).toBe('#1e2024');
    expect(resolveLightDark('light-dark(rgb(1, 2, 3), rgb(4, 5, 6))', true)).toBe('rgb(4, 5, 6)');
    expect(resolveLightDark('rgb(1, 2, 3)', true)).toBe('rgb(1, 2, 3)');
  });

  it('reads hex and rgb colors, and nothing else', () => {
    expect(parseCssColor('#abc')).toEqual([170, 187, 204]);
    expect(parseCssColor('#1E4E8C')).toEqual([30, 78, 140]);
    expect(parseCssColor('rgb(237, 237, 243)')).toEqual([237, 237, 243]);
    expect(parseCssColor('rgba(0, 0, 0, 0.32)')).toEqual([0, 0, 0]);
    expect(parseCssColor('rgb(30 32 36)')).toEqual([30, 32, 36]);
    expect(parseCssColor('light-dark(#fff, #000)')).toBeNull();
    expect(parseCssColor('transparent')).toBeNull();
  });

  it('writes #rrggbb', () => {
    expect(toHexColor([0, 15, 255])).toBe('#000fff');
  });

  // The status bar with a sheet open: the bar surface under the scrim (spec §13.2).
  it('blends a translucent color over another', () => {
    expect(blendColors([237, 237, 243], [0, 0, 0], 0.32)).toBe('#a1a1a5');
    expect(blendColors([10, 20, 30], [0, 0, 0], 0)).toBe('#0a141e');
    expect(blendColors([10, 20, 30], [255, 255, 255], 1)).toBe('#ffffff');
  });

  it('stacks the opacity of several scrims', () => {
    expect(stackedOpacity(0.32, 0)).toBe(0);
    expect(stackedOpacity(0.32, 1)).toBeCloseTo(0.32);
    expect(stackedOpacity(0.32, 2)).toBeCloseTo(0.5376);
  });
});
