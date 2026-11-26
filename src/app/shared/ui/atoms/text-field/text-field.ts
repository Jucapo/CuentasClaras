import { Component, ElementRef, input, model, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { FormControlBase } from '../form-control-base';

/** Input types supported by the text field. */
export type TextFieldType = 'text' | 'email' | 'search' | 'tel' | 'url';

/** Single-line text input that binds to Signal Forms with [formField]. */
@Component({
  selector: 'cc-text-field',
  imports: [MatFormField, MatLabel, MatInput, MatHint, MatError],
  templateUrl: './text-field.html',
  styleUrl: './text-field.scss',
})
export class TextField extends FormControlBase implements FormValueControl<string> {
  readonly value = model('');
  readonly maxLength = input<number | undefined>(undefined);
  readonly type = input<TextFieldType>('text');
  readonly autocomplete = input<string>('off');
  readonly placeholder = input('');
  readonly inputMode = input<string>();

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
