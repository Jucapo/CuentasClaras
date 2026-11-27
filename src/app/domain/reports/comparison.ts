import { addDays, daysBetween, IsoDate } from '../dates/local-date';
import { Period, periodRange, PeriodSettings, shiftPeriod } from '../periods/periods';

/** Inclusive dates of the previous period a figure is compared with. */
export interface BoundedRange {
  readonly start: IsoDate;
  readonly end: IsoDate;
}

/** What the current period is compared with (spec §6). */
export interface Comparison {
  readonly range: BoundedRange;
  /** The previous period was cut to the days the current one has run so far. */
  readonly truncated: boolean;
}

/**
 * The previous period to compare with (spec §6): the one before, whole when the current period is
 * over, or up to the same point (the same days run so far) while it is in progress. "Siempre" and
 * periods that have not started have no comparison.
 */
export function comparisonRange(
  period: Period,
  settings: PeriodSettings,
  today: IsoDate,
): Comparison | null {
  const current = periodRange(period, settings);
  if (period.kind === 'all' || current.start === null || current.end === null) {
    return null;
  }
  if (current.start > today) {
    return null;
  }
  const previous = periodRange(shiftPeriod(period, -1, settings), settings);
  if (previous.start === null || previous.end === null) {
    return null;
  }
  if (today >= current.end) {
    return { range: { start: previous.start, end: previous.end }, truncated: false };
  }
  const sameDay = addDays(previous.start, daysBetween(current.start, today));
  const end = sameDay < previous.end ? sameDay : previous.end;
  return { range: { start: previous.start, end }, truncated: end !== previous.end };
}

/** Whether a change is good, bad or neither for the kind it measures. */
export type ChangeTone = 'good' | 'bad' | 'neutral';

/** How a total moved against the previous period. */
export interface TotalChange {
  /** Fraction of the previous total, e.g. 0.12 for 12 % more; negative when it went down. */
  readonly change: number;
  readonly direction: 'up' | 'down' | 'same';
  /** Spending more is bad and receiving more is good. */
  readonly tone: ChangeTone;
}

/** The change of a total against the previous one; null when the previous one is 0. */
export function compareTotals(
  current: number,
  previous: number,
  kind: 'expense' | 'income',
): TotalChange | null {
  if (previous === 0) {
    return null;
  }
  const change = (current - previous) / previous;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'same';
  if (direction === 'same') {
    return { change, direction, tone: 'neutral' };
  }
  const good = (direction === 'up') === (kind === 'income');
  return { change, direction, tone: good ? 'good' : 'bad' };
}

const DIRECTION_MARKS: Readonly<Record<TotalChange['direction'], string>> = {
  up: '▲',
  down: '▼',
  same: '=',
};

/** The note under a total, e.g. "▼ 9 % vs. 28 sep – 26 oct". */
export function comparisonText(change: TotalChange, against: string): string {
  const percent = Math.round(Math.abs(change.change) * 100);
  return `${DIRECTION_MARKS[change.direction]} ${percent} % vs. ${against}`;
}
