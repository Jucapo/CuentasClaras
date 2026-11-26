import { currencyMinorUnits, currencySymbol } from './currencies';
import { formatAmountInput, formatMoney, parseMoney, sumByCurrency } from './money';
import { MoneyFormatOptions } from './number-format';

const COMMA_DOT: MoneyFormatOptions = { numberFormat: 'comma_dot', showDecimals: true };
const DOT_COMMA: MoneyFormatOptions = { numberFormat: 'dot_comma', showDecimals: true };
const SPACE_COMMA: MoneyFormatOptions = { numberFormat: 'space_comma', showDecimals: true };

describe('currencies', () => {
  it('knows the exponent of the supported currencies and defaults to two', () => {
    expect(currencyMinorUnits('COP')).toBe(2);
    expect(currencyMinorUnits('USD')).toBe(2);
    expect(currencyMinorUnits('XYZ')).toBe(2);
  });

  it('tells dollars apart from pesos', () => {
    expect(currencySymbol('COP')).toBe('$');
    expect(currencySymbol('USD')).toBe('US$');
    expect(currencySymbol('EUR')).toBe('€');
    expect(currencySymbol('MXN')).toBe('MXN');
  });
});

describe('formatMoney', () => {
  it('uses the 1Money format by default', () => {
    expect(formatMoney(-123456790, 'COP', COMMA_DOT)).toBe('-$ 1,234,567.90');
  });

  it('follows the separators of each number format', () => {
    expect(formatMoney(123456790, 'COP', DOT_COMMA)).toBe('$ 1.234.567,90');
    expect(formatMoney(123456790, 'COP', SPACE_COMMA)).toBe('$ 1 234 567,90');
  });

  it('pads small amounts and zero', () => {
    expect(formatMoney(5, 'COP', COMMA_DOT)).toBe('$ 0.05');
    expect(formatMoney(0, 'COP', COMMA_DOT)).toBe('$ 0.00');
    expect(formatMoney(100000, 'COP', COMMA_DOT)).toBe('$ 1,000.00');
  });

  it('uses the symbol of the currency', () => {
    expect(formatMoney(100000, 'USD', COMMA_DOT)).toBe('US$ 1,000.00');
    expect(formatMoney(-100000, 'EUR', DOT_COMMA)).toBe('-€ 1.000,00');
  });

  it('rounds half away from zero when decimals are hidden', () => {
    const noDecimals = { numberFormat: 'comma_dot', showDecimals: false } as const;
    expect(formatMoney(150, 'COP', noDecimals)).toBe('$ 2');
    expect(formatMoney(149, 'COP', noDecimals)).toBe('$ 1');
    expect(formatMoney(-150, 'COP', noDecimals)).toBe('-$ 2');
    expect(formatMoney(-123456790, 'COP', noDecimals)).toBe('-$ 1,234,568');
  });

  it('never shows a negative zero', () => {
    expect(formatMoney(-49, 'COP', { numberFormat: 'comma_dot', showDecimals: false })).toBe('$ 0');
  });
});

describe('formatAmountInput', () => {
  it('shows decimals only when the amount has them', () => {
    expect(formatAmountInput(150000, 'COP', 'comma_dot')).toBe('1,500');
    expect(formatAmountInput(150050, 'COP', 'comma_dot')).toBe('1,500.50');
    expect(formatAmountInput(150050, 'COP', 'dot_comma')).toBe('1.500,50');
    expect(formatAmountInput(-150000, 'COP', 'space_comma')).toBe('-1 500');
  });
});

describe('parseMoney', () => {
  it('reads amounts into minor units', () => {
    expect(parseMoney('1,234.56', 'COP', 'comma_dot')).toEqual({ ok: true, value: 123456 });
    expect(parseMoney('1234.5', 'COP', 'comma_dot')).toEqual({ ok: true, value: 123450 });
    expect(parseMoney('1234', 'COP', 'comma_dot')).toEqual({ ok: true, value: 123400 });
    expect(parseMoney('.5', 'COP', 'comma_dot')).toEqual({ ok: true, value: 50 });
  });

  it('follows the separators of the user', () => {
    expect(parseMoney('1.500', 'COP', 'dot_comma')).toEqual({ ok: true, value: 150000 });
    expect(parseMoney('1.500,5', 'COP', 'dot_comma')).toEqual({ ok: true, value: 150050 });
    expect(parseMoney('1 500,25', 'COP', 'space_comma')).toEqual({ ok: true, value: 150025 });
    expect(parseMoney('1 500,25', 'COP', 'space_comma')).toEqual({ ok: true, value: 150025 });
    expect(parseMoney('1500,25', 'COP', 'space_comma')).toEqual({ ok: true, value: 150025 });
  });

  it('ignores the currency symbol and surrounding spaces', () => {
    expect(parseMoney('  $ 1,000 ', 'COP', 'comma_dot')).toEqual({ ok: true, value: 100000 });
    expect(parseMoney('US$ 10.50', 'USD', 'comma_dot')).toEqual({ ok: true, value: 1050 });
  });

  it('treats an empty field as no amount', () => {
    expect(parseMoney('', 'COP', 'comma_dot')).toEqual({ ok: true, value: null });
    expect(parseMoney('  $ ', 'COP', 'comma_dot')).toEqual({ ok: true, value: null });
  });

  it('checks the thousands grouping instead of guessing', () => {
    expect(parseMoney('1,5', 'COP', 'comma_dot')).toEqual({ ok: false, error: 'grouping' });
    expect(parseMoney('12,34,567', 'COP', 'comma_dot')).toEqual({ ok: false, error: 'grouping' });
    expect(parseMoney('1.5', 'COP', 'dot_comma')).toEqual({ ok: false, error: 'grouping' });
    expect(parseMoney('1500.50', 'COP', 'dot_comma')).toEqual({ ok: false, error: 'grouping' });
  });

  it('allows as many decimals as the currency has', () => {
    expect(parseMoney('1.234', 'COP', 'comma_dot')).toEqual({
      ok: false,
      error: 'too_many_decimals',
    });
    expect(parseMoney('1,234,567.891', 'COP', 'comma_dot')).toEqual({
      ok: false,
      error: 'too_many_decimals',
    });
  });

  it('rejects anything that is not an amount', () => {
    expect(parseMoney('abc', 'COP', 'comma_dot')).toEqual({ ok: false, error: 'invalid' });
    expect(parseMoney('1..5', 'COP', 'comma_dot')).toEqual({ ok: false, error: 'invalid' });
    expect(parseMoney('-', 'COP', 'comma_dot')).toEqual({ ok: false, error: 'invalid' });
  });

  it('accepts negative amounts only when allowed', () => {
    expect(parseMoney('-5', 'COP', 'comma_dot')).toEqual({ ok: false, error: 'negative' });
    expect(parseMoney('-5', 'COP', 'comma_dot', { allowNegative: true })).toEqual({
      ok: true,
      value: -500,
    });
    expect(parseMoney('−5', 'COP', 'comma_dot', { allowNegative: true })).toEqual({
      ok: true,
      value: -500,
    });
    expect(parseMoney('-0', 'COP', 'comma_dot')).toEqual({ ok: true, value: 0 });
  });

  it('rejects amounts beyond safe integers', () => {
    expect(parseMoney('999999999999999999', 'COP', 'comma_dot')).toEqual({
      ok: false,
      error: 'too_large',
    });
  });

  it('round-trips what formatAmountInput shows', () => {
    for (const format of ['comma_dot', 'dot_comma', 'space_comma'] as const) {
      for (const minor of [0, 5, 150000, 150050, 123456789]) {
        expect(parseMoney(formatAmountInput(minor, 'COP', format), 'COP', format)).toEqual({
          ok: true,
          value: minor,
        });
      }
    }
  });
});

describe('sumByCurrency', () => {
  it('adds amounts per currency, main currency first', () => {
    expect(
      sumByCurrency(
        [
          { currency: 'USD', amount: 1000 },
          { currency: 'COP', amount: 500 },
          { currency: 'EUR', amount: 7 },
          { currency: 'COP', amount: -200 },
        ],
        'COP',
      ),
    ).toEqual([
      { currency: 'COP', amount: 300 },
      { currency: 'EUR', amount: 7 },
      { currency: 'USD', amount: 1000 },
    ]);
  });

  it('returns nothing for no amounts', () => {
    expect(sumByCurrency([])).toEqual([]);
  });
});
