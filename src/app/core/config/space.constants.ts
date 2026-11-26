import { NumberFormat, ThemePreference, Weekday } from '../spaces/space.models';

/** Theme choices in display order (spec §13.2). */
export const THEME_OPTIONS: readonly { readonly value: ThemePreference; readonly label: string }[] =
  [
    { value: 'system', label: 'Según el sistema' },
    { value: 'light', label: 'Claro' },
    { value: 'dark', label: 'Oscuro' },
  ];

/** Longest space name; matches the `spaces.name` check in the database. */
export const SPACE_NAME_MAX_LENGTH = 60;

/** Allowed first days of the month; matches the `space_settings.month_start_day` check. */
export const MONTH_START_DAY_RANGE = { min: 1, max: 28 } as const;

/** Currencies offered as the main currency of a space (ISO 4217). */
export const SUPPORTED_CURRENCIES = ['COP', 'USD', 'EUR'] as const;

/** Defaults of a new space; the same as the database defaults. */
export const SPACE_DEFAULTS = {
  mainCurrency: 'COP',
  monthStartDay: 1,
  weekStart: 'monday',
} as const satisfies { mainCurrency: string; monthStartDay: number; weekStart: Weekday };

/** Defaults of the number format preference; the same as the database defaults. */
export const NUMBER_FORMAT_DEFAULTS = {
  numberFormat: 'comma_dot',
  showDecimals: true,
} as const satisfies { numberFormat: NumberFormat; showDecimals: boolean };

/** Weekdays in display order, with their Spanish names. */
export const WEEKDAYS: readonly { readonly value: Weekday; readonly label: string }[] = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

/** Thousands and decimal separators of each number format. */
export const NUMBER_FORMAT_SEPARATORS: Readonly<
  Record<NumberFormat, { readonly thousands: string; readonly decimal: string }>
> = {
  comma_dot: { thousands: ',', decimal: '.' },
  dot_comma: { thousands: '.', decimal: ',' },
  space_comma: { thousands: ' ', decimal: ',' },
};

/** Number formats in display order. */
export const NUMBER_FORMATS: readonly NumberFormat[] = ['comma_dot', 'dot_comma', 'space_comma'];

/** Sample amount, e.g. "-$ 1,234,567.90", used to preview a number format. */
export function numberFormatExample(format: NumberFormat, showDecimals: boolean): string {
  const { thousands, decimal } = NUMBER_FORMAT_SEPARATORS[format];
  const integer = ['1', '234', '567'].join(thousands);
  return `-$ ${integer}${showDecimals ? `${decimal}90` : ''}`;
}

/** "Peso colombiano (COP)": the Spanish currency name followed by its code. */
export function currencyLabel(code: string): string {
  const name = new Intl.DisplayNames(['es'], { type: 'currency' }).of(code) ?? code;
  return `${name.charAt(0).toLocaleUpperCase('es')}${name.slice(1)} (${code})`;
}

/** Explains the monthly period that a first day of the month produces. */
export function monthStartDayHint(day: number): string {
  return day === MONTH_START_DAY_RANGE.min
    ? 'Cada mes va del 1 al último día del mes.'
    : `Cada mes va del ${day} al ${day - 1} del mes siguiente.`;
}
