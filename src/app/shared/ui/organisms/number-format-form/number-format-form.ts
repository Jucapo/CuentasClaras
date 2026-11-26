import { Component, computed, input } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { numberFormatExample } from '../../../../core/config/space.constants';
import { NUMBER_FORMATS } from '../../../../domain/money/number-format';
import { NumberFormat } from '../../../../core/spaces/space.models';
import { Select, SelectOption } from '../../atoms/select/select';
import { Switch } from '../../atoms/switch/switch';

/** Values edited by `cc-number-format-form`. */
export interface NumberFormatPreferences {
  numberFormat: NumberFormat;
  showDecimals: boolean;
}

/** How amounts look: thousands/decimal separators and whether decimals show. */
@Component({
  selector: 'cc-number-format-form',
  imports: [FormField, Select, Switch],
  templateUrl: './number-format-form.html',
  styleUrl: './number-format-form.scss',
})
export class NumberFormatForm {
  readonly fields = input.required<FieldTree<NumberFormatPreferences>>();

  /** Each option previews a sample amount, following the decimals switch. */
  protected readonly formatOptions = computed<readonly SelectOption<NumberFormat>[]>(() => {
    const showDecimals = this.fields().showDecimals().value();
    return NUMBER_FORMATS.map((format) => ({
      value: format,
      label: numberFormatExample(format, showDecimals),
    }));
  });
}
