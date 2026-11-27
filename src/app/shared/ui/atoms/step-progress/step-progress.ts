import { Component, computed, input } from '@angular/core';

/** State of one segment of `cc-step-progress`. */
export type StepProgressState = 'done' | 'current' | 'pending';

/** Segmented bar with one segment per step: done, current and pending. */
@Component({
  selector: 'cc-step-progress',
  templateUrl: './step-progress.html',
  styleUrl: './step-progress.scss',
})
export class StepProgress {
  readonly states = input.required<readonly StepProgressState[]>();
  /** Accessible text, e.g. "Paso 3 de 7". */
  readonly label = input.required<string>();

  protected readonly current = computed(() => this.states().indexOf('current') + 1 || null);
}
