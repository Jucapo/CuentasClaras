import { Component, computed, input, model, viewChild } from '@angular/core';
import { FormCheckboxControl } from '@angular/forms/signals';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { IconName } from '../../icons/icon-glyphs';
import { Icon } from '../icon/icon';
import { FormControlBase } from '../form-control-base';

/**
 * On/off toggle that binds a boolean field with [formField]. `row` lays it out as a list row:
 * optional icon, label, and the toggle at the end (spec §13.5).
 */
@Component({
  selector: 'cc-switch',
  imports: [MatSlideToggle, Icon],
  templateUrl: './switch.html',
  styleUrl: './switch.scss',
  host: { '[class.row]': 'row()' },
})
export class Switch extends FormControlBase implements FormCheckboxControl {
  readonly checked = model(false);
  readonly row = input(false);
  /** Leading icon of the row layout. */
  readonly icon = input<IconName>();

  protected readonly hintId = computed(() => (this.hint() ? `${this.controlId}-hint` : ''));
  protected readonly labelId = `${this.controlId}-label`;
  /** MatSlideToggle names its inner button `<id>-button`. */
  protected readonly buttonId = `${this.controlId}-button`;

  private readonly toggle = viewChild.required(MatSlideToggle);

  focus(): void {
    this.toggle().focus();
  }
}
