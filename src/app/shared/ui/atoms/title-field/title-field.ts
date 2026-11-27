import { afterNextRender, Component, ElementRef, input, model, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FormControlBase } from '../form-control-base';

/**
 * Large name input for the header of a flow (spec §13.5). With `autofocus` it takes the focus
 * once rendered, which opens the keyboard on phones; flows use it only when creating.
 */
@Component({
  selector: 'cc-title-field',
  templateUrl: './title-field.html',
  styleUrl: './title-field.scss',
})
export class TitleField extends FormControlBase implements FormValueControl<string> {
  readonly value = model('');
  readonly maxLength = input<number | undefined>(undefined);
  readonly placeholder = input('');
  readonly autofocus = input(false);

  private readonly inputElement = viewChild.required<ElementRef<HTMLInputElement>>('input');

  constructor() {
    super();
    afterNextRender(() => {
      if (this.autofocus()) {
        this.focus();
      }
    });
  }

  focus(options?: FocusOptions): void {
    this.inputElement().nativeElement.focus(options);
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
