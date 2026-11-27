import { Component, computed, input } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import {
  MONTH_START_DAY_RANGE,
  monthStartDayHint,
  WEEKDAYS,
} from '../../../../core/config/space.constants';
import { Weekday } from '../../../../core/spaces/space.models';
import { CurrencySelect } from '../../atoms/currency-select/currency-select';
import { Select, SelectOption } from '../../atoms/select/select';
import { TextField } from '../../atoms/text-field/text-field';
import { SpacePreferences } from './space-preferences';

/** Fields of a space: name, main currency and the first day of the month and of the week. */
@Component({
  selector: 'cc-space-preferences-form',
  imports: [FormField, TextField, Select, CurrencySelect],
  templateUrl: './space-preferences-form.html',
  styleUrl: './space-preferences-form.scss',
})
export class SpacePreferencesForm {
  /** Field tree holding the preferences; validate it with `spacePreferencesSchema`. */
  readonly fields = input.required<FieldTree<SpacePreferences>>();
  /** Help under the fields, for the first time (the wizard); off in Configuración (spec §13.5). */
  readonly hints = input(true);

  protected readonly monthDayOptions: readonly SelectOption<number>[] = Array.from(
    { length: MONTH_START_DAY_RANGE.max - MONTH_START_DAY_RANGE.min + 1 },
    (_, index) => {
      const day = MONTH_START_DAY_RANGE.min + index;
      return { value: day, label: String(day) };
    },
  );
  protected readonly weekdayOptions: readonly SelectOption<Weekday>[] = WEEKDAYS;
  protected readonly monthHint = computed(() =>
    monthStartDayHint(this.fields().monthStartDay().value()),
  );
}
