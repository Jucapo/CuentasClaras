import { maxLength, required, schema, validate } from '@angular/forms/signals';
import { CATEGORY_DEFAULTS, NAME_MAX_LENGTH } from '../../../../core/config/catalog.constants';
import { CategoryKind } from '../../../../core/categories/category.models';
import { Tables } from '../../../../core/supabase/database.types';

/** Values edited by `cc-category-editor` and `cc-subcategory-sheet`. */
export interface CategoryFormValue {
  name: string;
  kind: CategoryKind;
  /** Parent category id; empty for a top-level category. */
  parentId: string;
  icon: string;
  /** Palette key; null makes a subcategory use its parent's color. */
  color: string | null;
  tagIds: readonly string[];
}

/** Category columns the form edits, ready for an insert or an update. */
export interface CategoryFormRow {
  readonly name: string;
  readonly parent_id: string | null;
  readonly icon: string;
  readonly color: string | null;
}

/** Validation messages of the category form. */
export const CATEGORY_FORM_MESSAGES = {
  nameRequired: 'Ponle un nombre a la categoría.',
  nameTooLong: `Usa máximo ${NAME_MAX_LENGTH.category} caracteres.`,
  colorRequired: 'Una categoría principal necesita su propio color.',
} as const;

/** Rules of the category form; apply it to the field that holds the values. */
export const categoryFormSchema = schema<CategoryFormValue>((path) => {
  required(path.name, { message: CATEGORY_FORM_MESSAGES.nameRequired });
  validate(path.name, ({ value }) =>
    value().trim() ? undefined : { kind: 'blank', message: CATEGORY_FORM_MESSAGES.nameRequired },
  );
  maxLength(path.name, NAME_MAX_LENGTH.category, {
    message: CATEGORY_FORM_MESSAGES.nameTooLong,
  });
  // Spec §4.3: only subcategories inherit the color of their parent.
  validate(path.color, ({ value, valueOf }) =>
    value() === null && !valueOf(path.parentId)
      ? { kind: 'required', message: CATEGORY_FORM_MESSAGES.colorRequired }
      : undefined,
  );
});

/** Starting values of a new category; a subcategory inherits its parent's color. */
export function newCategoryFormValue(kind: CategoryKind, parentId = ''): CategoryFormValue {
  return {
    name: '',
    kind,
    parentId,
    icon: CATEGORY_DEFAULTS.icon,
    color: parentId ? null : CATEGORY_DEFAULTS.color,
    tagIds: [],
  };
}

/** Form values of a saved category. */
export function categoryToFormValue(
  category: Pick<Tables<'categories'>, 'name' | 'kind' | 'parent_id' | 'icon' | 'color'>,
  tagIds: readonly string[],
): CategoryFormValue {
  return {
    name: category.name,
    kind: category.kind,
    parentId: category.parent_id ?? '',
    icon: category.icon,
    color: category.color,
    tagIds: [...tagIds],
  };
}

/** Columns to save. */
export function categoryFormToRow(value: CategoryFormValue): CategoryFormRow {
  return {
    name: value.name.trim(),
    parent_id: value.parentId || null,
    icon: value.icon,
    color: value.color,
  };
}
