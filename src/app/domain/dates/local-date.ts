/** A local calendar date as `YYYY-MM-DD`, never converted between time zones (spec §11). */
export type IsoDate = string;

/** Today's local date, e.g. `2026-11-26`. */
export function todayIsoDate(now: Date = new Date()): IsoDate {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
