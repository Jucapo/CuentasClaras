import { maxLength, required, schema, validate } from '@angular/forms/signals';
import { NAME_MAX_LENGTH, TAG_DEFAULT_COLOR } from '../../../../core/config/catalog.constants';

/** Values edited by `cc-tag-sheet`. */
export interface TagFormValue {
  name: string;
  /** Palette key; null only while nothing is picked. */
  color: string | null;
  /** Categories and subcategories where the tag applies by default. */
  categoryIds: readonly string[];
}

/** Validation messages of the tag form. */
export const TAG_FORM_MESSAGES = {
  nameRequired: 'Ponle un nombre a la etiqueta.',
  nameTooLong: `Usa máximo ${NAME_MAX_LENGTH.tag} caracteres.`,
  colorRequired: 'Elige un color.',
} as const;

/** Rules of the tag form; apply it to the field that holds the values. */
export const tagFormSchema = schema<TagFormValue>((path) => {
  required(path.name, { message: TAG_FORM_MESSAGES.nameRequired });
  validate(path.name, ({ value }) =>
    value().trim() ? undefined : { kind: 'blank', message: TAG_FORM_MESSAGES.nameRequired },
  );
  maxLength(path.name, NAME_MAX_LENGTH.tag, { message: TAG_FORM_MESSAGES.nameTooLong });
  required(path.color, { message: TAG_FORM_MESSAGES.colorRequired });
});

/** Starting values of a new tag, optionally with a suggested name and color. */
export function newTagFormValue(preset?: { name: string; color: string }): TagFormValue {
  return { name: preset?.name ?? '', color: preset?.color ?? TAG_DEFAULT_COLOR, categoryIds: [] };
}
