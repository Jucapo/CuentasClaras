import { Component, computed, input, model, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { currencyLabel, SUPPORTED_CURRENCIES } from '../../../../core/config/space.constants';
import { FormControlBase } from '../form-control-base';
import { Select, SelectOption } from '../select/select';

/** Currency picker ("Peso colombiano (COP)") that binds an ISO 4217 code with [formField]. */
@Component({
  selector: 'cc-currency-select',
  imports: [Select],
  templateUrl: './currency-select.html',
})
export class CurrencySelect extends FormControlBase implements FormValueControl<string> {
  readonly value = model('');
  /** Currencies offered; by default the ones the app supports. */
  readonly currencies = input<readonly string[]>(SUPPORTED_CURRENCIES);

  protected readonly options = computed<readonly SelectOption<string>[]>(() =>
    this.currencies().map((code) => ({ value: code, label: currencyLabel(code) })),
  );

  private readonly select = viewChild.required(Select);

  focus(options?: FocusOptions): void {
    this.select().focus(options);
  }
}
