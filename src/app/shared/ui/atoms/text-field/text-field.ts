import { Component, ElementRef, input, model, output, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import {
  MatError,
  MatFormField,
  MatHint,
  MatLabel,
  MatPrefix,
  MatSuffix,
} from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { IconName } from '../../icons/icon-glyphs';
import { FormControlBase } from '../form-control-base';
import { IconButton } from '../icon-button/icon-button';

/** Input types supported by the text field. */
export type TextFieldType = 'text' | 'email' | 'search' | 'tel' | 'url';

/**
 * Single-line text input that binds to Signal Forms with [formField]. `outline` draws a rounded
 * border instead of the filled field, and `center` centers what is typed and its placeholder, as
 * the note of the quick entry (spec §7). An optional action sits at the end, e.g. the tags.
 */
@Component({
  selector: 'cc-text-field',
  imports: [MatFormField, MatLabel, MatInput, MatHint, MatError, MatPrefix, MatSuffix, IconButton],
  templateUrl: './text-field.html',
  styleUrl: './text-field.scss',
  host: {
    '[class.outline]': "appearance() === 'outline'",
    '[class.center]': "align() === 'center'",
  },
})
export class TextField extends FormControlBase implements FormValueControl<string> {
  readonly value = model('');
  readonly maxLength = input<number | undefined>(undefined);
  readonly type = input<TextFieldType>('text');
  readonly autocomplete = input<string>('off');
  readonly placeholder = input('');
  readonly inputMode = input<string>();
  readonly appearance = input<'fill' | 'outline'>('fill');
  readonly align = input<'start' | 'center'>('start');
  /**
   * Keeps the label only for assistive technology, when the placeholder already says what goes in
   * (e.g. "Notas…"). The label stays required.
   */
  readonly hideLabel = input(false);
  /** Icon of the action at the end of the field; none by default. */
  readonly actionIcon = input<IconName | null>(null);
  /** Accessible name of the action; the label by default. */
  readonly actionLabel = input<string>();
  readonly action = output<void>();

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
