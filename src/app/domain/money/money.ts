import { currencyMinorUnits, currencySymbol } from './currencies';
import { MoneyFormatOptions, NUMBER_FORMAT_SEPARATORS, NumberFormat } from './number-format';

/** An amount in minor units of a currency. */
export interface CurrencyAmount {
  readonly currency: string;
  /** Integer, in minor units (e.g. centavos). */
  readonly amount: number;
}

/** Why a typed amount could not be read. */
export type MoneyParseError =
  'invalid' | 'grouping' | 'too_many_decimals' | 'negative' | 'too_large';

/** Result of reading a typed amount: minor units (null when empty) or the reason it failed. */
export type MoneyParseResult =
  | { readonly ok: true; readonly value: number | null }
  | { readonly ok: false; readonly error: MoneyParseError };

/** Digits of an amount as typed: sign, integer digits and, once the separator is typed, decimals. */
export interface TypedAmount {
  readonly negative: boolean;
  readonly integerDigits: string;
  /** Null until the decimal separator is typed; then the decimals typed so far, maybe none. */
  readonly fractionDigits: string | null;
}

/** Text of an amount field and where its caret is. */
export interface AmountEdit {
  readonly text: string;
  readonly caret: number;
}

/** What an edit of an amount field did, read from `InputEvent.inputType`. */
export type AmountEditKind = 'insert' | 'deleteBackward' | 'deleteForward' | 'other';

interface AmountParts {
  readonly negative: boolean;
  readonly units: number;
  readonly fraction: number;
}

function amountParts(minor: number, exponent: number, showDecimals: boolean): AmountParts {
  const factor = 10 ** exponent;
  let absolute = Math.abs(minor);
  if (!showDecimals && exponent > 0) {
    // Rounds half away from zero to whole units; only what is shown changes.
    absolute = Math.floor((absolute + factor / 2) / factor) * factor;
  }
  return {
    negative: minor < 0 && absolute > 0,
    units: Math.floor(absolute / factor),
    fraction: absolute % factor,
  };
}

function groupDigits(digits: string, separator: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

function formatNumber(
  minor: number,
  currency: string,
  numberFormat: NumberFormat,
  decimals: 'always' | 'never' | 'when-needed',
): string {
  const exponent = currencyMinorUnits(currency);
  const { thousands, decimal } = NUMBER_FORMAT_SEPARATORS[numberFormat];
  const { negative, units, fraction } = amountParts(minor, exponent, decimals !== 'never');
  const showFraction =
    exponent > 0 && (decimals === 'always' || (decimals === 'when-needed' && fraction > 0));
  const fractionText = showFraction ? `${decimal}${String(fraction).padStart(exponent, '0')}` : '';
  return `${negative ? '-' : ''}${groupDigits(String(units), thousands)}${fractionText}`;
}

/** An amount for display, e.g. `-$ 1,234,567.90` (spec §4.6). */
export function formatMoney(minor: number, currency: string, options: MoneyFormatOptions): string {
  const number = formatNumber(
    minor,
    currency,
    options.numberFormat,
    options.showDecimals ? 'always' : 'never',
  );
  const sign = number.startsWith('-') ? '-' : '';
  return `${sign}${currencySymbol(currency)} ${number.slice(sign.length)}`;
}

/** An amount for an input field: no symbol, and decimals only when it has them. */
export function formatAmountInput(
  minor: number,
  currency: string,
  numberFormat: NumberFormat,
): string {
  return formatNumber(minor, currency, numberFormat, 'when-needed');
}

/** Digits as they are being typed, grouped in the user's format: `1250000` → `1.250.000`. */
export function formatTypedAmount(amount: TypedAmount, numberFormat: NumberFormat): string {
  const { thousands, decimal } = NUMBER_FORMAT_SEPARATORS[numberFormat];
  const fraction = amount.fractionDigits === null ? '' : `${decimal}${amount.fractionDigits}`;
  return `${amount.negative ? '-' : ''}${groupDigits(amount.integerDigits, thousands)}${fraction}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Reads a number already stripped of symbols into an integer scaled by 10^exponent. */
function parseScaled(
  text: string,
  exponent: number,
  numberFormat: NumberFormat,
  allowNegative: boolean,
): MoneyParseResult {
  const { thousands, decimal } = NUMBER_FORMAT_SEPARATORS[numberFormat];
  // \s also covers the no-break and narrow no-break spaces of pasted amounts.
  let body = text.replace(/\s+/g, ' ').trim();
  if (body === '') {
    return { ok: true, value: null };
  }

  const negative = /^[-−]/.test(body);
  if (negative) {
    body = body.slice(1).trim();
  }
  if (thousands !== ' ') {
    body = body.replaceAll(' ', '');
  }

  const [integerPart, fractionPart = '', ...rest] = body.split(decimal);
  if (rest.length > 0 || !/^[\d., ]*$/.test(integerPart) || !/^\d*$/.test(fractionPart)) {
    return { ok: false, error: 'invalid' };
  }
  if (integerPart === '' && fractionPart === '') {
    return { ok: false, error: 'invalid' };
  }
  const grouped = new RegExp(`^\\d{1,3}(${escapeRegExp(thousands)}\\d{3})*$`);
  if (!/^\d*$/.test(integerPart) && !grouped.test(integerPart)) {
    return { ok: false, error: 'grouping' };
  }

  if (fractionPart.length > exponent) {
    return { ok: false, error: 'too_many_decimals' };
  }
  const digits = `${integerPart.replaceAll(thousands, '')}${fractionPart.padEnd(exponent, '0')}`;
  const value = Number(digits || '0');
  if (!Number.isSafeInteger(value)) {
    return { ok: false, error: 'too_large' };
  }
  if (negative && value > 0 && !allowNegative) {
    return { ok: false, error: 'negative' };
  }
  return { ok: true, value: negative && value > 0 ? -value : value };
}

/**
 * Reads a typed amount into minor units. Separators follow the user's number format and the
 * thousands grouping is checked, so "1,5" is an error with `comma_dot` instead of 15.
 */
export function parseMoney(
  text: string,
  currency: string,
  numberFormat: NumberFormat,
  { allowNegative = false } = {},
): MoneyParseResult {
  const body = text.replaceAll(currencySymbol(currency), '').replaceAll('$', '');
  return parseScaled(body, currencyMinorUnits(currency), numberFormat, allowNegative);
}

/**
 * Reads a typed decimal number that is not money (a rate, a percentage) with up to `decimals`
 * decimals and the same rules as amounts. The value is the number itself, e.g. 4150.25.
 */
export function parseDecimal(
  text: string,
  decimals: number,
  numberFormat: NumberFormat,
): MoneyParseResult {
  const result = parseScaled(text, decimals, numberFormat, false);
  return result.ok && result.value !== null
    ? { ok: true, value: result.value / 10 ** decimals }
    : result;
}

/** A decimal number that is not money, with up to `decimals` decimals and no trailing zeros. */
export function formatDecimal(value: number, decimals: number, numberFormat: NumberFormat): string {
  const { thousands, decimal } = NUMBER_FORMAT_SEPARATORS[numberFormat];
  const [units, fraction = ''] = Math.abs(value).toFixed(decimals).split('.');
  const trimmed = fraction.replace(/0+$/, '');
  const sign = value < 0 && Number(units + trimmed) > 0 ? '-' : '';
  return `${sign}${groupDigits(units, thousands)}${trimmed ? `${decimal}${trimmed}` : ''}`;
}

function readTypedAmount(
  text: string,
  numberFormat: NumberFormat,
  allowNegative: boolean,
): TypedAmount | null {
  const { thousands, decimal } = NUMBER_FORMAT_SEPARATORS[numberFormat];
  // Spaces only mean something where they are the thousands separator.
  let body = thousands === ' ' ? text.replace(/\s/g, ' ') : text.replace(/\s/g, '');
  const negative = /^[-−]/.test(body);
  if (negative) {
    if (!allowNegative) {
      return null;
    }
    body = body.slice(1);
  }
  const [integerPart, ...fractionParts] = body.split(decimal);
  if (fractionParts.length > 1) {
    return null;
  }
  const integerDigits = integerPart.split(thousands).join('');
  const fractionDigits = fractionParts.length === 1 ? fractionParts[0] : null;
  if (!/^\d*$/.test(integerDigits) || (fractionDigits !== null && !/^\d*$/.test(fractionDigits))) {
    return null;
  }
  return { negative, integerDigits: integerDigits.replace(/^0+(?=\d)/, ''), fractionDigits };
}

function isSignificant(char: string, decimal: string): boolean {
  return /\d/.test(char) || char === decimal || char === '-' || char === '−';
}

function countSignificant(text: string, decimal: string): number {
  return [...text].filter((char) => isSignificant(char, decimal)).length;
}

/**
 * Regroups an amount while it is typed (spec §4.6). Thousands separators go in by themselves, the
 * caret stays next to the same digit, and Backspace or Delete over a separator removes the digit
 * beside it. What the user typed is never reinterpreted: a thousands separator typed by hand that
 * leaves the grouping wrong stays, and so does every later edit until the grouping error is fixed.
 * `previous` has the caret at the start of what was selected before the edit.
 */
export function regroupAmountInput(
  previous: AmountEdit,
  next: AmountEdit,
  kind: AmountEditKind,
  currency: string,
  numberFormat: NumberFormat,
  { allowNegative = false } = {},
): AmountEdit {
  const { thousands, decimal } = NUMBER_FORMAT_SEPARATORS[numberFormat];
  const hasGroupingError = (text: string) => {
    const result = parseMoney(text, currency, numberFormat, { allowNegative });
    return !result.ok && result.error === 'grouping';
  };
  if (hasGroupingError(previous.text)) {
    return next;
  }
  if (kind === 'insert') {
    const inserted = next.text.slice(previous.caret, next.caret);
    if (inserted.includes(thousands) && hasGroupingError(next.text)) {
      return next;
    }
  }

  let { text, caret } = next;
  const removedOne =
    (kind === 'deleteBackward' || kind === 'deleteForward') &&
    previous.text.length === text.length + 1 &&
    previous.text.slice(0, caret) + previous.text.slice(caret + 1) === text;
  if (removedOne && previous.text[caret] === thousands) {
    if (kind === 'deleteBackward' && caret > 0) {
      text = text.slice(0, caret - 1) + text.slice(caret);
      caret -= 1;
    } else if (kind === 'deleteForward') {
      text = text.slice(0, caret) + text.slice(caret + 1);
    }
  }

  const typed = readTypedAmount(text, numberFormat, allowNegative);
  if (!typed) {
    return { text, caret };
  }
  const formatted = formatTypedAmount(typed, numberFormat);
  // Counted from the right, so dropped leading zeros and new separators on the left do not matter.
  const significantRight = countSignificant(text.slice(caret), decimal);
  let significantLeft = countSignificant(formatted, decimal) - significantRight;
  let position = 0;
  while (significantLeft > 0 && position < formatted.length) {
    if (isSignificant(formatted[position], decimal)) {
      significantLeft -= 1;
    }
    position += 1;
  }
  return { text: formatted, caret: position };
}

/** Totals per currency; `firstCurrency` (e.g. the space's main currency) leads, then A to Z. */
export function sumByCurrency(
  amounts: readonly CurrencyAmount[],
  firstCurrency?: string,
): CurrencyAmount[] {
  const totals = new Map<string, number>();
  for (const { currency, amount } of amounts) {
    totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }
  return [...totals]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) =>
      a.currency === firstCurrency
        ? -1
        : b.currency === firstCurrency
          ? 1
          : a.currency.localeCompare(b.currency),
    );
}
