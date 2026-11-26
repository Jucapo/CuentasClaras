import { Component, computed, ElementRef, inject, input, model, viewChild } from '@angular/core';
import { FormValueControl, transformedValue, ValidationError } from '@angular/forms/signals';
import { MatError, MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { currencyMinorUnits, currencySymbol } from '../../../../domain/money/currencies';
import { formatAmountInput, MoneyParseError, parseMoney } from '../../../../domain/money/money';
import { NUMBER_FORMAT_SEPARATORS } from '../../../../domain/money/number-format';
import { MONEY_FORMAT } from '../../money/money-format';
import { MONEY_PARSE_MESSAGES } from '../../ui.constants';
import { FormControlBase } from '../form-control-base';

/**
 * Amount input in minor units (null when empty). It reads and writes the user's number format and
 * reports what it cannot read as a parse error of the bound field.
 */
@Component({
  selector: 'cc-money-field',
  imports: [MatFormField, MatLabel, MatInput, MatPrefix, MatHint, MatError],
  templateUrl: './money-field.html',
  styleUrl: './money-field.scss',
})
export class MoneyField extends FormControlBase implements FormValueControl<number | null> {
  readonly value = model<number | null>(null);
  readonly currency = input.required<string>();
  readonly allowNegative = input(false);
  readonly placeholder = input('');

  private readonly format = inject(MONEY_FORMAT);
  private readonly inputElement = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly matInput = viewChild.required(MatInput);

  protected readonly symbol = computed(() => currencySymbol(this.currency()));
  protected readonly text = transformedValue(this.value, {
    parse: (raw: string) => {
      const result = parseMoney(raw, this.currency(), this.format().numberFormat, {
        allowNegative: this.allowNegative(),
      });
      return result.ok ? { value: result.value } : { error: this.parseError(result.error) };
    },
    format: (value: number | null) =>
      value === null ? '' : formatAmountInput(value, this.currency(), this.format().numberFormat),
  });

  focus(options?: FocusOptions): void {
    this.inputElement().nativeElement.focus(options);
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
  }

  protected onBlur(): void {
    // Shows the amount with its grouping once the user is done, unless it could not be read.
    if (this.text.parseErrors().length === 0) {
      const value = this.value();
      this.text.set(
        value === null ? '' : formatAmountInput(value, this.currency(), this.format().numberFormat),
      );
    }
    this.touch.emit();
  }

  protected override errorStateTarget(): MatInput {
    return this.matInput();
  }

  private parseError(error: MoneyParseError): ValidationError.WithoutFieldTree {
    const messages = MONEY_PARSE_MESSAGES;
    const message =
      error === 'grouping'
        ? messages.grouping(NUMBER_FORMAT_SEPARATORS[this.format().numberFormat].decimal)
        : error === 'too_many_decimals'
          ? messages.too_many_decimals(currencyMinorUnits(this.currency()))
          : messages[error];
    return { kind: 'money', message };
  }
}
