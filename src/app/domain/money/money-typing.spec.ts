import {
  AmountEditKind,
  formatDecimal,
  formatTypedAmount,
  parseDecimal,
  regroupAmountInput,
} from './money';
import { NumberFormat } from './number-format';

/** Edits `before` (caret marked with |) into `after` and returns the result with its caret. */
function type(
  before: string,
  after: string,
  kind: AmountEditKind = 'insert',
  numberFormat: NumberFormat = 'comma_dot',
  allowNegative = false,
): string {
  const previousCaret = before.indexOf('|');
  const nextCaret = after.indexOf('|');
  const result = regroupAmountInput(
    { text: before.replace('|', ''), caret: previousCaret },
    { text: after.replace('|', ''), caret: nextCaret },
    kind,
    'COP',
    numberFormat,
    { allowNegative },
  );
  return `${result.text.slice(0, result.caret)}|${result.text.slice(result.caret)}`;
}

describe('formatTypedAmount', () => {
  it('groups the digits typed so far in each number format', () => {
    const amount = { negative: false, integerDigits: '1250000', fractionDigits: null };
    expect(formatTypedAmount(amount, 'dot_comma')).toBe('1.250.000');
    expect(formatTypedAmount(amount, 'comma_dot')).toBe('1,250,000');
    expect(formatTypedAmount(amount, 'space_comma')).toBe('1 250 000');
  });

  it('keeps a decimal separator that was just typed and the decimals as typed', () => {
    expect(
      formatTypedAmount(
        { negative: false, integerDigits: '1234', fractionDigits: '' },
        'comma_dot',
      ),
    ).toBe('1,234.');
    expect(
      formatTypedAmount(
        { negative: true, integerDigits: '1234', fractionDigits: '5' },
        'dot_comma',
      ),
    ).toBe('-1.234,5');
    expect(
      formatTypedAmount({ negative: false, integerDigits: '', fractionDigits: '5' }, 'comma_dot'),
    ).toBe('.5');
  });
});

describe('regroupAmountInput', () => {
  it('adds the thousands separators while typing at the end', () => {
    expect(type('123|', '1234|')).toBe('1,234|');
    expect(type('1,234|', '1,2345|')).toBe('12,345|');
    expect(type('125.000|', '125.0000|', 'insert', 'dot_comma')).toBe('1.250.000|');
    expect(type('123 456|', '123 4567|', 'insert', 'space_comma')).toBe('1 234 567|');
  });

  it('keeps the caret next to the same digit when typing in the middle', () => {
    expect(type('1|,234', '19|,234')).toBe('19|,234');
    expect(type('123|,456', '1237|,456')).toBe('1,237|,456');
    expect(type('|1,234', '9|1,234')).toBe('9|1,234');
  });

  it('removes the digit beside a separator on Backspace or Delete', () => {
    expect(type('1,|234', '1|234', 'deleteBackward')).toBe('|234');
    expect(type('1|,234', '1|234', 'deleteForward')).toBe('1|34');
    expect(type('12,345|', '12,34|', 'deleteBackward')).toBe('1,234|');
  });

  it('keeps the decimal separator and the decimals', () => {
    expect(type('1,234|', '1,234.|')).toBe('1,234.|');
    expect(type('1,234.|', '1,234.5|')).toBe('1,234.5|');
    expect(type('1.234|', '1.234,|', 'insert', 'dot_comma')).toBe('1.234,|');
    // Too many decimals stay as typed so the field shows its error.
    expect(type('1,234.56|', '1,234.567|')).toBe('1,234.567|');
  });

  it('never reinterprets a thousands separator typed by hand that leaves the grouping wrong', () => {
    // In 1,234.56 typing "1,5" is an error, not 15 (spec §4.6).
    expect(type('1|', '1,|')).toBe('1,|');
    expect(type('1,|', '1,5|')).toBe('1,5|');
    expect(type('1.|', '1.5|', 'insert', 'dot_comma')).toBe('1.5|');
  });

  it('regroups again once the grouping error is fixed', () => {
    expect(type('1,23|', '1,234|')).toBe('1,234|');
    expect(type('1,234|', '1,2345|')).toBe('12,345|');
  });

  it('regroups pasted amounts that are valid or ungrouped', () => {
    expect(type('|', '1,234,567.89|')).toBe('1,234,567.89|');
    expect(type('|', '1234567|')).toBe('1,234,567|');
    expect(type('|', '1 234 567|')).toBe('1,234,567|');
  });

  it('accepts a minus sign only when negatives are allowed', () => {
    expect(type('|', '-|', 'insert', 'comma_dot', true)).toBe('-|');
    expect(type('-123|', '-1234|', 'insert', 'comma_dot', true)).toBe('-1,234|');
    expect(type('|', '-1234|')).toBe('-1234|');
  });

  it('drops leading zeros but keeps a zero before the decimals', () => {
    expect(type('0|', '07|')).toBe('7|');
    expect(type('0|', '0.|')).toBe('0.|');
    expect(type('|', '0007|')).toBe('7|');
  });

  it('leaves anything that is not an amount as it is', () => {
    expect(type('12|', '12a|')).toBe('12a|');
    expect(type('1.5|', '1.5.|')).toBe('1.5.|');
  });

  it('replaces a selection', () => {
    expect(type('|1,234', '9|', 'insert')).toBe('9|');
  });
});

describe('parseDecimal', () => {
  it('reads numbers that are not money with the separators of the user', () => {
    expect(parseDecimal('4,150.25', 6, 'comma_dot')).toEqual({ ok: true, value: 4150.25 });
    expect(parseDecimal('4.150,25', 6, 'dot_comma')).toEqual({ ok: true, value: 4150.25 });
    expect(parseDecimal('0,000241', 6, 'dot_comma')).toEqual({ ok: true, value: 0.000241 });
    expect(parseDecimal('', 6, 'comma_dot')).toEqual({ ok: true, value: null });
  });

  it('applies the same rules as amounts', () => {
    expect(parseDecimal('1,5', 6, 'comma_dot')).toEqual({ ok: false, error: 'grouping' });
    expect(parseDecimal('1.2345678', 6, 'comma_dot')).toEqual({
      ok: false,
      error: 'too_many_decimals',
    });
    expect(parseDecimal('-1', 6, 'comma_dot')).toEqual({ ok: false, error: 'negative' });
  });
});

describe('formatDecimal', () => {
  it('shows only the decimals it needs', () => {
    expect(formatDecimal(4150.25, 6, 'comma_dot')).toBe('4,150.25');
    expect(formatDecimal(4150.25, 6, 'dot_comma')).toBe('4.150,25');
    expect(formatDecimal(0.000241, 6, 'dot_comma')).toBe('0,000241');
    expect(formatDecimal(4000, 6, 'comma_dot')).toBe('4,000');
    expect(formatDecimal(1.5, 2, 'space_comma')).toBe('1,5');
  });

  it('round-trips with parseDecimal', () => {
    for (const value of [4150.25, 0.000241, 1, 1234567.5]) {
      const text = formatDecimal(value, 6, 'dot_comma');
      expect(parseDecimal(text, 6, 'dot_comma')).toEqual({ ok: true, value });
    }
  });
});
