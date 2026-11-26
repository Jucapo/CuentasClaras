import { Component, computed, model, viewChild } from '@angular/core';
import { FormCheckboxControl } from '@angular/forms/signals';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { FormControlBase } from '../form-control-base';

/** On/off toggle that binds a boolean field with [formField]. */
@Component({
  selector: 'cc-switch',
  imports: [MatSlideToggle],
  templateUrl: './switch.html',
  styleUrl: './switch.scss',
})
export class Switch extends FormControlBase implements FormCheckboxControl {
  readonly checked = model(false);

  protected readonly hintId = computed(() => (this.hint() ? `${this.controlId}-hint` : ''));

  private readonly toggle = viewChild.required(MatSlideToggle);

  focus(): void {
    this.toggle().focus();
  }
}
