import { groupByDay } from './group-by-day';

describe('groupByDay', () => {
  it('groups by day in the order the movements arrive, newest first', () => {
    const movements = [
      { id: 'a', date: '2026-11-27' },
      { id: 'b', date: '2026-11-27' },
      { id: 'c', date: '2026-11-25' },
      { id: 'd', date: '2026-11-24' },
    ];
    expect(groupByDay(movements, (movement) => movement.date)).toEqual([
      { date: '2026-11-27', items: [movements[0], movements[1]] },
      { date: '2026-11-25', items: [movements[2]] },
      { date: '2026-11-24', items: [movements[3]] },
    ]);
  });

  it('gives no groups without movements', () => {
    expect(groupByDay([], () => '2026-11-27')).toEqual([]);
  });
});
