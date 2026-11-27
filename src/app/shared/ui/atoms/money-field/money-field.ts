import { Component, computed, ElementRef, inject, input, model, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatError, MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { currencySymbol } from '../../../../domain/money/currencies';
import { formatAmountInput } from '../../../../domain/money/money';
import { MONEY_FORMAT } from '../../money/money-format';
import { FormControlBase } from '../form-control-base';
import { MoneyInput, moneyText } from '../money-input/money-input';

/**
 * Amount input in minor units (null when empty). It reads and writes the user's number format,
 * groups the thousands while the user types keeping the caret in place (spec §4.6), and reports
 * what it cannot read as a parse error of the bound field.
 */
@Component({
  selector: 'cc-money-field',
  imports: [MatFormField, MatLabel, MatInput, MatPrefix, MatHint, MatError, MoneyInput],
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
  protected readonly text = moneyText(this.value, {
    currency: () => this.currency(),
    allowNegative: () => this.allowNegative(),
  });

  focus(options?: FocusOptions): void {
    this.inputElement().nativeElement.focus(options);
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
}
