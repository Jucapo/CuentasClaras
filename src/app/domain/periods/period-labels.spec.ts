import { dayTitle, periodRangeText, periodTitle, rangeText } from './period-labels';
import { PeriodSettings } from './periods';

const calendar: PeriodSettings = { monthStartDay: 1, weekStart: 'monday' };
const from28: PeriodSettings = { monthStartDay: 28, weekStart: 'monday' };
const today = '2026-11-26';

describe('periodTitle', () => {
  it('names days relative to today', () => {
    expect(periodTitle({ kind: 'day', anchor: '2026-11-26' }, calendar, today)).toBe('Hoy');
    expect(periodTitle({ kind: 'day', anchor: '2026-11-25' }, calendar, today)).toBe('Ayer');
    expect(periodTitle({ kind: 'day', anchor: '2026-11-19' }, calendar, today)).toBe(
      'Jueves 19 nov',
    );
    expect(periodTitle({ kind: 'day', anchor: '2026-11-27' }, calendar, today)).toBe(
      'Viernes 27 nov',
    );
    expect(periodTitle({ kind: 'day', anchor: '2025-12-31' }, calendar, today)).toBe(
      'Miércoles 31 dic 2025',
    );
  });

  it('names weeks by their first day', () => {
    expect(periodTitle({ kind: 'week', anchor: '2026-11-23' }, calendar, today)).toBe(
      'Semana del 23 nov',
    );
    expect(periodTitle({ kind: 'week', anchor: '2025-12-29' }, calendar, today)).toBe(
      'Semana del 29 dic 2025',
    );
  });

  it('names months after the month they end in, with the year only when it is not the current one', () => {
    expect(periodTitle({ kind: 'month', anchor: '2026-11-01' }, calendar, today)).toBe('Noviembre');
    expect(periodTitle({ kind: 'month', anchor: '2026-11-28' }, from28, today)).toBe('Diciembre');
    expect(periodTitle({ kind: 'month', anchor: '2025-11-01' }, calendar, today)).toBe(
      'Noviembre 2025',
    );
    // On 29 dic with D = 28 the current period is "Enero" of next year, and it is the current one.
    expect(periodTitle({ kind: 'month', anchor: '2026-12-28' }, from28, '2026-12-29')).toBe(
      'Enero',
    );
  });

  it('names years, "Siempre" and custom ranges', () => {
    expect(periodTitle({ kind: 'year', anchor: '2026-01-01' }, calendar, today)).toBe('2026');
    expect(periodTitle({ kind: 'year', anchor: '2026-12-28' }, from28, today)).toBe('2027');
    expect(periodTitle({ kind: 'all' }, calendar, today)).toBe('Siempre');
    expect(
      periodTitle({ kind: 'custom', start: '2026-11-03', end: '2026-11-17' }, calendar, today),
    ).toBe('Personalizado');
  });
});

describe('rangeText', () => {
  it('shows short dates and omits the current year', () => {
    expect(rangeText({ start: '2026-11-28', end: '2026-12-27' }, today)).toBe('28 nov – 27 dic');
    expect(rangeText({ start: '2026-11-26', end: '2026-11-26' }, today)).toBe('26 nov');
  });

  it('shows years when the range crosses a year or is not the current one', () => {
    expect(rangeText({ start: '2026-12-28', end: '2027-01-27' }, today)).toBe(
      '28 dic 2026 – 27 ene 2027',
    );
    expect(rangeText({ start: '2025-11-01', end: '2025-11-30' }, today)).toBe(
      '1 nov – 30 nov 2025',
    );
    expect(rangeText({ start: '2025-11-01', end: '2025-11-01' }, today)).toBe('1 nov 2025');
  });

  it('is empty when unbounded', () => {
    expect(rangeText({ start: null, end: null }, today)).toBe('');
  });

  it('describes the range of any period', () => {
    expect(periodRangeText({ kind: 'month', anchor: '2026-11-28' }, from28, today)).toBe(
      '28 nov – 27 dic',
    );
    expect(periodRangeText({ kind: 'week', anchor: '2026-11-23' }, calendar, today)).toBe(
      '23 nov – 29 nov',
    );
    expect(periodRangeText({ kind: 'all' }, calendar, today)).toBe('');
  });
});

describe('dayTitle', () => {
  it('names the days of a list', () => {
    expect(dayTitle('2026-11-26', today)).toBe('Hoy');
    expect(dayTitle('2026-11-24', today)).toBe('Martes 24 nov');
  });
});
