import { Component, input, model, viewChild } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatOption } from '@angular/material/core';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatSelect } from '@angular/material/select';
import { FormControlBase } from '../form-control-base';

/** One choice of a `cc-select`. */
export interface SelectOption<T> {
  readonly value: T;
  readonly label: string;
}

/** Dropdown that binds to Signal Forms with [formField]. */
@Component({
  selector: 'cc-select',
  imports: [MatFormField, MatLabel, MatSelect, MatOption, MatHint, MatError],
  templateUrl: './select.html',
  styleUrl: './select.scss',
})
export class Select<T> extends FormControlBase implements FormValueControl<T> {
  readonly value = model.required<T>();
  readonly options = input.required<readonly SelectOption<T>[]>();

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
