import { afterRenderEffect, computed, Directive, input, output } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';
import { ErrorStateMatcher } from '@angular/material/core';
import { UI_TEXT } from '../ui.constants';

let nextControlId = 0;

/** A Material control whose error styling can be refreshed on demand (MatInput, MatSelect). */
interface ErrorStateTarget {
  updateErrorState(): void;
}

/** Inputs and outputs shared by every Signal Forms control of the design system. */
@Directive()
export abstract class FormControlBase {
  /** Visible label; every field has one (spec §13.4). */
  readonly label = input.required<string>();
  /** Helper text shown under the field while it has no error. */
  readonly hint = input<string>();

  // Bound automatically by the [formField] directive.
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly touched = input(false);
  readonly disabled = input(false);
  readonly required = input(false);
  readonly name = input('');
  readonly touch = output<void>();

  /** Unique id for the native control. */
  protected readonly controlId = `cc-control-${nextControlId++}`;

  /** First error message, shown only after the user leaves the field. */
  protected readonly errorMessage = computed(() => {
    if (!this.touched()) {
      return null;
    }
    const [first] = this.errors();
    return first ? (first.message ?? UI_TEXT.invalidField) : null;
  });

  /** Drives Material's error styling from the Signal Forms state instead of an NgControl. */
  protected readonly errorStateMatcher: ErrorStateMatcher = {
    isErrorState: () => this.errorMessage() !== null,
  };

  constructor() {
    // Material only re-evaluates the error state in ngDoCheck when it has an NgControl, which
    // Signal Forms controls do not use, so it is refreshed whenever the message changes.
    afterRenderEffect(() => {
      this.errorMessage();
      this.errorStateTarget()?.updateErrorState();
    });
  }

  /** The Material control that renders the error state, if any. */
  protected errorStateTarget(): ErrorStateTarget | undefined {
    return undefined;
  }
}
