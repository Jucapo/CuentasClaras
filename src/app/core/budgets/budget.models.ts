import { Tables, TablesInsert } from '../supabase/database.types';

/**
 * A monthly amount of a category from a period on (spec §4.7): the budget of an expense category
 * or the expected income of an income one.
 */
export type Budget = Tables<'budgets'>;

/** Columns a client sets when creating a budget row. */
export type NewBudget = Omit<TablesInsert<'budgets'>, 'id' | 'created_at'>;
