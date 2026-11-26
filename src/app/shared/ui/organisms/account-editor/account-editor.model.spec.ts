import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apply, form } from '@angular/forms/signals';
import {
  ACCOUNT_FORM_MESSAGES,
  accountFormSchema,
  accountFormToRow,
  AccountFormValue,
  accountToFormValue,
  accountGroupFromParam,
  applyKindDefaults,
  defaultKindFor,
  newAccountFormValue,
} from './account-editor.model';

describe('account form model', () => {
  it('starts a new account with the defaults of its kind', () => {
    expect(newAccountFormValue('COP', '2026-11-26')).toEqual({
      name: '',
      kind: 'bank',
      currency: 'COP',
      balance: 0,
      balanceDate: '2026-11-26',
      icon: 'account_balance',
      color: 'blue',
      includeInTotal: true,
      isPrivate: false,
      includeInSpaceByDefault: false,
      isDefault: false,
    });
    expect(newAccountFormValue('COP', '2026-11-26', 'savings').includeInTotal).toBe(false);
  });

  it('follows the new kind while the user keeps the defaults', () => {
    const bank = newAccountFormValue('COP', '2026-11-26');
    const card = applyKindDefaults({ ...bank, kind: 'credit_card' }, 'bank');
    expect(card.icon).toBe('credit_card');
    expect(card.color).toBe('red');
    expect(card.includeInTotal).toBe(false);
  });

  it('keeps what the user changed when the kind changes', () => {
    const custom: AccountFormValue = {
      ...newAccountFormValue('COP', '2026-11-26'),
      icon: 'diamond',
      includeInTotal: false,
    };
    const savings = applyKindDefaults({ ...custom, kind: 'savings' }, 'bank');
    expect(savings.icon).toBe('diamond');
    expect(savings.color).toBe('teal');
    expect(savings.includeInTotal).toBe(false);

    const cash = applyKindDefaults({ ...custom, kind: 'cash', includeInTotal: false }, 'savings');
    expect(cash.includeInTotal).toBe(true);
  });

  it('stores debts as negative and shows them as positive', () => {
    const value = { ...newAccountFormValue('COP', '2026-11-26', 'credit_card'), balance: 50000 };
    const row = accountFormToRow(value, 'gray');
    expect(row.initial_balance).toBe(-50000);
    expect(accountToFormValue({ ...row, initial_balance: -50000 }, false).balance).toBe(50000);
  });

  it('keeps the visible amount and flips the stored sign when switching to and from a debt', () => {
    const bank = { ...newAccountFormValue('COP', '2026-11-26'), balance: 120000 };
    const asDebt = applyKindDefaults({ ...bank, kind: 'loan' }, 'bank');
    expect(asDebt.balance).toBe(120000);
    expect(accountFormToRow(asDebt, 'gray').initial_balance).toBe(-120000);

    const backToSavings = applyKindDefaults({ ...asDebt, kind: 'savings' }, 'loan');
    expect(backToSavings.balance).toBe(120000);
    expect(accountFormToRow(backToSavings, 'gray').initial_balance).toBe(120000);
  });

  it('saves the visibility and drops "include in the space" for shared accounts', () => {
    const shared = {
      ...newAccountFormValue('COP', '2026-11-26'),
      name: '  Nequi ',
      includeInSpaceByDefault: true,
    };
    expect(accountFormToRow(shared, 'gray')).toMatchObject({
      name: 'Nequi',
      visibility: 'shared',
      include_in_space_by_default: false,
    });
    expect(accountFormToRow({ ...shared, isPrivate: true }, 'gray')).toMatchObject({
      visibility: 'private',
      include_in_space_by_default: true,
    });
    expect(accountFormToRow({ ...shared, balance: null, color: null }, 'gray')).toMatchObject({
      initial_balance: 0,
      color: 'gray',
    });
  });

  describe('validation', () => {
    function validate(value: Partial<AccountFormValue>) {
      const model = signal({
        ...newAccountFormValue('COP', '2026-11-01'),
        name: 'Nequi',
        ...value,
      });
      const f = TestBed.runInInjectionContext(() =>
        form(model, (path) => apply(path, accountFormSchema)),
      );
      return {
        valid: f().valid(),
        messages: f()
          .errorSummary()
          .map((error) => error.message),
      };
    }

    it('accepts a complete account, including a zero balance', () => {
      expect(validate({ balance: 0 })).toEqual({ valid: true, messages: [] });
    });

    it('needs a name, a balance, a past date and a color', () => {
      expect(validate({ name: '   ' }).messages).toContain(ACCOUNT_FORM_MESSAGES.nameRequired);
      expect(validate({ name: 'x'.repeat(61) }).messages).toContain(
        ACCOUNT_FORM_MESSAGES.nameTooLong,
      );
      expect(validate({ balance: null }).messages).toContain(ACCOUNT_FORM_MESSAGES.balanceRequired);
      expect(validate({ balanceDate: '' }).messages).toContain(ACCOUNT_FORM_MESSAGES.dateRequired);
      expect(validate({ balanceDate: '2999-01-01' }).messages).toContain(
        ACCOUNT_FORM_MESSAGES.dateInFuture,
      );
      expect(validate({ color: null }).messages).toContain(ACCOUNT_FORM_MESSAGES.colorRequired);
    });
  });
});

describe('new account by group', () => {
  it('reads the group of the "grupo" query param and defaults to Cuentas', () => {
    expect(accountGroupFromParam('deuda')).toBe('debts');
    expect(accountGroupFromParam('me-deben')).toBe('receivables');
    expect(accountGroupFromParam('ahorro')).toBe('savings');
    expect(accountGroupFromParam('cuenta')).toBe('accounts');
    expect(accountGroupFromParam('bienes')).toBe('accounts');
    expect(accountGroupFromParam(undefined)).toBe('accounts');
  });

  it('starts each group with its most common kind and that kind defaults', () => {
    expect(defaultKindFor('accounts')).toBe('bank');
    expect(defaultKindFor('savings')).toBe('savings');
    expect(defaultKindFor('debts')).toBe('credit_card');
    expect(defaultKindFor('receivables')).toBe('receivable');

    const debt = newAccountFormValue('COP', '2026-11-26', defaultKindFor('debts'));
    expect(debt).toMatchObject({ icon: 'credit_card', color: 'red', includeInTotal: false });
  });
});
