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

function groupThousands(units: number, separator: string): string {
  return String(units).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
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
  return `${negative ? '-' : ''}${groupThousands(units, thousands)}${fractionText}`;
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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const { thousands, decimal } = NUMBER_FORMAT_SEPARATORS[numberFormat];
  let body = text
    // \s also covers the no-break and narrow no-break spaces of pasted amounts.
    .replace(/\s+/g, ' ')
    .replaceAll(currencySymbol(currency), '')
    .replaceAll('$', '')
    .trim();
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

  const exponent = currencyMinorUnits(currency);
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
