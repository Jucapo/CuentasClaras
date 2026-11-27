import { IsoDate } from '../dates/local-date';

/** The items of one day. */
export interface DayGroup<T> {
  readonly date: IsoDate;
  readonly items: readonly T[];
}

/** Groups items by day, keeping the order in which the days and the items arrive. */
export function groupByDay<T>(items: readonly T[], dateOf: (item: T) => IsoDate): DayGroup<T>[] {
  const groups = new Map<IsoDate, T[]>();
  for (const item of items) {
    const date = dateOf(item);
    const day = groups.get(date);
    if (day) {
      day.push(item);
    } else {
      groups.set(date, [item]);
    }
  }
  return [...groups].map(([date, dayItems]) => ({ date, items: dayItems }));
}
