import { addDays, dateParts, IsoDate, Weekday, weekdayOf } from '../dates/local-date';
import { periodMonth } from './period-month';
import { DateRange, Period, periodRange, PeriodSettings, periodYear } from './periods';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

const MONTH_ABBREVIATIONS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

const WEEKDAY_NAMES: Readonly<Record<Weekday, string>> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

/** Name of a month (1 to 12), e.g. "Octubre". */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1];
}

/** Titles of the periods without a date of their own. */
export const PERIOD_TITLES = { all: 'Siempre', custom: 'Personalizado' } as const;

function shortDate(date: IsoDate, withYear: boolean): string {
  const { year, month, day } = dateParts(date);
  const text = `${day} ${MONTH_ABBREVIATIONS[month - 1]}`;
  return withYear ? `${text} ${year}` : text;
}

/**
 * A range for display, e.g. "28 nov – 27 dic" (spec §4.5). Years show when they are not the one of
 * `today`, or when the range crosses into another year. Empty when unbounded.
 */
export function rangeText(range: DateRange, today: IsoDate): string {
  if (range.start === null || range.end === null) {
    return '';
  }
  const startYear = dateParts(range.start).year;
  const endYear = dateParts(range.end).year;
  const currentYear = dateParts(today).year;
  if (range.start === range.end) {
    return shortDate(range.start, startYear !== currentYear);
  }
  if (startYear !== endYear) {
    return `${shortDate(range.start, true)} – ${shortDate(range.end, true)}`;
  }
  const withYear = startYear !== currentYear;
  return `${shortDate(range.start, false)} – ${shortDate(range.end, withYear)}`;
}

/**
 * Name of a period (spec §4.5): "Hoy", "Ayer", "Jueves 26 nov", "Semana del 23 nov", "Diciembre"
 * (with the year when it is not the current one), "2026", "Siempre" or "Personalizado".
 */
export function periodTitle(period: Period, settings: PeriodSettings, today: IsoDate): string {
  switch (period.kind) {
    case 'all':
      return PERIOD_TITLES.all;
    case 'custom':
      return PERIOD_TITLES.custom;
    case 'day': {
      if (period.anchor === today) {
        return 'Hoy';
      }
      if (period.anchor === addDays(today, -1)) {
        return 'Ayer';
      }
      const withYear = dateParts(period.anchor).year !== dateParts(today).year;
      return `${WEEKDAY_NAMES[weekdayOf(period.anchor)]} ${shortDate(period.anchor, withYear)}`;
    }
    case 'week': {
      const start = periodRange(period, settings).start as IsoDate;
      return `Semana del ${shortDate(start, dateParts(start).year !== dateParts(today).year)}`;
    }
    case 'month': {
      const month = dateParts(periodMonth(period.anchor, settings.monthStartDay));
      const currentYear = periodYear(today, settings.monthStartDay);
      const name = MONTH_NAMES[month.month - 1];
      return month.year === currentYear ? name : `${name} ${month.year}`;
    }
    case 'year':
      return String(periodYear(period.anchor, settings.monthStartDay));
  }
}

/** Range shown next to the title; empty for "Siempre". */
export function periodRangeText(period: Period, settings: PeriodSettings, today: IsoDate): string {
  return rangeText(periodRange(period, settings), today);
}

/** Long form of a date for a list header, e.g. "Jueves 26 nov". */
export function dayTitle(date: IsoDate, today: IsoDate): string {
  return periodTitle(
    { kind: 'day', anchor: date },
    { monthStartDay: 1, weekStart: 'monday' },
    today,
  );
}
