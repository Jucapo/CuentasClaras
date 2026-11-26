import { formatMoney } from '../../domain/money/money';
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

/** Icon and color of a space; the same as the database defaults of `spaces`. */
export const SPACE_APPEARANCE_DEFAULTS = { icon: 'home', color: 'green' } as const;

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

/** Sample amount (minor units) used to preview a number format: -$ 1,234,567.90. */
const NUMBER_FORMAT_SAMPLE = -123456790;

/** Sample amount, e.g. "-$ 1,234,567.90", formatted the way the app would show it. */
export function numberFormatExample(format: NumberFormat, showDecimals: boolean): string {
  return formatMoney(NUMBER_FORMAT_SAMPLE, SPACE_DEFAULTS.mainCurrency, {
    numberFormat: format,
    showDecimals,
  });
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
