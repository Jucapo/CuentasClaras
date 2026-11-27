/** What was spent (or received) against a budget, in one currency; null means no budget. */
export interface BudgetFigures {
  readonly spent: number;
  readonly budget: number | null;
}

/**
 * How a row stands (spec §4.7): what is `left` of its budget (or still to receive), what went
 * `over` it (or came in on top), or `none` without a budget.
 */
export type BudgetStanding =
  { readonly kind: 'none' } | { readonly kind: 'left' | 'over'; readonly amount: number };

/**
 * The standing of a row. `counted` rows without a budget (the lines of an expense category that has
 * one) are over by what they spent.
 */
export function budgetStanding(figures: BudgetFigures, counted = false): BudgetStanding {
  const { spent, budget } = figures;
  if (budget && budget > 0) {
    const left = budget - spent;
    return left >= 0 ? { kind: 'left', amount: left } : { kind: 'over', amount: -left };
  }
  if (counted && spent > 0) {
    return { kind: 'over', amount: spent };
  }
  return { kind: 'none' };
}

/** How much of the bar fills: spent over budget; full when a counted row has no budget but spent. */
export function budgetFill(figures: BudgetFigures, counted = false): number {
  const { spent, budget } = figures;
  if (budget && budget > 0) {
    return spent / budget;
  }
  return counted && spent > 0 ? 1 : 0;
}

/**
 * A whole kind against its budget (spec §4.7): everything spent (or received) in it, and the sum of
 * the budgets of its categories; null when none has one.
 */
export function kindBudgetFigures(
  spent: number,
  categories: readonly BudgetFigures[],
): BudgetFigures {
  const budget = categories.reduce((sum, category) => sum + (category.budget ?? 0), 0);
  return { spent, budget: budget > 0 ? budget : null };
}

/**
 * The "General" line of a category: what was recorded right in it and its own amount, out of the
 * category totals that include its subcategories (spec §4.7). Null budget without an own amount.
 */
export function generalFigures(
  total: BudgetFigures,
  subcategories: readonly BudgetFigures[],
): BudgetFigures {
  const spent = total.spent - subcategories.reduce((sum, line) => sum + line.spent, 0);
  if (total.budget === null) {
    return { spent, budget: null };
  }
  const own = total.budget - subcategories.reduce((sum, line) => sum + (line.budget ?? 0), 0);
  return { spent, budget: own > 0 ? own : null };
}
