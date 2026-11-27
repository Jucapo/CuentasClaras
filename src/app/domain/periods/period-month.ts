import { IsoDate } from '../dates/local-date';

/**
 * First day (`YYYY-MM-01`) of the month that names the monthly period containing `date` (spec
 * §4.5): a period runs from day D to day D−1 of the next month and takes the name of the month it
 * ends in, so with D = 28 the 28th of November already belongs to December.
 */
export function periodMonth(date: IsoDate, monthStartDay: number): IsoDate {
  const [year, month, day] = date.split('-').map(Number);
  let periodYear = year;
  let periodMonthNumber = month;
  if (monthStartDay > 1 && day >= monthStartDay) {
    periodMonthNumber += 1;
    if (periodMonthNumber > 12) {
      periodMonthNumber = 1;
      periodYear += 1;
    }
  }
  return `${periodYear}-${String(periodMonthNumber).padStart(2, '0')}-01`;
}
