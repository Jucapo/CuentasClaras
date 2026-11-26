import { isIsoDate, todayIsoDate } from './local-date';

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
});
