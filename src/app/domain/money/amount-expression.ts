import { formatTypedAmount, TypedAmount } from './money';
import { NumberFormat } from './number-format';

/** Keys of the quick-entry keypad (spec §7). */
export type KeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '000'
  | 'decimal'
  | 'plus'
  | 'minus'
  | 'backspace';

/**
 * What was typed on the keypad: terms added or subtracted, e.g. `12000+3500.5-200`, always with `.`
 * as decimal point. Only the display follows the user's number format.
 */
export type AmountExpression = string;

// 13 integer digits keep minor units with two decimals within safe integers.
const MAX_INTEGER_DIGITS = 13;

interface Term extends TypedAmount {
  readonly operator: '+' | '-' | null;
}

function termsOf(expression: AmountExpression): Term[] {
  const terms: Term[] = [];
  let operator: Term['operator'] = null;
  for (const text of expression.split(/([+-])/)) {
    if (text === '+' || text === '-') {
      operator = text;
      continue;
    }
    const [integerDigits, fractionDigits] = text.split('.');
    terms.push({
      operator,
      negative: false,
      integerDigits,
      fractionDigits: text.includes('.') ? fractionDigits : null,
    });
  }
  return terms;
}

function currentTerm(expression: AmountExpression): string {
  return expression.split(/[+-]/).at(-1) ?? '';
}

/** Whether an expression has more than one term, so its result differs from what is shown. */
export function hasOperator(expression: AmountExpression): boolean {
  return /[+-]/.test(expression);
}

/**
 * The expression after pressing a key. Keys that make no sense are ignored: a second decimal point,
 * more decimals than the currency has (`exponent`), a leading operator or one right after another
 * (it replaces the previous one), and leading zeros.
 */
export function pressKey(
  expression: AmountExpression,
  key: KeypadKey,
  exponent: number,
): AmountExpression {
  const term = currentTerm(expression);
  switch (key) {
    case 'backspace':
      return expression.slice(0, -1);
    case 'plus':
    case 'minus': {
      const base = expression.replace(/\.$/, '').replace(/[+-]$/, '');
      return base === '' ? '' : `${base}${key === 'plus' ? '+' : '-'}`;
    }
    case 'decimal':
      if (exponent === 0 || term.includes('.')) {
        return expression;
      }
      return `${expression}${term === '' ? '0.' : '.'}`;
    default: {
      if (term.includes('.')) {
        const decimals = term.split('.')[1].length;
        return key !== '000' && decimals < exponent ? `${expression}${key}` : expression;
      }
      if (key === '000' && (term === '' || term === '0')) {
        return expression;
      }
      if (term === '0') {
        return key === '0' ? expression : `${expression.slice(0, -1)}${key}`;
      }
      return term.length + key.length > MAX_INTEGER_DIGITS ? expression : `${expression}${key}`;
    }
  }
}

/** Minor units of an expression; 0 when it is empty. Can be zero or negative. */
export function evaluateExpression(expression: AmountExpression, exponent: number): number {
  return termsOf(expression).reduce((total, term) => {
    const units = Number(term.integerDigits || '0') * 10 ** exponent;
    const fraction = Number((term.fractionDigits ?? '').padEnd(exponent, '0') || '0');
    return total + (term.operator === '-' ? -1 : 1) * (units + fraction);
  }, 0);
}

/** An expression for display in the user's format, e.g. `12.000 + 3.500`. */
export function formatExpression(expression: AmountExpression, numberFormat: NumberFormat): string {
  return termsOf(expression)
    .map((term) => {
      const text = formatTypedAmount(term, numberFormat);
      if (term.operator === null) {
        return text;
      }
      return `${term.operator === '+' ? '+' : '−'} ${text}`.trimEnd();
    })
    .join(' ');
}

/** The expression that shows an existing amount, for editing: 1550050 → `15500.5`. */
export function expressionFromMinor(minor: number, exponent: number): AmountExpression {
  const factor = 10 ** exponent;
  const units = Math.floor(Math.abs(minor) / factor);
  const fraction = String(Math.abs(minor) % factor)
    .padStart(exponent, '0')
    .replace(/0+$/, '');
  return fraction ? `${units}.${fraction}` : String(units);
}
