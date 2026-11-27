import { addDays, addMonths, daysBetween, IsoDate } from '../dates/local-date';
import { periodMonth } from '../periods/period-month';
import { DateRange, monthPeriodRange, PeriodKind } from '../periods/periods';
import { BoundedRange } from './comparison';

/** Categories stacked with their own color in the chart; the rest goes together in gray (spec §6). */
export const CHART_TOP_CATEGORIES = 3;

/** A category total of a period, as `category_totals` returns it. */
export interface RankableTotal {
  readonly categoryId: string;
  readonly parentId: string | null;
  readonly kind: string;
  readonly amount: number;
}

/** A top-level category with what it got in the period. */
export interface CategoryAmount {
  readonly categoryId: string;
  readonly amount: number;
}

/** The categories of a kind, largest first: the ones the chart colors and the rest. */
export interface CategoryRanking {
  readonly top: readonly CategoryAmount[];
  readonly rest: readonly CategoryAmount[];
}

/**
 * Top-level categories of a kind with something in the period, largest first (ties keep their
 * order), split into the `size` largest and the rest. The chart and the list share it, so both
 * show the categories in the same order (spec §7).
 */
export function rankCategories(
  totals: readonly RankableTotal[],
  kind: string,
  size = CHART_TOP_CATEGORIES,
): CategoryRanking {
  const ranked = totals
    .filter((total) => total.kind === kind && total.parentId === null && total.amount > 0)
    .map((total) => ({ categoryId: total.categoryId, amount: total.amount }))
    .sort((a, b) => b.amount - a.amount);
  return { top: ranked.slice(0, size), rest: ranked.slice(size) };
}

/** What one day added to a top-level category, as `daily_category_totals` returns it. */
export interface DailyAmount {
  readonly date: IsoDate;
  readonly categoryId: string;
  readonly amount: number;
}

/** Whether a bar of the chart is a day or a month of the period. */
export type BucketSize = 'day' | 'month';

/** One bar of the chart: its dates and what each series put in it. */
export interface ChartBucket {
  readonly start: IsoDate;
  readonly end: IsoDate;
  /** One value per top category, in the ranking's order, and the rest last. */
  readonly values: readonly number[];
  readonly total: number;
}

/**
 * Dates the chart covers: the period, or in "Siempre" from the first movement to today (or to the
 * last movement, if it is later).
 */
export function chartRange(
  range: DateRange,
  dates: readonly IsoDate[],
  today: IsoDate,
): BoundedRange {
  const sorted = [...dates].sort();
  const first = sorted.at(0) ?? today;
  const last = sorted.at(-1) ?? today;
  return {
    start: range.start ?? (first < today ? first : today),
    end: range.end ?? (last > today ? last : today),
  };
}

/** Bars by day, or by month of the period in a year, in "Siempre" and in long ranges. */
export function bucketSize(
  kind: PeriodKind,
  range: BoundedRange,
  maxDailyBuckets: number,
): BucketSize {
  if (kind === 'year' || kind === 'all') {
    return 'month';
  }
  return daysBetween(range.start, range.end) + 1 > maxDailyBuckets ? 'month' : 'day';
}

function bucketRanges(
  range: BoundedRange,
  size: BucketSize,
  monthStartDay: number,
): BoundedRange[] {
  if (size === 'day') {
    const days = daysBetween(range.start, range.end) + 1;
    return Array.from({ length: days }, (_, index) => {
      const date = addDays(range.start, index);
      return { start: date, end: date };
    });
  }
  const buckets: BoundedRange[] = [];
  const lastMonth = periodMonth(range.end, monthStartDay);
  for (let month = periodMonth(range.start, monthStartDay); month <= lastMonth;) {
    const { start, end } = monthPeriodRange(month, monthStartDay) as BoundedRange;
    buckets.push({
      start: start > range.start ? start : range.start,
      end: end < range.end ? end : range.end,
    });
    month = addMonths(month, 1);
  }
  return buckets;
}

/**
 * The bars of the chart (spec §6): one per day (or month), with 0 where nothing happened, each
 * stacking the top categories in their order and the rest of them last.
 */
export function chartBuckets(
  rows: readonly DailyAmount[],
  range: BoundedRange,
  size: BucketSize,
  topIds: readonly string[],
  monthStartDay: number,
): ChartBucket[] {
  const ranges = bucketRanges(range, size, monthStartDay);
  const values = ranges.map(() => new Array<number>(topIds.length + 1).fill(0));
  for (const row of rows) {
    const index = ranges.findIndex((bucket) => row.date >= bucket.start && row.date <= bucket.end);
    if (index < 0) {
      continue;
    }
    const series = topIds.indexOf(row.categoryId);
    values[index][series < 0 ? topIds.length : series] += row.amount;
  }
  return ranges.map((bucket, index) => ({
    ...bucket,
    values: values[index],
    total: values[index].reduce((sum, value) => sum + value, 0),
  }));
}

/** Month labels at most on the axis; longer spans skip some. */
const MAX_MONTH_TICKS = 12;

/** Fewest bars between two dates of the axis, so their labels do not overlap. */
const MIN_TICK_GAP = 4;

/**
 * Bars that get a date on the axis: by day, one a week from the start of the period and the last
 * one; by month, every month (or every few in long spans) and the last one. A weekly date too
 * close to the last one gives way to it.
 */
export function chartTicks(count: number, size: BucketSize): number[] {
  if (count === 0) {
    return [];
  }
  const step = size === 'day' ? 7 : Math.max(1, Math.ceil(count / MAX_MONTH_TICKS));
  const ticks: number[] = [];
  for (let index = 0; index < count; index += step) {
    ticks.push(index);
  }
  const last = count - 1;
  if (ticks.at(-1) === last) {
    return ticks;
  }
  if (size === 'day' && ticks.length > 1 && last - (ticks.at(-1) ?? 0) < MIN_TICK_GAP) {
    ticks.pop();
  }
  return [...ticks, last];
}
