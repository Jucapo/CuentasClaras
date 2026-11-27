import { Component, input, model } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatChipListbox, MatChipListboxChange, MatChipOption } from '@angular/material/chips';
import { ColorSwatch } from '../../atoms/color-swatch/color-swatch';
import { FormControlBase } from '../../atoms/form-control-base';

/** One chip of a `cc-chip-select`. */
export interface ChipOption {
  readonly value: string;
  readonly label: string;
  /** Palette key shown as a dot before the label. */
  readonly color?: string;
  /** Icon before the label instead of the dot, e.g. a subcategory's in the quick entry. */
  readonly icon?: string;
}

let nextChipSelectId = 0;

/** Multiple choice shown as chips, e.g. default tags. Binds a string array with [formField]. */
@Component({
  selector: 'cc-chip-select',
  imports: [MatChipListbox, MatChipOption, ColorSwatch],
  templateUrl: './chip-select.html',
  styleUrl: './chip-select.scss',
})
export class ChipSelect extends FormControlBase implements FormValueControl<readonly string[]> {
  readonly value = model<readonly string[]>([]);
  readonly options = input.required<readonly ChipOption[]>();
  /** Shown when there are no options to pick. */
  readonly emptyText = input('');
  /** Keeps the label only for assistive technology, when the context already names the choice. */
  readonly hideLabel = input(false);

  protected readonly labelId = `cc-chip-select-${nextChipSelectId++}`;

  protected onChange(event: MatChipListboxChange): void {
    this.value.set([...(event.value as string[])]);
    this.touch.emit();
  }
}
