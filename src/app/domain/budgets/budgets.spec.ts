import { BudgetEntry, budgetInForce, budgetTotals } from './budgets';

describe('budgets', () => {
  const entries: readonly BudgetEntry[] = [
    { category_id: 'home', amount: 300000000, currency: 'COP', effective_from: '2026-10-01' },
    { category_id: 'home', amount: 350000000, currency: 'COP', effective_from: '2026-12-01' },
    { category_id: 'pets', amount: 20000000, currency: 'COP', effective_from: '2026-11-01' },
    { category_id: 'pets', amount: 0, currency: 'COP', effective_from: '2027-01-01' },
    { category_id: 'trips', amount: 50000, currency: 'USD', effective_from: '2026-11-01' },
  ];

  describe('budgetInForce', () => {
    it('repeats every month until it changes', () => {
      expect(budgetInForce(entries, 'home', '2026-11-01')?.amount).toBe(300000000);
      expect(budgetInForce(entries, 'home', '2026-12-01')?.amount).toBe(350000000);
      expect(budgetInForce(entries, 'home', '2027-06-01')?.amount).toBe(350000000);
    });

    it('does not exist before it was set', () => {
      expect(budgetInForce(entries, 'home', '2026-09-01')).toBeNull();
    });

    it('ends when it is set to 0', () => {
      expect(budgetInForce(entries, 'pets', '2026-12-01')?.amount).toBe(20000000);
      expect(budgetInForce(entries, 'pets', '2027-01-01')).toBeNull();
    });

    it('ignores the order of the rows', () => {
      expect(budgetInForce([...entries].reverse(), 'home', '2026-12-01')?.amount).toBe(350000000);
    });
  });

  it('adds up budgets per currency, the main one first', () => {
    expect(budgetTotals(entries, ['home', 'pets', 'trips'], '2026-11-01', 'COP')).toEqual([
      { currency: 'COP', amount: 320000000 },
      { currency: 'USD', amount: 50000 },
    ]);
    expect(budgetTotals(entries, ['pets'], '2027-02-01', 'COP')).toEqual([]);
  });
});
