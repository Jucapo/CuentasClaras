import { currencyLabel, monthStartDayHint, numberFormatExample } from './space.constants';

describe('space constants', () => {
  it('previews each number format with and without decimals', () => {
    expect(numberFormatExample('comma_dot', true)).toBe('-$ 1,234,567.90');
    expect(numberFormatExample('dot_comma', true)).toBe('-$ 1.234.567,90');
    expect(numberFormatExample('space_comma', false)).toBe('-$ 1 234 567');
  });

  it('names currencies in Spanish with their code', () => {
    expect(currencyLabel('COP')).toBe('Peso colombiano (COP)');
    expect(currencyLabel('USD')).toBe('Dólar estadounidense (USD)');
  });

  it('explains the monthly period of a start day', () => {
    expect(monthStartDayHint(1)).toBe('Cada mes va del 1 al último día del mes.');
    expect(monthStartDayHint(28)).toBe('Cada mes va del 28 al 27 del mes siguiente.');
  });
});
