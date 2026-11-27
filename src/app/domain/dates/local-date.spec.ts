import {
  addDays,
  addMonths,
  dateParts,
  daysBetween,
  daysInMonth,
  isIsoDate,
  isoDate,
  todayIsoDate,
  weekdayOf,
} from './local-date';

describe('local dates', () => {
  it('uses the local calendar day, not UTC', () => {
    // 23:30 local time stays on the same day even where UTC is already tomorrow.
    expect(todayIsoDate(new Date(2026, 10, 26, 23, 30))).toBe('2026-11-26');
    expect(todayIsoDate(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
  });

  it('recognizes real YYYY-MM-DD dates only', () => {
    expect(isIsoDate('2026-11-26')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('26/11/2026')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });

  it('builds and splits dates', () => {
    expect(isoDate(2026, 3, 7)).toBe('2026-03-07');
    expect(dateParts('2026-03-07')).toEqual({ year: 2026, month: 3, day: 7 });
  });

  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    // Daylight saving changes do not shift calendar dates.
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
  });

  it('adds months keeping the day within the month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonths('2026-03-31', -13)).toBe('2025-02-28');
    expect(addMonths('2026-05-10', 0)).toBe('2026-05-10');
  });

  it('knows the length of each month', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('counts the days between two dates', () => {
    expect(daysBetween('2026-11-28', '2026-12-27')).toBe(29);
    expect(daysBetween('2026-11-26', '2026-11-26')).toBe(0);
    expect(daysBetween('2027-01-01', '2026-12-31')).toBe(-1);
  });

  it('finds the day of the week', () => {
    expect(weekdayOf('2026-11-26')).toBe('thursday');
    expect(weekdayOf('2026-11-23')).toBe('monday');
    expect(weekdayOf('2026-11-29')).toBe('sunday');
  });
});
