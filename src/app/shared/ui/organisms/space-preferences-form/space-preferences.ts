import { maxLength, required, schema, validate } from '@angular/forms/signals';
import { SPACE_NAME_MAX_LENGTH } from '../../../../core/config/space.constants';
import { Weekday } from '../../../../core/spaces/space.models';

/** Values edited by `cc-space-preferences-form`. */
export interface SpacePreferences {
  name: string;
  mainCurrency: string;
  monthStartDay: number;
  weekStart: Weekday;
}

/** Validation messages of the space preferences. */
export const SPACE_PREFERENCES_MESSAGES = {
  nameRequired: 'Ponle un nombre al espacio.',
  nameTooLong: `Usa máximo ${SPACE_NAME_MAX_LENGTH} caracteres.`,
} as const;

/** Rules of the space preferences; apply it to the field that holds them. */
export const spacePreferencesSchema = schema<SpacePreferences>((path) => {
  required(path.name, { message: SPACE_PREFERENCES_MESSAGES.nameRequired });
  validate(path.name, ({ value }) =>
    value().trim()
      ? undefined
      : { kind: 'blank', message: SPACE_PREFERENCES_MESSAGES.nameRequired },
  );
  maxLength(path.name, SPACE_NAME_MAX_LENGTH, { message: SPACE_PREFERENCES_MESSAGES.nameTooLong });
  required(path.mainCurrency);
});
