import { Component, ElementRef, inject, input, model, viewChild } from '@angular/core';
import { FormValueControl, transformedValue, ValidationError } from '@angular/forms/signals';
import {
  MatError,
  MatFormField,
  MatHint,
  MatLabel,
  MatPrefix,
  MatSuffix,
} from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { formatDecimal, MoneyParseError, parseDecimal } from '../../../../domain/money/money';
import { NUMBER_FORMAT_SEPARATORS } from '../../../../domain/money/number-format';
import { MONEY_FORMAT } from '../../money/money-format';
import { MONEY_PARSE_MESSAGES } from '../../ui.constants';
import { FormControlBase } from '../form-control-base';

/**
 * A decimal number that is not money, such as an exchange rate or a monthly rate, with the user's
 * separators and up to `decimals` decimals. Binds a number (null when empty) with [formField].
 */
@Component({
  selector: 'cc-decimal-field',
  imports: [MatFormField, MatLabel, MatInput, MatPrefix, MatSuffix, MatHint, MatError],
  templateUrl: './decimal-field.html',
  styleUrl: './decimal-field.scss',
})
export class DecimalField extends FormControlBase implements FormValueControl<number | null> {
  readonly value = model<number | null>(null);
  readonly decimals = input(2);
  /** Text before the number, e.g. "1 US$ =". */
  readonly prefix = input('');
  /** Text after the number, e.g. "%" or "$". */
  readonly suffix = input('');

  private readonly format = inject(MONEY_FORMAT);
  private readonly inputElement = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly matInput = viewChild.required(MatInput);

  protected readonly text = transformedValue(this.value, {
    parse: (raw: string) => {
      const result = parseDecimal(raw, this.decimals(), this.format().numberFormat);
      return result.ok ? { value: result.value } : { error: this.parseError(result.error) };
    },
    format: (value: number | null) =>
      value === null ? '' : formatDecimal(value, this.decimals(), this.format().numberFormat),
  });

  focus(options?: FocusOptions): void {
    this.inputElement().nativeElement.focus(options);
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
  }

  protected onBlur(): void {
    if (this.text.parseErrors().length === 0) {
      const value = this.value();
      this.text.set(
        value === null ? '' : formatDecimal(value, this.decimals(), this.format().numberFormat),
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
          ? messages.too_many_decimals(this.decimals())
          : error === 'negative'
            ? messages.negativeNumber
            : messages[error];
    return { kind: 'decimal', message };
  }
}
