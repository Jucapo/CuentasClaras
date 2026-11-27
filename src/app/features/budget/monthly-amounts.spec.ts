import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ACTION_OK, actionFailed } from '../../core/action-result';
import { BudgetsService } from '../../core/budgets/budgets.service';
import { CategoriesService } from '../../core/categories/categories.service';
import { PendingSaves } from '../../core/saving/pending-saves';
import { BudgetAmountChange } from '../../shared/ui/organisms/budget-list/budget-list';
import { ToastService } from '../../shared/ui/services/toast.service';
import { MonthlyAmounts } from './monthly-amounts';

describe('MonthlyAmounts', () => {
  const budgets = {
    mainCurrency: signal('COP'),
    setMonthly: vi.fn(),
    setAmount: vi.fn(),
  };
  const toast = { show: vi.fn() };

  function change(overrides: Partial<BudgetAmountChange> = {}): BudgetAmountChange {
    return {
      categoryId: 'home',
      amount: 150000000,
      currency: 'COP',
      revert: vi.fn(),
      ...overrides,
    };
  }

  function setup(): MonthlyAmounts {
    budgets.setMonthly.mockReset().mockResolvedValue(ACTION_OK);
    budgets.setAmount.mockReset().mockResolvedValue(ACTION_OK);
    toast.show.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: BudgetsService, useValue: budgets },
        { provide: CategoriesService, useValue: { tree: () => [] } },
        { provide: ToastService, useValue: toast },
      ],
    });
    return TestBed.inject(MonthlyAmounts);
  }

  it('saves the amount typed in a row in its currency', async () => {
    const amounts = setup();
    const typed = change({ currency: 'USD', amount: 50000 });
    await expect(amounts.save(typed)).resolves.toEqual(ACTION_OK);
    expect(budgets.setMonthly).toHaveBeenCalledWith('home', 50000, 'USD');
    expect(typed.revert).not.toHaveBeenCalled();
  });

  it('saves in the month being shown with the scope of the edit', async () => {
    const amounts = setup();
    await amounts.save(change(), { month: '2026-10-01', scope: 'month' });
    expect(budgets.setAmount).toHaveBeenCalledWith('home', 150000000, 'COP', '2026-10-01', 'month');
    expect(budgets.setMonthly).not.toHaveBeenCalled();
  });

  it('removes the amount with 0', async () => {
    const amounts = setup();
    await amounts.save(change({ amount: 0 }));
    expect(budgets.setMonthly).toHaveBeenCalledWith('home', 0, 'COP');
  });

  it('changes nothing for an empty row and gives it its amount back', async () => {
    const amounts = setup();
    const cleared = change({ amount: null });
    await expect(amounts.save(cleared)).resolves.toEqual(ACTION_OK);
    expect(budgets.setMonthly).not.toHaveBeenCalled();
    expect(cleared.revert).toHaveBeenCalled();
  });

  it('tells why a save failed and puts the row back', async () => {
    const amounts = setup();
    budgets.setMonthly.mockResolvedValue(actionFailed('No se pudo guardar.'));
    const failed = change();
    await expect(amounts.save(failed)).resolves.toEqual(actionFailed('No se pudo guardar.'));
    expect(failed.revert).toHaveBeenCalled();
    expect(toast.show).toHaveBeenCalledWith('No se pudo guardar.');
  });

  it('lets screens wait for the saves still running', async () => {
    const amounts = setup();
    let finish!: () => void;
    budgets.setMonthly.mockReturnValue(
      new Promise((resolve) => (finish = () => resolve(actionFailed('Sin conexión.')))),
    );
    const pending = TestBed.inject(PendingSaves);
    void amounts.save(change());
    expect(pending.busy()).toBe(true);
    const settled = pending.settle();
    finish();
    await expect(settled).resolves.toEqual(actionFailed('Sin conexión.'));
  });
});
