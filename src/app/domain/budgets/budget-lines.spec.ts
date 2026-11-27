import { budgetFill, budgetStanding, generalFigures } from './budget-lines';

describe('budgetStanding', () => {
  it('says what is left of a budget or how much went over it', () => {
    expect(budgetStanding({ spent: 650, budget: 800 })).toEqual({ kind: 'left', amount: 150 });
    expect(budgetStanding({ spent: 800, budget: 800 })).toEqual({ kind: 'left', amount: 0 });
    expect(budgetStanding({ spent: 1000, budget: 800 })).toEqual({ kind: 'over', amount: 200 });
  });

  it('marks a counted row without a budget as over by what it spent', () => {
    expect(budgetStanding({ spent: 300, budget: null }, true)).toEqual({ kind: 'over', amount: 300 });
    expect(budgetStanding({ spent: 0, budget: null }, true)).toEqual({ kind: 'none' });
    expect(budgetStanding({ spent: 300, budget: null })).toEqual({ kind: 'none' });
  });
});

describe('budgetFill', () => {
  it('fills with what was spent, and fully for a counted row over without a budget', () => {
    expect(budgetFill({ spent: 400, budget: 800 })).toBe(0.5);
    expect(budgetFill({ spent: 1200, budget: 800 })).toBe(1.5);
    expect(budgetFill({ spent: 300, budget: null }, true)).toBe(1);
    expect(budgetFill({ spent: 300, budget: null })).toBe(0);
  });
});

describe('generalFigures', () => {
  const subcategories = [
    { spent: 350, budget: 300 },
    { spent: 20, budget: 40 },
    { spent: 15, budget: null },
  ];

  it('takes what was recorded right in the category and its own amount out of the totals', () => {
    expect(generalFigures({ spent: 435, budget: 440 }, subcategories)).toEqual({
      spent: 50,
      budget: 100,
    });
  });

  it('has no budget when the category only adds those of its subcategories', () => {
    expect(generalFigures({ spent: 385, budget: 340 }, subcategories)).toEqual({
      spent: 0,
      budget: null,
    });
    expect(generalFigures({ spent: 10, budget: null }, [])).toEqual({ spent: 10, budget: null });
  });
});
