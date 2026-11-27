import { daysBetween, IsoDate } from '../dates/local-date';
import { DateRange, PeriodKind } from '../periods/periods';

/** Days of an average month: a Gregorian year (365.2425 days) over 12. */
export const AVERAGE_MONTH_DAYS = 365.2425 / 12;

/** Averages of a total in the period (spec §6), in minor units. */
export interface PeriodAverages {
  readonly perDay: number;
  readonly perWeek: number;
  /** The total itself in a month period; otherwise an average month. */
  readonly perMonth: number;
  /** Whether `perMonth` is the total of a month period rather than an average. */
  readonly monthIsTotal: boolean;
}

function roundAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/**
 * Averages per day, week and month (spec §6). Days run from the start of the period (in "Siempre",
 * from the first movement, `firstDate`) to its end, or to today while it is in progress. In a month
 * period the month figure is its total. Null when no day has run yet.
 */
export function periodAverages(
  total: number,
  range: DateRange,
  kind: PeriodKind,
  today: IsoDate,
  firstDate: IsoDate | null,
): PeriodAverages | null {
  const start = range.start ?? firstDate;
  if (start === null) {
    return null;
  }
  const end = range.end === null || range.end > today ? today : range.end;
  const days = daysBetween(start, end) + 1;
  if (days < 1) {
    return null;
  }
  const perDay = total / days;
  return {
    perDay: roundAwayFromZero(perDay),
    perWeek: roundAwayFromZero(perDay * 7),
    perMonth: kind === 'month' ? total : roundAwayFromZero(perDay * AVERAGE_MONTH_DAYS),
    monthIsTotal: kind === 'month',
  };
}

/** Balance over incomes (spec §7): what was saved of what came in; null without incomes. */
export function savingsRate(income: number, expense: number): number | null {
  return income > 0 ? (income - expense) / income : null;
}

/** Share of a part in a total, as a fraction; 0 when the total is 0. */
export function shareOf(part: number, total: number): number {
  return total === 0 ? 0 : part / total;
}

/** A fraction as a whole percentage, e.g. "38 %". */
export function percentText(fraction: number): string {
  return `${Math.round(fraction * 100)} %`;
}
