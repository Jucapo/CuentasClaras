import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apply, form } from '@angular/forms/signals';
import {
  AMOUNT_EXPRESSION_MESSAGES,
  defaultTagIds,
  includeInSpaceDefault,
  QUICK_ENTRY_MESSAGES,
  QuickEntryAccount,
  QuickEntryContext,
  quickEntrySchema,
  QuickEntryValue,
  sameQuickEntry,
  toTransactionEntry,
} from './quick-entry.model';

const account = (overrides: Partial<QuickEntryAccount>): QuickEntryAccount => ({
  id: 'cash',
  name: 'Efectivo',
  currency: 'COP',
  isCard: false,
  isPrivate: false,
  includeInSpaceByDefault: false,
  group: 'Cuentas',
  ...overrides,
});

const context: QuickEntryContext = {
  accounts: [
    account({}),
    account({ id: 'usd', name: 'Dólares', currency: 'USD' }),
    account({ id: 'card', name: 'Tarjeta', isCard: true, group: 'Deudas' }),
    account({ id: 'mine', name: 'Mía', isPrivate: true, includeInSpaceByDefault: true }),
  ],
};

const value = (overrides: Partial<QuickEntryValue>): QuickEntryValue => ({
  type: 'expense',
  expression: '25000',
  toExpression: '',
  categoryId: 'food',
  accountId: 'cash',
  toAccountId: '',
  date: '2026-11-26',
  tagIds: [],
  note: '',
  includeInSpace: false,
  installments: 1,
  monthlyRatePercent: 0,
  adjustmentDirection: 'increase',
  ...overrides,
});

/** Messages of the fields that fail with `overrides`. */
function errors(overrides: Partial<QuickEntryValue>): string[] {
  const injector = TestBed.inject(Injector);
  return runInInjectionContext(injector, () => {
    const model = signal(value(overrides));
    const entry = form(model, (path) => apply(path, quickEntrySchema(context)));
    return entry()
      .errorSummary()
      .map((error) => error.message ?? '');
  });
}

describe('quick entry rules', () => {
  it('accepts a typical expense', () => {
    expect(errors({})).toEqual([]);
  });

  it('needs an amount above zero, after adding and subtracting', () => {
    expect(errors({ expression: '' })).toEqual([QUICK_ENTRY_MESSAGES.amountRequired]);
    expect(errors({ expression: '100-100' })).toEqual([QUICK_ENTRY_MESSAGES.amountRequired]);
    expect(errors({ expression: '100-50' })).toEqual([]);
  });

  it('tells a division by zero apart from a missing amount', () => {
    expect(errors({ expression: '100/0' })).toEqual([AMOUNT_EXPRESSION_MESSAGES.division_by_zero]);
    expect(errors({ expression: '100*3/2' })).toEqual([]);
  });

  it('needs another destination for a transfer, and what arrived when the currency changes', () => {
    expect(errors({ type: 'transfer', toAccountId: '' })).toEqual([
      QUICK_ENTRY_MESSAGES.toAccountRequired,
    ]);
    expect(errors({ type: 'transfer', toAccountId: 'cash' })).toEqual([
      QUICK_ENTRY_MESSAGES.sameAccount,
    ]);
    expect(errors({ type: 'transfer', toAccountId: 'usd' })).toEqual([
      QUICK_ENTRY_MESSAGES.toAmountRequired,
    ]);
    expect(errors({ type: 'transfer', toAccountId: 'usd', toExpression: '100' })).toEqual([]);
    expect(errors({ type: 'transfer', toAccountId: 'card' })).toEqual([]);
  });

  it('checks installments and their rate only on credit card expenses', () => {
    expect(errors({ accountId: 'card', installments: 49 })).toEqual([
      QUICK_ENTRY_MESSAGES.installments,
    ]);
    expect(errors({ accountId: 'card', installments: 3, monthlyRatePercent: null })).toEqual([
      QUICK_ENTRY_MESSAGES.rateRequired,
    ]);
    expect(errors({ accountId: 'card', installments: 3, monthlyRatePercent: 100 })).toEqual([
      QUICK_ENTRY_MESSAGES.rateTooHigh,
    ]);
    expect(errors({ accountId: 'card', installments: 3, monthlyRatePercent: 0 })).toEqual([]);
    expect(errors({ accountId: 'cash', installments: 49, monthlyRatePercent: null })).toEqual([]);
  });

  it('limits the note', () => {
    expect(errors({ note: 'x'.repeat(501) })).toEqual([QUICK_ENTRY_MESSAGES.noteTooLong]);
  });
});

describe('toTransactionEntry', () => {
  it('saves an expense with its category, tags and amount in minor units', () => {
    expect(
      toTransactionEntry(
        'id-1',
        value({ expression: '12000+3500', tagIds: ['fixed'], note: ' Almuerzo ' }),
        context,
      ),
    ).toEqual({
      id: 'id-1',
      type: 'expense',
      date: '2026-11-26',
      amount: 1_550_000,
      accountId: 'cash',
      categoryId: 'food',
      toAccountId: null,
      toAmount: null,
      adjustmentDirection: null,
      note: 'Almuerzo',
      includeInSpace: false,
      tagIds: ['fixed'],
      installments: 1,
      monthlyRate: 0,
    });
  });

  it('keeps installments and turns the percent into a fraction only on credit cards', () => {
    const card = toTransactionEntry(
      'id',
      value({ accountId: 'card', installments: 3, monthlyRatePercent: 1.89 }),
      context,
    );
    expect(card.installments).toBe(3);
    expect(card.monthlyRate).toBeCloseTo(0.0189, 10);
    const cash = toTransactionEntry(
      'id',
      value({ installments: 3, monthlyRatePercent: 2 }),
      context,
    );
    expect(cash.installments).toBe(1);
    expect(cash.monthlyRate).toBe(0);
  });

  it('saves transfers without category or tags, with what arrived when the currency changes', () => {
    const entry = toTransactionEntry(
      'id',
      value({ type: 'transfer', toAccountId: 'usd', toExpression: '100.5', tagIds: ['x'] }),
      context,
    );
    expect(entry).toMatchObject({
      categoryId: null,
      toAccountId: 'usd',
      toAmount: 10_050,
      tagIds: [],
      adjustmentDirection: null,
    });
    expect(
      toTransactionEntry('id', value({ type: 'transfer', toAccountId: 'card' }), context).toAmount,
    ).toBeNull();
  });

  it('saves the direction of an adjustment', () => {
    const entry = toTransactionEntry(
      'id',
      value({ type: 'adjustment', adjustmentDirection: 'decrease' }),
      context,
    );
    expect(entry).toMatchObject({ categoryId: null, adjustmentDirection: 'decrease' });
  });

  it('includes in the space only movements of private accounts', () => {
    expect(
      toTransactionEntry('id', value({ accountId: 'mine', includeInSpace: true }), context)
        .includeInSpace,
    ).toBe(true);
    expect(
      toTransactionEntry('id', value({ accountId: 'cash', includeInSpace: true }), context)
        .includeInSpace,
    ).toBe(false);
  });
});

describe('defaults', () => {
  it('applies the tags of the category and of the chosen subcategory', () => {
    const category = { id: 'home', name: 'Casa', defaultTagIds: ['home'] };
    const subcategories = [
      { id: 'rent', name: 'Arriendo', defaultTagIds: ['fixed', 'home'] },
      { id: 'repairs', name: 'Mantenimiento', defaultTagIds: [] },
    ];
    expect(defaultTagIds('home', category, subcategories)).toEqual(['home']);
    expect(defaultTagIds('rent', category, subcategories)).toEqual(['home', 'fixed']);
    expect(defaultTagIds('repairs', category, subcategories)).toEqual(['home']);
    expect(defaultTagIds(null, null, [])).toEqual([]);
  });

  it('includes new movements of a private account as the account says', () => {
    expect(includeInSpaceDefault(context.accounts[3])).toBe(true);
    expect(includeInSpaceDefault(account({ isPrivate: true }))).toBe(false);
    expect(includeInSpaceDefault(account({ includeInSpaceByDefault: true }))).toBe(false);
    expect(includeInSpaceDefault(null)).toBe(false);
  });
});

describe('sameQuickEntry', () => {
  it('tells unsaved changes apart, whatever the order of the tags', () => {
    const opened = value({ tagIds: ['fixed', 'home'] });
    expect(sameQuickEntry(opened, value({ tagIds: ['home', 'fixed'] }))).toBe(true);
    expect(sameQuickEntry(opened, value({ tagIds: ['fixed'] }))).toBe(false);
    expect(sameQuickEntry(opened, { ...opened, expression: '25000+1' })).toBe(false);
    expect(sameQuickEntry(opened, { ...opened, note: 'Almuerzo' })).toBe(false);
    expect(sameQuickEntry(opened, { ...opened, date: '2026-11-25' })).toBe(false);
  });
});
