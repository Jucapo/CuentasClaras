import {
  addDays,
  addMonths,
  dateParts,
  daysBetween,
  IsoDate,
  isoDate,
  Weekday,
  WEEKDAY_ORDER,
  weekdayOf,
} from '../dates/local-date';
import { periodMonth } from './period-month';

/** Kinds of period of the global selector (spec §4.5). */
export type PeriodKind = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';

/** Kinds that repeat around a date and move with the arrows one at a time. */
export type AnchoredPeriodKind = 'day' | 'week' | 'month' | 'year';

/** A day, week, month or year, kept as the first day of the period it covers. */
export interface AnchoredPeriod {
  readonly kind: AnchoredPeriodKind;
  readonly anchor: IsoDate;
}

/** A period of the global selector. */
export type Period =
  | AnchoredPeriod
  | { readonly kind: 'all' }
  | { readonly kind: 'custom'; readonly start: IsoDate; readonly end: IsoDate };

/** Period settings of a space (spec §4.5). */
export interface PeriodSettings {
  /** 1–28: a month runs from this day to the day before it in the next month. */
  readonly monthStartDay: number;
  readonly weekStart: Weekday;
}

/** Inclusive dates of a period; null means unbounded. */
export interface DateRange {
  readonly start: IsoDate | null;
  readonly end: IsoDate | null;
}

/** First day of the monthly period named by `month` (`YYYY-MM-01`): with D = 28, 28 nov for Dec. */
export function monthPeriodStart(month: IsoDate, monthStartDay: number): IsoDate {
  if (monthStartDay === 1) {
    return month;
  }
  const previous = dateParts(addMonths(month, -1));
  return isoDate(previous.year, previous.month, monthStartDay);
}

/** Inclusive range of the monthly period named by `month`. */
export function monthPeriodRange(month: IsoDate, monthStartDay: number): DateRange {
  const start = monthPeriodStart(month, monthStartDay);
  return { start, end: addDays(addMonths(start, 1), -1) };
}

/** Year (aligned to the month start day) of the period that contains `date`. */
export function periodYear(date: IsoDate, monthStartDay: number): number {
  return dateParts(periodMonth(date, monthStartDay)).year;
}

function weekStartOf(date: IsoDate, weekStart: Weekday): IsoDate {
  const offset =
    (WEEKDAY_ORDER.indexOf(weekdayOf(date)) - WEEKDAY_ORDER.indexOf(weekStart) + 7) % 7;
  return addDays(date, -offset);
}

/** The period of a kind that contains `date`. */
export function periodContaining(
  kind: AnchoredPeriodKind,
  date: IsoDate,
  settings: PeriodSettings,
): AnchoredPeriod {
  switch (kind) {
    case 'day':
      return { kind, anchor: date };
    case 'week':
      return { kind, anchor: weekStartOf(date, settings.weekStart) };
    case 'month':
      return {
        kind,
        anchor: monthPeriodStart(periodMonth(date, settings.monthStartDay), settings.monthStartDay),
      };
    case 'year': {
      const year = periodYear(date, settings.monthStartDay);
      return { kind, anchor: monthPeriodStart(isoDate(year, 1, 1), settings.monthStartDay) };
    }
  }
}

/** Inclusive dates a period covers. A year is the 12 monthly periods named after its months. */
export function periodRange(period: Period, settings: PeriodSettings): DateRange {
  switch (period.kind) {
    case 'all':
      return { start: null, end: null };
    case 'custom':
      return { start: period.start, end: period.end };
    case 'day':
      return { start: period.anchor, end: period.anchor };
    case 'week': {
      const start = weekStartOf(period.anchor, settings.weekStart);
      return { start, end: addDays(start, 6) };
    }
    case 'month':
      return monthPeriodRange(
        periodMonth(period.anchor, settings.monthStartDay),
        settings.monthStartDay,
      );
    case 'year': {
      const year = periodYear(period.anchor, settings.monthStartDay);
      return {
        start: monthPeriodStart(isoDate(year, 1, 1), settings.monthStartDay),
        end: monthPeriodRange(isoDate(year, 12, 1), settings.monthStartDay).end,
      };
    }
  }
}

/** Whether the arrows can move a period: all of them except "Siempre". */
export function canShiftPeriod(period: Period): boolean {
  return period.kind !== 'all';
}

/**
 * The period `steps` places away (negative goes back). A custom range moves in blocks of its own
 * length; "Siempre" stays.
 */
export function shiftPeriod(period: Period, steps: number, settings: PeriodSettings): Period {
  switch (period.kind) {
    case 'all':
      return period;
    case 'custom': {
      const length = daysBetween(period.start, period.end) + 1;
      return {
        kind: 'custom',
        start: addDays(period.start, length * steps),
        end: addDays(period.end, length * steps),
      };
    }
    case 'day':
      return { kind: 'day', anchor: addDays(period.anchor, steps) };
    case 'week':
      return periodContaining('week', addDays(period.anchor, 7 * steps), settings);
    case 'month': {
      const month = addMonths(periodMonth(period.anchor, settings.monthStartDay), steps);
      return { kind: 'month', anchor: monthPeriodStart(month, settings.monthStartDay) };
    }
    case 'year': {
      const year = periodYear(period.anchor, settings.monthStartDay) + steps;
      return {
        kind: 'year',
        anchor: monthPeriodStart(isoDate(year, 1, 1), settings.monthStartDay),
      };
    }
  }
}

/**
 * Months (`YYYY-MM-01`) whose budgets apply to a period (spec §4.7): its own in a month, the 12 of
 * a year, and none in the other periods.
 */
export function budgetMonths(period: Period, settings: PeriodSettings): IsoDate[] {
  if (period.kind === 'month') {
    return [periodMonth(period.anchor, settings.monthStartDay)];
  }
  if (period.kind === 'year') {
    const year = periodYear(period.anchor, settings.monthStartDay);
    return Array.from({ length: 12 }, (_, index) => isoDate(year, index + 1, 1));
  }
  return [];
}

/** Whether a period contains a date. */
export function periodContains(period: Period, settings: PeriodSettings, date: IsoDate): boolean {
  const { start, end } = periodRange(period, settings);
  return (start === null || date >= start) && (end === null || date <= end);
}
