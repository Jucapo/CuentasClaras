import { Component, input, model } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatChipListbox, MatChipListboxChange, MatChipOption } from '@angular/material/chips';
import { ColorSwatch } from '../../atoms/color-swatch/color-swatch';
import { FormControlBase } from '../../atoms/form-control-base';
import { ChipOption } from '../chip-select/chip-select';

let nextChipChoiceId = 0;

/**
 * Single choice shown as chips in one scrolling row, e.g. the subcategory of a movement. Binds a
 * string (null when nothing is picked) with [formField]; without `allowNone` tapping the picked
 * chip keeps it. Styled like `cc-chip-select`, whose value is a list instead.
 */
@Component({
  selector: 'cc-chip-choice',
  imports: [MatChipListbox, MatChipOption, ColorSwatch],
  templateUrl: './chip-choice.html',
  styleUrl: './chip-choice.scss',
})
export class ChipChoice extends FormControlBase implements FormValueControl<string | null> {
  readonly value = model<string | null>(null);
  readonly options = input.required<readonly ChipOption[]>();
  readonly allowNone = input(false);
  /** Hides the visible label when the context already names the choice. */
  readonly hideLabel = input(false);

  protected readonly labelId = `cc-chip-choice-${nextChipChoiceId++}`;

  protected onChange(event: MatChipListboxChange, listbox: MatChipListbox): void {
    const picked = (event.value as string | undefined) ?? null;
    if (picked === null && !this.allowNone()) {
      // Material deselects a chip tapped twice; put the selection back.
      listbox.value = this.value();
      return;
    }
    this.value.set(picked);
    this.touch.emit();
  }
}
