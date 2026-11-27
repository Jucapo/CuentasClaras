import { budgetWrites, isMonthOnly, nextOwnMonth } from './budget-scope';
import { budgetInForce, BudgetEntry } from './budgets';

/** The rows after saving `writes` over `entries`, as the service does. */
function apply(
  entries: readonly BudgetEntry[],
  categoryId: string,
  writes: ReturnType<typeof budgetWrites>,
): BudgetEntry[] {
  const result = [...entries];
  for (const write of writes) {
    const index = result.findIndex(
      (entry) => entry.category_id === categoryId && entry.effective_from === write.effectiveFrom,
    );
    const row = {
      category_id: categoryId,
      amount: write.amount,
      currency: write.currency,
      effective_from: write.effectiveFrom,
    };
    if (index >= 0) {
      result[index] = row;
    } else {
      result.push(row);
    }
  }
  return result;
}

const amountIn = (entries: readonly BudgetEntry[], month: string) =>
  budgetInForce(entries, 'home', month)?.amount ?? null;

describe('budgetWrites', () => {
  // Hogar: 500.000 since September; the current month is December.
  const entries: readonly BudgetEntry[] = [
    { category_id: 'home', amount: 50_000_000, currency: 'COP', effective_from: '2026-09-01' },
  ];

  it('"solo el mes" keeps the next month as it was, saving it first', () => {
    const writes = budgetWrites(entries, 'home', '2026-12-01', 70_000_000, 'COP', 'month');
    expect(writes).toEqual([
      { effectiveFrom: '2027-01-01', amount: 50_000_000, currency: 'COP' },
      { effectiveFrom: '2026-12-01', amount: 70_000_000, currency: 'COP' },
    ]);
    const after = apply(entries, 'home', writes);
    expect(amountIn(after, '2026-11-01')).toBe(50_000_000);
    expect(amountIn(after, '2026-12-01')).toBe(70_000_000);
    expect(amountIn(after, '2027-03-01')).toBe(50_000_000);
  });

  it('"solo el mes" in a past month leaves the months after it alone', () => {
    const writes = budgetWrites(entries, 'home', '2026-10-01', 20_000_000, 'COP', 'month');
    const after = apply(entries, 'home', writes);
    expect(amountIn(after, '2026-09-01')).toBe(50_000_000);
    expect(amountIn(after, '2026-10-01')).toBe(20_000_000);
    expect(amountIn(after, '2026-11-01')).toBe(50_000_000);
    expect(amountIn(after, '2026-12-01')).toBe(50_000_000);
  });

  it('"solo el mes" keeps no amount after it when there was none', () => {
    const writes = budgetWrites([], 'home', '2026-12-01', 10_000_000, 'COP', 'month');
    expect(writes).toEqual([
      { effectiveFrom: '2027-01-01', amount: 0, currency: 'COP' },
      { effectiveFrom: '2026-12-01', amount: 10_000_000, currency: 'COP' },
    ]);
    expect(amountIn(apply([], 'home', writes), '2027-01-01')).toBeNull();
  });

  it('"solo el mes" writes only the month when the next one has its own amount', () => {
    const own = [
      ...entries,
      { category_id: 'home', amount: 60_000_000, currency: 'COP', effective_from: '2027-01-01' },
    ];
    expect(budgetWrites(own, 'home', '2026-12-01', 70_000_000, 'COP', 'month')).toEqual([
      { effectiveFrom: '2026-12-01', amount: 70_000_000, currency: 'COP' },
    ]);
  });

  it('"y los siguientes" changes the months after, but not those with their own amount', () => {
    const own = [
      ...entries,
      { category_id: 'home', amount: 60_000_000, currency: 'COP', effective_from: '2027-02-01' },
    ];
    const writes = budgetWrites(own, 'home', '2026-10-01', 40_000_000, 'COP', 'onward');
    expect(writes).toEqual([{ effectiveFrom: '2026-10-01', amount: 40_000_000, currency: 'COP' }]);
    const after = apply(own, 'home', writes);
    expect(amountIn(after, '2026-09-01')).toBe(50_000_000);
    expect(amountIn(after, '2026-12-01')).toBe(40_000_000);
    expect(amountIn(after, '2027-01-01')).toBe(40_000_000);
    expect(amountIn(after, '2027-02-01')).toBe(60_000_000);
  });

  it('writes nothing when the amount does not change', () => {
    expect(budgetWrites(entries, 'home', '2026-12-01', 50_000_000, 'COP', 'month')).toEqual([]);
    expect(budgetWrites([], 'home', '2026-12-01', 0, 'COP', 'onward')).toEqual([]);
  });

  it('removes the budget with 0 in either scope', () => {
    expect(budgetWrites(entries, 'home', '2026-12-01', 0, 'COP', 'month')).toEqual([
      { effectiveFrom: '2027-01-01', amount: 50_000_000, currency: 'COP' },
      { effectiveFrom: '2026-12-01', amount: 0, currency: 'COP' },
    ]);
    expect(budgetWrites(entries, 'home', '2026-12-01', 0, 'COP', 'onward')).toEqual([
      { effectiveFrom: '2026-12-01', amount: 0, currency: 'COP' },
    ]);
  });

  it('takes a new currency as a change', () => {
    expect(budgetWrites(entries, 'home', '2026-12-01', 50_000_000, 'USD', 'onward')).toHaveLength(1);
  });
});

describe('isMonthOnly and nextOwnMonth', () => {
  const entries: readonly BudgetEntry[] = [
    { category_id: 'home', amount: 50_000_000, currency: 'COP', effective_from: '2026-09-01' },
    { category_id: 'home', amount: 70_000_000, currency: 'COP', effective_from: '2026-12-01' },
    { category_id: 'home', amount: 50_000_000, currency: 'COP', effective_from: '2027-01-01' },
  ];

  it('marks a month whose own amount differs from the next one', () => {
    expect(isMonthOnly(entries, 'home', '2026-12-01')).toBe(true);
    expect(isMonthOnly(entries, 'home', '2026-09-01')).toBe(false);
    expect(isMonthOnly(entries, 'home', '2027-01-01')).toBe(false);
    expect(isMonthOnly(entries, 'home', '2026-11-01')).toBe(false);
  });

  it('finds the next month with an amount of its own', () => {
    expect(nextOwnMonth(entries, 'home', '2026-10-01')).toBe('2026-12-01');
    expect(nextOwnMonth(entries, 'home', '2026-12-01')).toBe('2027-01-01');
    expect(nextOwnMonth(entries, 'home', '2027-01-01')).toBeNull();
  });
});
