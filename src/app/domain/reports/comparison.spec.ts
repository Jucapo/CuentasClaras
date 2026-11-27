import { periodContaining, PeriodSettings } from '../periods/periods';
import { compareTotals, comparisonRange, comparisonText } from './comparison';

const calendar: PeriodSettings = { monthStartDay: 1, weekStart: 'monday' };
const from27: PeriodSettings = { monthStartDay: 27, weekStart: 'monday' };
const from28: PeriodSettings = { monthStartDay: 28, weekStart: 'monday' };

describe('comparisonRange', () => {
  it('compares a month in progress with the previous one up to the same point', () => {
    const period = periodContaining('month', '2026-11-27', calendar);
    expect(comparisonRange(period, calendar, '2026-11-27')).toEqual({
      range: { start: '2026-10-01', end: '2026-10-27' },
      truncated: true,
    });
  });

  it('compares a finished month with the whole previous one', () => {
    const period = periodContaining('month', '2026-10-15', calendar);
    expect(comparisonRange(period, calendar, '2026-11-27')).toEqual({
      range: { start: '2026-09-01', end: '2026-09-30' },
      truncated: false,
    });
  });

  it('counts the days run so far when months start on the 27th or the 28th', () => {
    // 27 nov – 26 dic on its first day: one day of 27 oct – 26 nov.
    expect(
      comparisonRange(periodContaining('month', '2026-11-27', from27), from27, '2026-11-27'),
    ).toEqual({ range: { start: '2026-10-27', end: '2026-10-27' }, truncated: true });
    // 28 oct – 27 nov after 14 days: 28 sep – 11 oct.
    expect(
      comparisonRange(periodContaining('month', '2026-11-10', from28), from28, '2026-11-10'),
    ).toEqual({ range: { start: '2026-09-28', end: '2026-10-11' }, truncated: true });
    // On its last day the period is over: the whole previous one.
    expect(
      comparisonRange(periodContaining('month', '2026-11-27', from28), from28, '2026-11-27'),
    ).toEqual({ range: { start: '2026-09-28', end: '2026-10-27' }, truncated: false });
  });

  it('never goes past the end of a shorter previous month', () => {
    // 30 days of March against a February of 28.
    expect(
      comparisonRange(periodContaining('month', '2026-03-30', calendar), calendar, '2026-03-30'),
    ).toEqual({ range: { start: '2026-02-01', end: '2026-02-28' }, truncated: false });
    // Day 30 of October against a September of 30: the whole of it.
    expect(
      comparisonRange(periodContaining('month', '2026-10-30', calendar), calendar, '2026-10-30'),
    ).toEqual({ range: { start: '2026-09-01', end: '2026-09-30' }, truncated: false });
    // Day 31 of October is its last one.
    expect(
      comparisonRange(periodContaining('month', '2026-10-31', calendar), calendar, '2026-10-31'),
    ).toEqual({ range: { start: '2026-09-01', end: '2026-09-30' }, truncated: false });
  });

  it('compares a week in progress with the same days of the previous week', () => {
    // Thursday 26 nov: monday to thursday of the week before.
    const period = periodContaining('week', '2026-11-26', calendar);
    expect(comparisonRange(period, calendar, '2026-11-26')).toEqual({
      range: { start: '2026-11-16', end: '2026-11-19' },
      truncated: true,
    });
  });

  it('compares a year in progress with the previous one up to the same day', () => {
    expect(
      comparisonRange(periodContaining('year', '2026-11-27', calendar), calendar, '2026-11-27'),
    ).toEqual({ range: { start: '2025-01-01', end: '2025-11-27' }, truncated: true });
    // A year of 28 dic – 27 dic.
    expect(
      comparisonRange(periodContaining('year', '2026-11-27', from28), from28, '2026-11-27'),
    ).toEqual({ range: { start: '2024-12-28', end: '2025-11-27' }, truncated: true });
  });

  it('compares a day with the day before, and a custom range with the block before it', () => {
    expect(comparisonRange({ kind: 'day', anchor: '2026-11-27' }, calendar, '2026-11-27')).toEqual({
      range: { start: '2026-11-26', end: '2026-11-26' },
      truncated: false,
    });
    expect(
      comparisonRange(
        { kind: 'custom', start: '2026-11-20', end: '2026-11-29' },
        calendar,
        '2026-11-22',
      ),
    ).toEqual({ range: { start: '2026-11-10', end: '2026-11-12' }, truncated: true });
  });

  it('has nothing to compare for "Siempre" or a period that has not started', () => {
    expect(comparisonRange({ kind: 'all' }, calendar, '2026-11-27')).toBeNull();
    expect(
      comparisonRange(periodContaining('month', '2026-12-15', calendar), calendar, '2026-11-27'),
    ).toBeNull();
  });
});

describe('compareTotals', () => {
  it('reads more spending as bad news and more income as good news', () => {
    expect(compareTotals(110, 100, 'expense')).toEqual({
      change: 0.1,
      direction: 'up',
      tone: 'bad',
    });
    expect(compareTotals(90, 100, 'expense')).toMatchObject({ direction: 'down', tone: 'good' });
    expect(compareTotals(110, 100, 'income')).toMatchObject({ direction: 'up', tone: 'good' });
    expect(compareTotals(90, 100, 'income')).toMatchObject({ direction: 'down', tone: 'bad' });
    expect(compareTotals(100, 100, 'income')).toMatchObject({ direction: 'same', tone: 'neutral' });
  });

  it('has no change when the previous total is 0', () => {
    expect(compareTotals(100, 0, 'expense')).toBeNull();
  });
});

describe('comparisonText', () => {
  it('says how much it moved and against what', () => {
    expect(
      comparisonText({ change: -0.091, direction: 'down', tone: 'good' }, '28 sep – 26 oct'),
    ).toBe('▼ 9 % vs. 28 sep – 26 oct');
    expect(comparisonText({ change: 0.124, direction: 'up', tone: 'good' }, 'Octubre')).toBe(
      '▲ 12 % vs. Octubre',
    );
  });
});
