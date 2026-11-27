import { AVERAGE_MONTH_DAYS, percentText, periodAverages, savingsRate, shareOf } from './averages';

describe('periodAverages', () => {
  it('divides a finished month by its days, and its month figure is the total', () => {
    // 27 may – 26 jun: 31 days, like the 1Money reference.
    expect(
      periodAverages(
        12_116_631_00,
        { start: '2026-05-27', end: '2026-06-26' },
        'month',
        '2026-11-27',
        null,
      ),
    ).toEqual({
      perDay: 39_085_906,
      perWeek: 273_601_345,
      perMonth: 12_116_631_00,
      monthIsTotal: true,
    });
  });

  it('counts only the days run so far while the period is in progress', () => {
    expect(
      periodAverages(
        270_000,
        { start: '2026-11-01', end: '2026-11-30' },
        'month',
        '2026-11-27',
        null,
      ),
    ).toMatchObject({ perDay: 10_000, perWeek: 70_000, perMonth: 270_000 });
  });

  it('uses an average month outside a month period', () => {
    const averages = periodAverages(
      7_000,
      { start: '2026-11-23', end: '2026-11-29' },
      'week',
      '2026-11-30',
      null,
    );
    expect(averages).toEqual({
      perDay: 1_000,
      perWeek: 7_000,
      perMonth: Math.round(1_000 * AVERAGE_MONTH_DAYS),
      monthIsTotal: false,
    });
  });

  it('starts "Siempre" at the first movement and runs to today', () => {
    expect(
      periodAverages(100_000, { start: null, end: null }, 'all', '2026-11-10', '2026-11-01'),
    ).toMatchObject({ perDay: 10_000 });
    expect(periodAverages(0, { start: null, end: null }, 'all', '2026-11-10', null)).toBeNull();
  });

  it('rounds to minor units away from zero and has nothing before the period starts', () => {
    expect(
      periodAverages(5, { start: '2026-11-01', end: '2026-11-02' }, 'custom', '2026-11-30', null),
    ).toMatchObject({ perDay: 3 });
    expect(
      periodAverages(100, { start: '2026-12-01', end: '2026-12-31' }, 'month', '2026-11-27', null),
    ).toBeNull();
  });
});

describe('savingsRate', () => {
  it('is the balance over the incomes, negative when spending went over', () => {
    expect(savingsRate(1_000, 380)).toBe(0.62);
    expect(savingsRate(1_000, 1_350)).toBe(-0.35);
  });

  it('does not exist without incomes', () => {
    expect(savingsRate(0, 500)).toBeNull();
  });
});

describe('shareOf and percentText', () => {
  it('give the share of a part as a whole percentage', () => {
    expect(percentText(shareOf(29, 100))).toBe('29 %');
    expect(percentText(shareOf(1, 3))).toBe('33 %');
    expect(shareOf(5, 0)).toBe(0);
  });
});
