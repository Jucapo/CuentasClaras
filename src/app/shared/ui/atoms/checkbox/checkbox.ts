import { Component, input, model } from '@angular/core';
import { FormCheckboxControl } from '@angular/forms/signals';
import { MatCheckbox } from '@angular/material/checkbox';
import { IconBadge } from '../icon-badge/icon-badge';
import { FormControlBase } from '../form-control-base';

/**
 * Check box with its label, optionally led by an icon badge (e.g. a category in a checklist).
 * Binds a boolean field with [formField], or `checked` directly.
 */
@Component({
  selector: 'cc-checkbox',
  imports: [MatCheckbox, IconBadge],
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.scss',
})
export class Checkbox extends FormControlBase implements FormCheckboxControl {
  readonly checked = model(false);
  /** Icon key of a leading badge. */
  readonly icon = input<string>();
  /** Palette key of the badge. */
  readonly color = input<string | null>(null);
}
