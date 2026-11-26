import { Component, computed, input, model, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatOptgroup, MatOption } from '@angular/material/core';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatSelect } from '@angular/material/select';
import { FormControlBase } from '../form-control-base';

/** One choice of a `cc-select`. */
export interface SelectOption<T> {
  readonly value: T;
  readonly label: string;
  /** Options with the same group are shown together under that heading, in order. */
  readonly group?: string;
}

interface OptionSection<T> {
  readonly group: string | null;
  readonly options: readonly SelectOption<T>[];
}

/** Dropdown that binds to Signal Forms with [formField]. */
@Component({
  selector: 'cc-select',
  imports: [MatFormField, MatLabel, MatSelect, MatOption, MatOptgroup, MatHint, MatError],
  templateUrl: './select.html',
  styleUrl: './select.scss',
})
export class Select<T> extends FormControlBase implements FormValueControl<T> {
  readonly value = model.required<T>();
  readonly options = input.required<readonly SelectOption<T>[]>();

  /** Consecutive options of the same group, so groups keep the order of the options. */
  protected readonly sections = computed(() => {
    const sections: { group: string | null; options: SelectOption<T>[] }[] = [];
    for (const option of this.options()) {
      const group = option.group ?? null;
      const last = sections.at(-1);
      if (last && last.group === group) {
        last.options.push(option);
      } else {
        sections.push({ group, options: [option] });
      }
    }
    return sections as readonly OptionSection<T>[];
  });

  private readonly select = viewChild.required(MatSelect);

  focus(options?: FocusOptions): void {
    this.select().focus(options);
  }

  protected onOpenedChange(opened: boolean): void {
    if (!opened) {
      this.touch.emit();
    }
  }

  protected override errorStateTarget(): MatSelect {
    return this.select();
  }
}
