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
  | 'times'
  | 'divide'
  | 'backspace';

/**
 * What was typed on the keypad: terms joined by `+`, `-`, `*` and `/`, e.g. `12000+3500.5*2`, always
 * with `.` as decimal point. Only the display follows the user's number format.
 */
export type AmountExpression = string;

/** Why an expression gives no amount. */
export type AmountExpressionError = 'division_by_zero' | 'too_large';

/** The amount of an expression in minor units, or why there is none. */
export type AmountEvaluation =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly error: AmountExpressionError };

type Operator = '+' | '-' | '*' | '/';

const OPERATORS: Readonly<Partial<Record<KeypadKey, Operator>>> = {
  plus: '+',
  minus: '-',
  times: '*',
  divide: '/',
};

/** How each operator is shown. */
const OPERATOR_SYMBOLS: Readonly<Record<Operator, string>> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

// 13 integer digits keep minor units with two decimals within safe integers.
const MAX_INTEGER_DIGITS = 13;

interface Term extends TypedAmount {
  readonly operator: Operator | null;
}

function isOperator(text: string): text is Operator {
  return text === '+' || text === '-' || text === '*' || text === '/';
}

function termsOf(expression: AmountExpression): Term[] {
  const terms: Term[] = [];
  let operator: Term['operator'] = null;
  for (const text of expression.split(/([+\-*/])/)) {
    if (isOperator(text)) {
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
  return expression.split(/[+\-*/]/).at(-1) ?? '';
}

/** Whether an expression has more than one term, so its result differs from what is shown. */
export function hasOperator(expression: AmountExpression): boolean {
  return /[+\-*/]/.test(expression);
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
  const operator = OPERATORS[key];
  if (operator) {
    const base = expression.replace(/\.$/, '').replace(/[+\-*/]$/, '');
    return base === '' ? '' : `${base}${operator}`;
  }
  switch (key) {
    case 'backspace':
      return expression.slice(0, -1);
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

/** An exact fraction, to multiply and divide money without float errors. */
interface Fraction {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

function add(first: Fraction, second: Fraction, sign: bigint): Fraction {
  return {
    numerator: first.numerator * second.denominator + sign * second.numerator * first.denominator,
    denominator: first.denominator * second.denominator,
  };
}

/** Division rounded half away from zero; `denominator` is positive. */
function roundedDivision(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const twice = (remainder < 0n ? -remainder : remainder) * 2n;
  if (twice < denominator) {
    return quotient;
  }
  return quotient + (numerator < 0n ? -1n : 1n);
}

/**
 * Minor units of an expression, with the usual precedence (× and ÷ before + and −), computed exactly
 * and rounded to the minor unit away from zero. A trailing operator still being typed is ignored;
 * dividing by zero, or a result beyond safe integers, gives the reason instead of an amount.
 */
export function evaluateAmount(expression: AmountExpression, exponent: number): AmountEvaluation {
  const scale = 10n ** BigInt(exponent);
  const terms = termsOf(expression);
  // The last term after an operator, while it is still empty, is not there yet.
  const last = terms.at(-1);
  if (last && last.operator !== null && last.integerDigits === '' && last.fractionDigits === null) {
    terms.pop();
  }
  let sum: Fraction = { numerator: 0n, denominator: 1n };
  let product: Fraction | null = null;
  let sign = 1n;
  for (const term of terms) {
    const digits = `${term.integerDigits}${(term.fractionDigits ?? '').padEnd(exponent, '0')}`;
    // In units of the currency: minor units over the scale.
    const value: Fraction = { numerator: BigInt(digits || '0'), denominator: scale };
    if (term.operator === '*' && product) {
      product = {
        numerator: product.numerator * value.numerator,
        denominator: product.denominator * value.denominator,
      };
    } else if (term.operator === '/' && product) {
      if (value.numerator === 0n) {
        return { ok: false, error: 'division_by_zero' };
      }
      product = {
        numerator: product.numerator * value.denominator,
        denominator: product.denominator * value.numerator,
      };
    } else {
      if (product) {
        sum = add(sum, product, sign);
      }
      sign = term.operator === '-' ? -1n : 1n;
      product = value;
    }
  }
  if (product) {
    sum = add(sum, product, sign);
  }
  const minor = roundedDivision(sum.numerator * scale, sum.denominator);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER) || minor < -BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ok: false, error: 'too_large' };
  }
  return { ok: true, value: Number(minor) };
}

/** Minor units of an expression; 0 when it is empty or gives no amount. Can be negative. */
export function evaluateExpression(expression: AmountExpression, exponent: number): number {
  const evaluation = evaluateAmount(expression, exponent);
  return evaluation.ok ? evaluation.value : 0;
}

/** An expression for display in the user's format, e.g. `12.000 + 3.500 × 2`. */
export function formatExpression(expression: AmountExpression, numberFormat: NumberFormat): string {
  return termsOf(expression)
    .map((term) => {
      const text = formatTypedAmount(term, numberFormat);
      if (term.operator === null) {
        return text;
      }
      return `${OPERATOR_SYMBOLS[term.operator]} ${text}`.trimEnd();
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
