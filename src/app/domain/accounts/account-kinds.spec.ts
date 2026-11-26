import {
  accountsTotal,
  BalanceItem,
  groupAccounts,
  includeInTotalByDefault,
  isDebtKind,
  toDisplayedBalance,
  toStoredBalance,
} from './account-kinds';

describe('account kinds', () => {
  it('treats only cards, loans and simple debts as debts', () => {
    expect(isDebtKind('credit_card')).toBe(true);
    expect(isDebtKind('loan')).toBe(true);
    expect(isDebtKind('simple_debt')).toBe(true);
    expect(isDebtKind('receivable')).toBe(false);
    expect(isDebtKind('savings')).toBe(false);
  });

  it('counts only available money in the total by default', () => {
    expect(includeInTotalByDefault('cash')).toBe(true);
    expect(includeInTotalByDefault('bank')).toBe(true);
    expect(includeInTotalByDefault('wallet')).toBe(true);
    expect(includeInTotalByDefault('savings')).toBe(false);
    expect(includeInTotalByDefault('credit_card')).toBe(false);
    expect(includeInTotalByDefault('receivable')).toBe(false);
    expect(includeInTotalByDefault('asset')).toBe(false);
  });
});

describe('debt sign', () => {
  it('stores what the user owes as a negative balance', () => {
    expect(toStoredBalance('credit_card', 50000)).toBe(-50000);
    expect(toDisplayedBalance('credit_card', -50000)).toBe(50000);
  });

  it('keeps other balances as typed, including overdrafts', () => {
    expect(toStoredBalance('bank', 50000)).toBe(50000);
    expect(toStoredBalance('bank', -2000)).toBe(-2000);
    expect(toStoredBalance('receivable', 7000)).toBe(7000);
  });

  it('never stores a negative zero', () => {
    expect(Object.is(toStoredBalance('loan', 0), 0)).toBe(true);
    expect(Object.is(toDisplayedBalance('loan', 0), 0)).toBe(true);
  });

  // Spec §4.1: switching between debt and non-debt keeps the visible amount, flipping the sign.
  it('keeps the visible amount when the kind switches from non-debt to debt', () => {
    const shown = toDisplayedBalance('bank', 120000);
    expect(shown).toBe(120000);
    expect(toStoredBalance('credit_card', shown)).toBe(-120000);
  });

  it('keeps the visible amount when the kind switches from debt to non-debt', () => {
    const shown = toDisplayedBalance('loan', -300000);
    expect(shown).toBe(300000);
    expect(toStoredBalance('savings', shown)).toBe(300000);
  });

  it('keeps the stored sign when switching between two debts or two non-debts', () => {
    expect(toStoredBalance('simple_debt', toDisplayedBalance('credit_card', -800))).toBe(-800);
    expect(toStoredBalance('wallet', toDisplayedBalance('cash', 800))).toBe(800);
  });
});

describe('grouping and totals', () => {
  const accounts: (BalanceItem & { name: string })[] = [
    {
      name: 'Tarjeta',
      kind: 'credit_card',
      currency: 'COP',
      balance: -50000,
      include_in_total: true,
    },
    { name: 'Efectivo', kind: 'cash', currency: 'COP', balance: 100000, include_in_total: true },
    {
      name: 'DollarApp',
      kind: 'savings',
      currency: 'USD',
      balance: 30000,
      include_in_total: false,
    },
    { name: 'Nequi', kind: 'wallet', currency: 'COP', balance: 20000, include_in_total: true },
    {
      name: 'Caja menor',
      kind: 'savings',
      currency: 'COP',
      balance: 5000,
      include_in_total: false,
    },
  ];

  it('returns the non-empty groups in display order with totals per currency', () => {
    const groups = groupAccounts(accounts, 'COP');
    expect(groups.map((group) => group.group)).toEqual(['accounts', 'savings', 'debts']);
    expect(groups[0].accounts.map((account) => account.name)).toEqual(['Efectivo', 'Nequi']);
    expect(groups[0].totals).toEqual([{ currency: 'COP', amount: 120000 }]);
    expect(groups[1].totals).toEqual([
      { currency: 'COP', amount: 5000 },
      { currency: 'USD', amount: 30000 },
    ]);
    expect(groups[2].totals).toEqual([{ currency: 'COP', amount: -50000 }]);
  });

  it('adds only the accounts included in the total, debts subtracting', () => {
    expect(accountsTotal(accounts, 'COP')).toEqual([{ currency: 'COP', amount: 70000 }]);
  });
});
