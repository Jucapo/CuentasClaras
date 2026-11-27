import { CategoryKind } from '../../core/categories/category.models';
import { CATEGORY_KIND_LABELS } from '../../core/config/catalog.constants';
import { TabOption } from '../../shared/ui/atoms/tabs/tabs';

/** Gastos / Ingresos tabs of the categories screens. */
export const CATEGORY_KIND_TABS: readonly TabOption<CategoryKind>[] = [
  { value: 'expense', label: CATEGORY_KIND_LABELS.expense, icon: 'trending_down' },
  { value: 'income', label: CATEGORY_KIND_LABELS.income, icon: 'trending_up' },
];

/** Empty state of a kind with no categories yet. */
export const EMPTY_CATEGORIES_TITLE: Readonly<Record<CategoryKind, string>> = {
  expense: 'Aún no hay categorías de gasto',
  income: 'Aún no hay categorías de ingreso',
};

/** Accessible names of the grid of each kind. */
export const CATEGORY_GRID_LABELS: Readonly<Record<CategoryKind, string>> = {
  expense: 'Categorías de gasto',
  income: 'Categorías de ingreso',
};
