/** ISO 4217 exponent for currencies without an entry: two decimal places. */
export const DEFAULT_MINOR_UNITS = 2;

// Fixed per currency: amounts are stored in minor units, so the exponent can never change.
const MINOR_UNITS: Readonly<Partial<Record<string, number>>> = { COP: 2, USD: 2, EUR: 2 };

// US$ keeps dollars apart from pesos, which also use "$".
const SYMBOLS: Readonly<Partial<Record<string, string>>> = { COP: '$', USD: 'US$', EUR: '€' };

/** Decimal places of a currency's minor unit (ISO 4217 exponent). */
export function currencyMinorUnits(currency: string): number {
  return MINOR_UNITS[currency] ?? DEFAULT_MINOR_UNITS;
}

/** Symbol shown before amounts of a currency; its code when it has none. */
export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? currency;
}
