import {
  AmountExpression,
  evaluateAmount,
  evaluateExpression,
  expressionFromMinor,
  formatExpression,
  hasOperator,
  KeypadKey,
  pressKey,
} from './amount-expression';

function press(keys: readonly KeypadKey[], exponent = 2, start: AmountExpression = ''): string {
  return keys.reduce((expression, key) => pressKey(expression, key, exponent), start);
}

describe('pressKey', () => {
  it('appends digits and thousands', () => {
    expect(press(['2', '5', '000'])).toBe('25000');
    expect(press(['1', '0', '0'])).toBe('100');
  });

  it('does not start with zeros', () => {
    expect(press(['0', '0', '7'])).toBe('7');
    expect(press(['000'])).toBe('');
    expect(press(['0', '000'])).toBe('0');
  });

  it('adds one decimal point, with a zero when nothing was typed', () => {
    expect(press(['decimal', '5'])).toBe('0.5');
    expect(press(['1', 'decimal', 'decimal', '2'])).toBe('1.2');
    expect(press(['1', 'decimal', '2', '5', '9'])).toBe('1.25');
    expect(press(['1', 'decimal', '000'])).toBe('1.');
  });

  it('ignores the decimal point in currencies without decimals', () => {
    expect(press(['1', 'decimal', '5'], 0)).toBe('15');
  });

  it('adds and subtracts, replacing an operator typed right after another', () => {
    expect(press(['1', '2', 'plus', '3'])).toBe('12+3');
    expect(press(['1', '2', 'plus', 'minus', '3'])).toBe('12-3');
    expect(press(['plus', '5'])).toBe('5');
    expect(press(['1', 'decimal', 'plus'])).toBe('1+');
    expect(press(['1', 'plus', 'decimal', '5'])).toBe('1+0.5');
  });

  it('multiplies and divides, replacing an operator typed right after another', () => {
    expect(press(['1', '2', 'times', '3'])).toBe('12*3');
    expect(press(['1', '2', 'divide', '4'])).toBe('12/4');
    expect(press(['1', '2', 'plus', 'times', '3'])).toBe('12*3');
    expect(press(['times', '5'])).toBe('5');
  });

  it('erases the last key', () => {
    expect(press(['1', '2', 'plus', 'backspace', 'backspace'])).toBe('1');
    expect(press(['backspace'])).toBe('');
  });

  it('stops at 13 integer digits per term', () => {
    const long = press(Array.from({ length: 14 }, () => '9' as const));
    expect(long).toHaveLength(13);
    expect(press(['000'], 2, '9999999999')).toBe('9999999999000');
    expect(press(['000'], 2, '99999999999')).toBe('99999999999');
  });
});

describe('evaluateExpression', () => {
  it('adds and subtracts terms in minor units', () => {
    expect(evaluateExpression('12000+3500', 2)).toBe(1_550_000);
    expect(evaluateExpression('100.5-0.25', 2)).toBe(10_025);
    expect(evaluateExpression('12+', 2)).toBe(1_200);
    expect(evaluateExpression('5-10', 2)).toBe(-500);
    expect(evaluateExpression('', 2)).toBe(0);
    expect(evaluateExpression('1234', 0)).toBe(1_234);
  });
});

describe('evaluateAmount', () => {
  it('multiplies and divides before adding and subtracting', () => {
    expect(evaluateAmount('12000*2', 2)).toEqual({ ok: true, value: 2_400_000 });
    expect(evaluateAmount('2+3*4', 2)).toEqual({ ok: true, value: 1_400 });
    expect(evaluateAmount('10-2*3', 2)).toEqual({ ok: true, value: 400 });
    expect(evaluateAmount('2*3+4*5', 0)).toEqual({ ok: true, value: 26 });
    expect(evaluateAmount('600000/3*2', 2)).toEqual({ ok: true, value: 40_000_000 });
  });

  it('works with decimals exactly, without float errors', () => {
    expect(evaluateAmount('0.1*3', 2)).toEqual({ ok: true, value: 30 });
    expect(evaluateAmount('19.99*3', 2)).toEqual({ ok: true, value: 5_997 });
    expect(evaluateAmount('1.5/0.5', 2)).toEqual({ ok: true, value: 300 });
  });

  it('rounds the result to the minor unit, away from zero', () => {
    expect(evaluateAmount('100/3', 2)).toEqual({ ok: true, value: 3_333 });
    expect(evaluateAmount('200/3', 2)).toEqual({ ok: true, value: 6_667 });
    expect(evaluateAmount('5/2', 0)).toEqual({ ok: true, value: 3 });
    expect(evaluateAmount('0-5/2', 0)).toEqual({ ok: true, value: -3 });
  });

  it('says when it divides by zero instead of giving an amount', () => {
    expect(evaluateAmount('10/0', 2)).toEqual({ ok: false, error: 'division_by_zero' });
    expect(evaluateAmount('10+5/0*3', 2)).toEqual({ ok: false, error: 'division_by_zero' });
    expect(evaluateExpression('10/0', 2)).toBe(0);
  });

  it('ignores an operator still waiting for its number', () => {
    expect(evaluateAmount('10/', 2)).toEqual({ ok: true, value: 1_000 });
    expect(evaluateAmount('10*', 2)).toEqual({ ok: true, value: 1_000 });
  });

  it('refuses results beyond safe integers', () => {
    expect(evaluateAmount('9999999999999*9999999999999', 2)).toEqual({
      ok: false,
      error: 'too_large',
    });
  });
});

describe('formatExpression', () => {
  it('follows the number format of the user', () => {
    expect(formatExpression('12000+3500.5', 'dot_comma')).toBe('12.000 + 3.500,5');
    expect(formatExpression('1250000', 'comma_dot')).toBe('1,250,000');
    expect(formatExpression('12000-', 'dot_comma')).toBe('12.000 −');
    expect(formatExpression('0.', 'comma_dot')).toBe('0.');
    expect(formatExpression('', 'comma_dot')).toBe('');
    expect(formatExpression('12000*2/3', 'dot_comma')).toBe('12.000 × 2 ÷ 3');
  });

  it('knows when there is something to work out', () => {
    expect(hasOperator('12+3')).toBe(true);
    expect(hasOperator('12*3')).toBe(true);
    expect(hasOperator('12/3')).toBe(true);
    expect(hasOperator('12.5')).toBe(false);
  });
});

describe('expressionFromMinor', () => {
  it('shows an existing amount without trailing zeros', () => {
    expect(expressionFromMinor(1_550_000, 2)).toBe('15500');
    expect(expressionFromMinor(1_550_050, 2)).toBe('15500.5');
    expect(expressionFromMinor(5, 2)).toBe('0.05');
    expect(expressionFromMinor(1_234, 0)).toBe('1234');
  });

  it('round-trips with evaluateExpression', () => {
    for (const minor of [1, 99, 100, 123_456, 1_550_050]) {
      expect(evaluateExpression(expressionFromMinor(minor, 2), 2)).toBe(minor);
    }
  });
});
