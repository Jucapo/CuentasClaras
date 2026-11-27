import { toStoredBalance } from '../accounts/account-kinds';
import { adjustmentFor, balanceDelta, BalanceMovement } from './transactions';

const movement = (overrides: Partial<BalanceMovement>): BalanceMovement => ({
  type: 'expense',
  amount: 1_000,
  account_id: 'cash',
  to_account_id: null,
  to_amount: null,
  adjustment_direction: null,
  ...overrides,
});

describe('balanceDelta', () => {
  it('subtracts expenses and adds incomes', () => {
    expect(balanceDelta(movement({ type: 'expense' }), 'cash')).toBe(-1_000);
    expect(balanceDelta(movement({ type: 'income' }), 'cash')).toBe(1_000);
  });

  it('subtracts a transfer from its source and adds what arrived to its destination', () => {
    const transfer = movement({ type: 'transfer', to_account_id: 'usd', to_amount: 25 });
    expect(balanceDelta(transfer, 'cash')).toBe(-1_000);
    expect(balanceDelta(transfer, 'usd')).toBe(25);
    expect(balanceDelta(movement({ type: 'transfer', to_account_id: 'bank' }), 'bank')).toBe(1_000);
  });

  it('follows the direction of an adjustment', () => {
    expect(
      balanceDelta(movement({ type: 'adjustment', adjustment_direction: 'increase' }), 'cash'),
    ).toBe(1_000);
    expect(
      balanceDelta(movement({ type: 'adjustment', adjustment_direction: 'decrease' }), 'cash'),
    ).toBe(-1_000);
  });

  it('is zero for other accounts', () => {
    expect(balanceDelta(movement({}), 'bank')).toBe(0);
  });
});

describe('adjustmentFor', () => {
  it('raises or lowers the balance by the difference', () => {
    expect(adjustmentFor(100_000, 120_000)).toEqual({ direction: 'increase', amount: 20_000 });
    expect(adjustmentFor(100_000, 90_000)).toEqual({ direction: 'decrease', amount: 10_000 });
    expect(adjustmentFor(100_000, 100_000)).toBeNull();
  });

  it('works on debts once what the user typed is turned into the stored balance', () => {
    // The card shows a debt of 500,000 and the bank says 520,000: the debt grows.
    const stored = toStoredBalance('credit_card', 500_000);
    const real = toStoredBalance('credit_card', 520_000);
    expect(adjustmentFor(stored, real)).toEqual({ direction: 'decrease', amount: 20_000 });
    // Paid down to 450,000: the balance goes up.
    expect(adjustmentFor(stored, toStoredBalance('credit_card', 450_000))).toEqual({
      direction: 'increase',
      amount: 50_000,
    });
  });
});
