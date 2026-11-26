import { Component, ElementRef, input, model, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { IsoDate } from '../../../../domain/dates/local-date';
import { FormControlBase } from '../form-control-base';

/** Date input whose value is a local `YYYY-MM-DD` string, never converted between time zones. */
@Component({
  selector: 'cc-date-field',
  imports: [MatFormField, MatLabel, MatInput, MatHint, MatError],
  templateUrl: './date-field.html',
  styleUrl: './date-field.scss',
})
export class DateField extends FormControlBase implements FormValueControl<IsoDate> {
  readonly value = model<IsoDate>('');
  /** Earliest allowed date, `YYYY-MM-DD`. */
  readonly minDate = input<IsoDate>();
  /** Latest allowed date, `YYYY-MM-DD`. */
  readonly maxDate = input<IsoDate>();

  private readonly inputElement = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly matInput = viewChild.required(MatInput);

  focus(options?: FocusOptions): void {
    this.inputElement().nativeElement.focus(options);
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected override errorStateTarget(): MatInput {
    return this.matInput();
  }
}
