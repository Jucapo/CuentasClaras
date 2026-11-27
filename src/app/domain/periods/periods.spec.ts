import {
  budgetMonths,
  canShiftPeriod,
  monthPeriodRange,
  Period,
  periodContaining,
  periodContains,
  periodRange,
  PeriodSettings,
  periodYear,
  shiftPeriod,
} from './periods';

const calendar: PeriodSettings = { monthStartDay: 1, weekStart: 'monday' };
const from15: PeriodSettings = { monthStartDay: 15, weekStart: 'monday' };
const from28: PeriodSettings = { monthStartDay: 28, weekStart: 'monday' };
const sundayWeeks: PeriodSettings = { monthStartDay: 1, weekStart: 'sunday' };

describe('monthly periods', () => {
  it('are calendar months when months start on the 1st', () => {
    expect(monthPeriodRange('2026-11-01', 1)).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(monthPeriodRange('2026-02-01', 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthPeriodRange('2028-02-01', 1)).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('run from day D to D−1 of the next month and take the name of the month they end in', () => {
    // 28 nov – 27 dic is "Diciembre" (spec §4.5).
    expect(monthPeriodRange('2026-12-01', 28)).toEqual({ start: '2026-11-28', end: '2026-12-27' });
    expect(monthPeriodRange('2026-03-01', 28)).toEqual({ start: '2026-02-28', end: '2026-03-27' });
    expect(monthPeriodRange('2026-03-01', 15)).toEqual({ start: '2026-02-15', end: '2026-03-14' });
    expect(monthPeriodRange('2027-01-01', 28)).toEqual({ start: '2026-12-28', end: '2027-01-27' });
  });

  it('cover every day exactly once', () => {
    for (const day of [1, 2, 15, 27, 28]) {
      for (let month = 1; month <= 12; month++) {
        const current = monthPeriodRange(`2026-${String(month).padStart(2, '0')}-01`, day);
        const next =
          month === 12
            ? monthPeriodRange('2027-01-01', day)
            : monthPeriodRange(`2026-${String(month + 1).padStart(2, '0')}-01`, day);
        const dayAfter = new Date(`${current.end}T00:00:00Z`);
        dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
        expect(next.start).toBe(dayAfter.toISOString().slice(0, 10));
      }
    }
  });
});

describe('periodContaining', () => {
  it('anchors each kind on the first day of its period', () => {
    expect(periodContaining('day', '2026-11-26', calendar)).toEqual({
      kind: 'day',
      anchor: '2026-11-26',
    });
    expect(periodContaining('week', '2026-11-26', calendar)).toEqual({
      kind: 'week',
      anchor: '2026-11-23',
    });
    expect(periodContaining('month', '2026-11-26', calendar)).toEqual({
      kind: 'month',
      anchor: '2026-11-01',
    });
    expect(periodContaining('year', '2026-11-26', calendar)).toEqual({
      kind: 'year',
      anchor: '2026-01-01',
    });
  });

  it('follows the month start day', () => {
    expect(periodContaining('month', '2026-11-27', from28)).toEqual({
      kind: 'month',
      anchor: '2026-10-28',
    });
    expect(periodContaining('month', '2026-11-28', from28)).toEqual({
      kind: 'month',
      anchor: '2026-11-28',
    });
    expect(periodContaining('month', '2026-11-14', from15)).toEqual({
      kind: 'month',
      anchor: '2026-10-15',
    });
  });

  it('follows the first day of the week', () => {
    expect(periodContaining('week', '2026-11-26', sundayWeeks).anchor).toBe('2026-11-22');
    expect(periodContaining('week', '2026-11-22', sundayWeeks).anchor).toBe('2026-11-22');
    expect(periodContaining('week', '2026-11-22', calendar).anchor).toBe('2026-11-16');
    expect(periodContaining('week', '2026-11-23', calendar).anchor).toBe('2026-11-23');
  });

  it('aligns years with the month start day', () => {
    // With D = 28 the 28th of December already belongs to the next year.
    expect(periodContaining('year', '2026-12-28', from28)).toEqual({
      kind: 'year',
      anchor: '2026-12-28',
    });
    expect(periodContaining('year', '2026-12-27', from28)).toEqual({
      kind: 'year',
      anchor: '2025-12-28',
    });
    expect(periodYear('2026-12-28', 28)).toBe(2027);
    expect(periodYear('2026-12-27', 28)).toBe(2026);
  });
});

describe('periodRange', () => {
  it('covers one day', () => {
    expect(periodRange({ kind: 'day', anchor: '2026-11-26' }, calendar)).toEqual({
      start: '2026-11-26',
      end: '2026-11-26',
    });
  });

  it('covers seven days from the first day of the week', () => {
    expect(periodRange({ kind: 'week', anchor: '2026-11-26' }, calendar)).toEqual({
      start: '2026-11-23',
      end: '2026-11-29',
    });
    expect(periodRange({ kind: 'week', anchor: '2026-11-26' }, sundayWeeks)).toEqual({
      start: '2026-11-22',
      end: '2026-11-28',
    });
    expect(periodRange({ kind: 'week', anchor: '2026-12-30' }, calendar)).toEqual({
      start: '2026-12-28',
      end: '2027-01-03',
    });
  });

  it('covers the monthly period of its anchor', () => {
    expect(periodRange({ kind: 'month', anchor: '2026-11-10' }, calendar)).toEqual({
      start: '2026-11-01',
      end: '2026-11-30',
    });
    expect(periodRange({ kind: 'month', anchor: '2026-11-28' }, from28)).toEqual({
      start: '2026-11-28',
      end: '2026-12-27',
    });
    expect(periodRange({ kind: 'month', anchor: '2026-12-20' }, from15)).toEqual({
      start: '2026-12-15',
      end: '2027-01-14',
    });
  });

  it('covers the 12 aligned monthly periods of a year', () => {
    expect(periodRange({ kind: 'year', anchor: '2026-05-05' }, calendar)).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
    expect(periodRange({ kind: 'year', anchor: '2026-05-05' }, from28)).toEqual({
      start: '2025-12-28',
      end: '2026-12-27',
    });
    expect(periodRange({ kind: 'year', anchor: '2026-12-28' }, from28)).toEqual({
      start: '2026-12-28',
      end: '2027-12-27',
    });
  });

  it('is unbounded for "Siempre" and exact for a custom range', () => {
    expect(periodRange({ kind: 'all' }, calendar)).toEqual({ start: null, end: null });
    expect(
      periodRange({ kind: 'custom', start: '2026-11-03', end: '2026-11-17' }, calendar),
    ).toEqual({
      start: '2026-11-03',
      end: '2026-11-17',
    });
  });
});

describe('shiftPeriod', () => {
  const shift = (period: Period, steps: number, settings = calendar) =>
    shiftPeriod(period, steps, settings);

  it('moves days, weeks and months one at a time', () => {
    expect(shift({ kind: 'day', anchor: '2026-12-31' }, 1)).toEqual({
      kind: 'day',
      anchor: '2027-01-01',
    });
    expect(shift({ kind: 'day', anchor: '2026-11-26' }, -1)).toEqual({
      kind: 'day',
      anchor: '2026-11-25',
    });
    expect(shift({ kind: 'week', anchor: '2026-11-23' }, 1)).toEqual({
      kind: 'week',
      anchor: '2026-11-30',
    });
    expect(shift({ kind: 'week', anchor: '2026-11-23' }, -2)).toEqual({
      kind: 'week',
      anchor: '2026-11-09',
    });
    expect(shift({ kind: 'month', anchor: '2026-11-01' }, 1)).toEqual({
      kind: 'month',
      anchor: '2026-12-01',
    });
    expect(shift({ kind: 'month', anchor: '2026-01-01' }, -1)).toEqual({
      kind: 'month',
      anchor: '2025-12-01',
    });
  });

  it('moves monthly periods that do not start on the 1st', () => {
    expect(shift({ kind: 'month', anchor: '2026-11-28' }, 1, from28)).toEqual({
      kind: 'month',
      anchor: '2026-12-28',
    });
    expect(shift({ kind: 'month', anchor: '2026-01-28' }, 1, from28)).toEqual({
      kind: 'month',
      anchor: '2026-02-28',
    });
    expect(shift({ kind: 'month', anchor: '2026-02-28' }, -1, from28)).toEqual({
      kind: 'month',
      anchor: '2026-01-28',
    });
    expect(shift({ kind: 'month', anchor: '2026-12-15' }, 1, from15)).toEqual({
      kind: 'month',
      anchor: '2027-01-15',
    });
  });

  it('moves years and keeps them aligned', () => {
    expect(shift({ kind: 'year', anchor: '2026-01-01' }, 1)).toEqual({
      kind: 'year',
      anchor: '2027-01-01',
    });
    expect(shift({ kind: 'year', anchor: '2025-12-28' }, 1, from28)).toEqual({
      kind: 'year',
      anchor: '2026-12-28',
    });
    expect(shift({ kind: 'year', anchor: '2025-12-28' }, -1, from28)).toEqual({
      kind: 'year',
      anchor: '2024-12-28',
    });
  });

  it('moves a custom range in blocks of its own length', () => {
    expect(shift({ kind: 'custom', start: '2026-11-03', end: '2026-11-17' }, 1)).toEqual({
      kind: 'custom',
      start: '2026-11-18',
      end: '2026-12-02',
    });
    expect(shift({ kind: 'custom', start: '2026-11-03', end: '2026-11-03' }, -1)).toEqual({
      kind: 'custom',
      start: '2026-11-02',
      end: '2026-11-02',
    });
  });

  it('never moves "Siempre"', () => {
    expect(shift({ kind: 'all' }, 1)).toEqual({ kind: 'all' });
    expect(canShiftPeriod({ kind: 'all' })).toBe(false);
    expect(canShiftPeriod({ kind: 'month', anchor: '2026-11-01' })).toBe(true);
  });

  it('goes back to the same period after moving there and back', () => {
    for (const settings of [calendar, from15, from28, sundayWeeks]) {
      for (const kind of ['day', 'week', 'month', 'year'] as const) {
        const period = periodContaining(kind, '2026-11-26', settings);
        expect(shiftPeriod(shiftPeriod(period, 5, settings), -5, settings)).toEqual(period);
      }
    }
  });
});

describe('budgetMonths', () => {
  it('is the month that names a monthly period', () => {
    expect(budgetMonths({ kind: 'month', anchor: '2026-11-10' }, calendar)).toEqual(['2026-11-01']);
    expect(budgetMonths({ kind: 'month', anchor: '2026-11-28' }, from28)).toEqual(['2026-12-01']);
  });

  it('is every month of an aligned year', () => {
    expect(budgetMonths({ kind: 'year', anchor: '2025-12-28' }, from28)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
    ]);
  });

  it('is empty in the other periods', () => {
    expect(budgetMonths({ kind: 'day', anchor: '2026-11-26' }, calendar)).toEqual([]);
    expect(budgetMonths({ kind: 'week', anchor: '2026-11-23' }, calendar)).toEqual([]);
    expect(budgetMonths({ kind: 'all' }, calendar)).toEqual([]);
    expect(
      budgetMonths({ kind: 'custom', start: '2026-11-01', end: '2026-11-30' }, calendar),
    ).toEqual([]);
  });
});

describe('periodContains', () => {
  it('includes both ends and everything for "Siempre"', () => {
    const december: Period = { kind: 'month', anchor: '2026-11-28' };
    expect(periodContains(december, from28, '2026-11-28')).toBe(true);
    expect(periodContains(december, from28, '2026-12-27')).toBe(true);
    expect(periodContains(december, from28, '2026-12-28')).toBe(false);
    expect(periodContains({ kind: 'all' }, calendar, '1999-01-01')).toBe(true);
  });
});
