/** A local calendar date as `YYYY-MM-DD`, never converted between time zones (spec §11). */
export type IsoDate = string;

/** Days of the week from Monday; the names match the `weekday` enum of the database. */
export const WEEKDAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/** A day of the week. */
export type Weekday = (typeof WEEKDAY_ORDER)[number];

/** Year, month (1–12) and day of a date. */
export interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const MS_PER_DAY = 86_400_000;

/** Today's local date, e.g. `2026-11-26`. */
export function todayIsoDate(now: Date = new Date()): IsoDate {
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Whether a string is a real `YYYY-MM-DD` date. */
export function isIsoDate(value: string): value is IsoDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** The `YYYY-MM-DD` of a year, month (1–12) and day that exist. */
export function isoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Year, month and day of a date. */
export function dateParts(date: IsoDate): DateParts {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

// Calendar arithmetic runs in UTC, where days are always 24 hours long.
function toUtc(date: IsoDate): number {
  const { year, month, day } = dateParts(date);
  return Date.UTC(year, month - 1, day);
}

function fromUtc(time: number): IsoDate {
  const date = new Date(time);
  return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** The date `days` after (or before, if negative) `date`. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * MS_PER_DAY);
}

/** The same day `months` later or earlier, kept within the month: 31 jan + 1 month is 28/29 feb. */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const { year, month, day } = dateParts(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  return isoDate(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

/** Number of days in a month (1–12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Days from `start` to `end`: 0 for the same day, negative when `end` comes first. */
export function daysBetween(start: IsoDate, end: IsoDate): number {
  return Math.round((toUtc(end) - toUtc(start)) / MS_PER_DAY);
}

/** Day of the week of a date. */
export function weekdayOf(date: IsoDate): Weekday {
  // getUTCDay counts from Sunday (0); WEEKDAY_ORDER starts on Monday.
  return WEEKDAY_ORDER[(new Date(toUtc(date)).getUTCDay() + 6) % 7];
}
