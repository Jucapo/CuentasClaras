import { balanceDates, showsBalances } from './balance-window';
import { EMPTY_TRANSACTION_FILTERS } from './transaction-filters';

const NO_SEARCH = { terms: [], amount: null };

describe('balanceDates', () => {
  it('takes the day before the period and today while it is in progress', () => {
    expect(balanceDates({ start: '2026-11-01', end: '2026-11-30' }, '2026-11-26')).toEqual({
      opening: '2026-10-31',
      closing: '2026-11-26',
    });
  });

  it('takes the end of a finished or future period', () => {
    expect(balanceDates({ start: '2026-10-01', end: '2026-10-31' }, '2026-11-26')).toEqual({
      opening: '2026-09-30',
      closing: '2026-10-31',
    });
    expect(balanceDates({ start: '2026-12-01', end: '2026-12-31' }, '2026-11-26')).toEqual({
      opening: '2026-11-30',
      closing: '2026-12-31',
    });
    // Its last day is still in progress, and ends today either way.
    expect(balanceDates({ start: '2026-11-01', end: '2026-11-30' }, '2026-11-30').closing).toBe(
      '2026-11-30',
    );
  });

  it('has only a closing balance, today, in "Siempre"', () => {
    expect(balanceDates({ start: null, end: null }, '2026-11-26')).toEqual({
      opening: null,
      closing: '2026-11-26',
    });
  });
});

describe('showsBalances', () => {
  it('applies with no filter or only the account one', () => {
    expect(showsBalances(EMPTY_TRANSACTION_FILTERS, NO_SEARCH)).toBe(true);
    expect(showsBalances({ ...EMPTY_TRANSACTION_FILTERS, accountIds: ['cash'] }, NO_SEARCH)).toBe(
      true,
    );
  });

  it('does not apply with another filter or a search', () => {
    expect(showsBalances({ ...EMPTY_TRANSACTION_FILTERS, categoryIds: ['food'] }, NO_SEARCH)).toBe(
      false,
    );
    expect(showsBalances({ ...EMPTY_TRANSACTION_FILTERS, statuses: ['pending'] }, NO_SEARCH)).toBe(
      false,
    );
    expect(showsBalances(EMPTY_TRANSACTION_FILTERS, { terms: ['mercado'], amount: null })).toBe(
      false,
    );
    expect(showsBalances(EMPTY_TRANSACTION_FILTERS, { terms: [], amount: 2_500_000 })).toBe(false);
  });
});
