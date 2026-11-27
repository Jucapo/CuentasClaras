import { periodMonth } from './period-month';

describe('periodMonth', () => {
  it('is the calendar month when months start on the 1st', () => {
    expect(periodMonth('2026-11-01', 1)).toBe('2026-11-01');
    expect(periodMonth('2026-11-30', 1)).toBe('2026-11-01');
  });

  it('is the month the period ends in', () => {
    // 28 oct – 27 nov is "Noviembre"; 28 nov – 27 dic is "Diciembre" (spec §4.5).
    expect(periodMonth('2026-11-27', 28)).toBe('2026-11-01');
    expect(periodMonth('2026-11-28', 28)).toBe('2026-12-01');
  });

  it('rolls over to January of the next year', () => {
    expect(periodMonth('2026-12-28', 28)).toBe('2027-01-01');
    expect(periodMonth('2026-12-15', 15)).toBe('2027-01-01');
  });
});
