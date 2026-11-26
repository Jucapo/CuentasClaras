import { Component, computed, ElementRef, input, model, signal, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatIconButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { iconGlyph } from '../../icons/icon-glyphs';
import { UI_TEXT } from '../../ui.constants';
import { FormControlBase } from '../form-control-base';

/** Password input with a show/hide toggle; binds to Signal Forms with [formField]. */
@Component({
  selector: 'cc-password-field',
  imports: [MatFormField, MatLabel, MatInput, MatHint, MatError, MatSuffix, MatIconButton, MatIcon],
  templateUrl: './password-field.html',
  styleUrl: './password-field.scss',
})
export class PasswordField extends FormControlBase implements FormValueControl<string> {
  readonly value = model('');
  /** `current-password` for sign-in, `new-password` when choosing one. */
  readonly autocomplete = input<'current-password' | 'new-password'>('current-password');

  protected readonly revealed = signal(false);
  protected readonly toggleLabel = computed(() =>
    this.revealed() ? UI_TEXT.hidePassword : UI_TEXT.showPassword,
  );
  protected readonly toggleGlyph = computed(() =>
    iconGlyph(this.revealed() ? 'visibility_off' : 'visibility'),
  );

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
