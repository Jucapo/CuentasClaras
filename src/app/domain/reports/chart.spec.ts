import {
  bucketSize,
  chartBuckets,
  chartRange,
  chartTicks,
  DailyAmount,
  rankCategories,
  RankableTotal,
} from './chart';

const totals: RankableTotal[] = [
  { categoryId: 'home', parentId: null, kind: 'expense', amount: 3_465_444 },
  { categoryId: 'car', parentId: null, kind: 'expense', amount: 2_786_400 },
  { categoryId: 'rent', parentId: 'home', kind: 'expense', amount: 3_000_000 },
  { categoryId: 'fun', parentId: null, kind: 'expense', amount: 221_050 },
  { categoryId: 'market', parentId: null, kind: 'expense', amount: 1_250_013 },
  { categoryId: 'trips', parentId: null, kind: 'expense', amount: 0 },
  { categoryId: 'salary', parentId: null, kind: 'income', amount: 9_000_000 },
];

describe('rankCategories', () => {
  it('keeps the top-level categories of a kind with something, largest first, in two parts', () => {
    expect(rankCategories(totals, 'expense')).toEqual({
      top: [
        { categoryId: 'home', amount: 3_465_444 },
        { categoryId: 'car', amount: 2_786_400 },
        { categoryId: 'market', amount: 1_250_013 },
      ],
      rest: [{ categoryId: 'fun', amount: 221_050 }],
    });
    expect(rankCategories(totals, 'income')).toEqual({
      top: [{ categoryId: 'salary', amount: 9_000_000 }],
      rest: [],
    });
  });
});

describe('chartRange', () => {
  it('is the period when it has dates', () => {
    expect(
      chartRange({ start: '2026-11-01', end: '2026-11-30' }, ['2026-11-05'], '2026-11-27'),
    ).toEqual({ start: '2026-11-01', end: '2026-11-30' });
  });

  it('runs "Siempre" from the first movement to today, or to a later movement', () => {
    expect(
      chartRange({ start: null, end: null }, ['2026-08-15', '2026-03-02'], '2026-11-27'),
    ).toEqual({ start: '2026-03-02', end: '2026-11-27' });
    expect(chartRange({ start: null, end: null }, ['2026-12-05'], '2026-11-27')).toEqual({
      start: '2026-11-27',
      end: '2026-12-05',
    });
  });
});

describe('bucketSize', () => {
  it('goes by day except in a year, in "Siempre" and in long ranges', () => {
    const month = { start: '2026-11-01', end: '2026-11-30' };
    expect(bucketSize('month', month, 62)).toBe('day');
    expect(bucketSize('year', { start: '2026-01-01', end: '2026-12-31' }, 62)).toBe('month');
    expect(bucketSize('all', month, 62)).toBe('month');
    expect(bucketSize('custom', { start: '2026-01-01', end: '2026-06-30' }, 62)).toBe('month');
  });
});

describe('chartBuckets', () => {
  const rows: DailyAmount[] = [
    { date: '2026-11-02', categoryId: 'home', amount: 100 },
    { date: '2026-11-02', categoryId: 'fun', amount: 30 },
    { date: '2026-11-02', categoryId: 'trips', amount: 20 },
    { date: '2026-11-04', categoryId: 'car', amount: 70 },
  ];

  it('stacks the top categories in order and the rest last, with 0 on empty days', () => {
    expect(
      chartBuckets(rows, { start: '2026-11-01', end: '2026-11-04' }, 'day', ['home', 'car'], 1),
    ).toEqual([
      { start: '2026-11-01', end: '2026-11-01', values: [0, 0, 0], total: 0 },
      { start: '2026-11-02', end: '2026-11-02', values: [100, 0, 50], total: 150 },
      { start: '2026-11-03', end: '2026-11-03', values: [0, 0, 0], total: 0 },
      { start: '2026-11-04', end: '2026-11-04', values: [0, 70, 0], total: 70 },
    ]);
  });

  it('groups by month of the period, cut to the range', () => {
    // Months from the 28th: 28 oct – 27 nov is "Noviembre", 28 nov – 27 dic is "Diciembre".
    const buckets = chartBuckets(
      [
        { date: '2026-11-27', categoryId: 'home', amount: 10 },
        { date: '2026-11-28', categoryId: 'home', amount: 5 },
      ],
      { start: '2026-11-01', end: '2026-12-10' },
      'month',
      ['home'],
      28,
    );
    expect(buckets).toEqual([
      { start: '2026-11-01', end: '2026-11-27', values: [10, 0], total: 10 },
      { start: '2026-11-28', end: '2026-12-10', values: [5, 0], total: 5 },
    ]);
  });
});

describe('chartTicks', () => {
  it('marks a day a week from the start and the last day', () => {
    // 1 nov – 30 nov: 1, 8, 15, 22 and 30 nov; the 29th would sit on top of the 30th.
    expect(chartTicks(30, 'day')).toEqual([0, 7, 14, 21, 29]);
    // 27 may – 26 jun: the 24th gives way to the 26th.
    expect(chartTicks(31, 'day')).toEqual([0, 7, 14, 21, 30]);
    expect(chartTicks(26, 'day')).toEqual([0, 7, 14, 21, 25]);
    expect(chartTicks(24, 'day')).toEqual([0, 7, 14, 23]);
    expect(chartTicks(29, 'day')).toEqual([0, 7, 14, 21, 28]);
    expect(chartTicks(1, 'day')).toEqual([0]);
  });

  it('marks every month, or every few in long spans', () => {
    expect(chartTicks(12, 'month')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(chartTicks(30, 'month')).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 29]);
    expect(chartTicks(0, 'day')).toEqual([]);
  });
});
