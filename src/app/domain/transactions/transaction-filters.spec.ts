import {
  activeFilterCount,
  EMPTY_TRANSACTION_FILTERS,
  filterChipText,
  searchArguments,
} from './transaction-filters';

describe('transaction filters', () => {
  it('counts the filters with something picked', () => {
    expect(activeFilterCount(EMPTY_TRANSACTION_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        ...EMPTY_TRANSACTION_FILTERS,
        accountIds: ['cash', 'bank'],
        types: ['expense'],
      }),
    ).toBe(2);
  });

  it('names an active chip by its first value and how many more', () => {
    expect(filterChipText([])).toBeNull();
    expect(filterChipText(['Efectivo'])).toBe('Efectivo');
    expect(filterChipText(['Efectivo', 'Nequi', 'Lulo'])).toBe('Efectivo +2');
  });
});

describe('searchArguments', () => {
  it('sends the words without accents or case', () => {
    expect(searchArguments('  Educación  Colegio ', 'dot_comma', 'COP')).toEqual({
      terms: ['educacion', 'colegio'],
      amount: null,
    });
  });

  it('also sends the amount when the whole text is one in the format of the user', () => {
    expect(searchArguments('45.000', 'dot_comma', 'COP')).toEqual({
      terms: ['45.000'],
      amount: 4_500_000,
    });
    expect(searchArguments('1,250.5', 'comma_dot', 'COP')).toEqual({
      terms: ['1,250.5'],
      amount: 125_050,
    });
  });

  it('does not take a badly grouped number, zero or words as an amount', () => {
    expect(searchArguments('1,5', 'comma_dot', 'COP').amount).toBeNull();
    expect(searchArguments('0', 'comma_dot', 'COP').amount).toBeNull();
    expect(searchArguments('mercado 45000', 'comma_dot', 'COP').amount).toBeNull();
  });

  it('sends nothing for an empty search', () => {
    expect(searchArguments('   ', 'comma_dot', 'COP')).toEqual({ terms: [], amount: null });
  });
});
