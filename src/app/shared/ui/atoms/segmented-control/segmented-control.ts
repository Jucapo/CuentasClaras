import { Component, input, model, output } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';

/** One segment of a `cc-segmented-control`. */
export interface SegmentOption<T> {
  readonly value: T;
  readonly label: string;
}

/** Single choice among a few options, e.g. Gastos / Ingresos. Binds with [formField] or [(value)]. */
@Component({
  selector: 'cc-segmented-control',
  imports: [MatButtonToggleGroup, MatButtonToggle],
  templateUrl: './segmented-control.html',
  styleUrl: './segmented-control.scss',
  host: { '[class.full-width]': 'fullWidth()' },
})
export class SegmentedControl<T> implements FormValueControl<T> {
  readonly value = model.required<T>();
  readonly options = input.required<readonly SegmentOption<T>[]>();
  /** Accessible name of the group. */
  readonly label = input.required<string>();
  readonly disabled = input(false);
  readonly fullWidth = input(false);
  readonly touch = output<void>();
}
