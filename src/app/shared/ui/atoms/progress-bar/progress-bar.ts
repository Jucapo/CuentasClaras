import { Component, computed, input } from '@angular/core';

/** Color of a progress bar: `error` when a budget was exceeded, `positive` for good news. */
export type ProgressTone = 'primary' | 'error' | 'positive';

/**
 * A horizontal bar that fills with `value` (0 to 1; above 1 it stays full), e.g. how much of a
 * budget was spent. The accessible name says what it measures.
 */
@Component({
  selector: 'cc-progress-bar',
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.scss',
  host: {
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-label]': 'label()',
    '[attr.aria-valuenow]': 'clampedPercent()',
    '[attr.aria-valuetext]': 'percent() + " %"',
    '[class]': 'tone() + " " + size()',
    '[style.--cc-progress-value]': 'fill()',
  },
})
export class ProgressBar {
  /** Share reached, e.g. 0.8 for 80 %; may exceed 1. */
  readonly value = input.required<number>();
  readonly label = input.required<string>();
  readonly tone = input<ProgressTone>('primary');
  readonly size = input<'md' | 'lg'>('md');

  protected readonly fill = computed(() => Math.min(Math.max(this.value(), 0), 1));
  protected readonly percent = computed(() => Math.round(Math.max(this.value(), 0) * 100));
  protected readonly clampedPercent = computed(() => Math.min(this.percent(), 100));
}
