/** Thousands/decimal separators: comma_dot = 1,234.56 · dot_comma = 1.234,56 · space_comma = 1 234,56. */
export type NumberFormat = 'comma_dot' | 'dot_comma' | 'space_comma';

/** How a user wants amounts shown (spec §4.6). */
export interface MoneyFormatOptions {
  readonly numberFormat: NumberFormat;
  readonly showDecimals: boolean;
}

/** Number formats in display order. */
export const NUMBER_FORMATS: readonly NumberFormat[] = ['comma_dot', 'dot_comma', 'space_comma'];

/** Thousands and decimal separators of each number format. */
export const NUMBER_FORMAT_SEPARATORS: Readonly<
  Record<NumberFormat, { readonly thousands: string; readonly decimal: string }>
> = {
  comma_dot: { thousands: ',', decimal: '.' },
  dot_comma: { thousands: '.', decimal: ',' },
  space_comma: { thousands: ' ', decimal: ',' },
};

/** The default of 1Money: `-$ 1,234,567.90` (spec §4.6). */
export const DEFAULT_MONEY_FORMAT: MoneyFormatOptions = {
  numberFormat: 'comma_dot',
  showDecimals: true,
};
