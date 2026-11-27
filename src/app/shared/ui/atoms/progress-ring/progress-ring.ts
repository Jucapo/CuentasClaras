import { Component, computed, input } from '@angular/core';
import { RING_GEOMETRY } from '../../ui.constants';

/** Color of a progress ring: `positive` for good news, `error` when it went the wrong way. */
export type RingTone = 'positive' | 'error';

/**
 * A ring that fills with `value` (0 to 1; its size when negative, and full above 1), with the
 * projected text in its middle, e.g. the savings rate of the Resumen (spec §7). It is an image:
 * the accessible name says what it shows.
 */
@Component({
  selector: 'cc-progress-ring',
  templateUrl: './progress-ring.html',
  styleUrl: './progress-ring.scss',
  host: {
    role: 'img',
    '[attr.aria-label]': 'label()',
    '[class]': 'tone()',
  },
})
export class ProgressRing {
  /** Share reached, e.g. 0.62 for 62 %; may be negative or exceed 1. */
  readonly value = input.required<number>();
  readonly label = input.required<string>();
  readonly tone = input<RingTone>('positive');

  protected readonly geometry = RING_GEOMETRY;
  protected readonly dasharray = computed(() => {
    const filled = Math.min(Math.abs(this.value()), 1) * RING_GEOMETRY.pathLength;
    return `${filled} ${RING_GEOMETRY.pathLength}`;
  });
}
