import { Component, computed, input } from '@angular/core';
import { colorOrFallback, paletteColor } from '../../colors/color-palette';

/** Color of a progress bar: `error` when a budget was exceeded, `positive` for good news. */
export type ProgressTone = 'primary' | 'error' | 'positive';

/**
 * A bar that fills with `value` (0 to 1; above 1 it stays full), e.g. how much of a budget was
 * spent. As a `backdrop` it fills the background of its row (spec §4.7) in a soft tone of `color`,
 * a palette key; the row sets `position: relative` and `isolation: isolate`. The accessible name
 * says what it measures.
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
    '[class]': 'tone() + " " + size() + " " + variant()',
    '[style.--cc-progress-value]': 'fill()',
    '[style.--cc-progress-tint]': 'tint()',
  },
})
export class ProgressBar {
  /** Share reached, e.g. 0.8 for 80 %; may exceed 1. */
  readonly value = input.required<number>();
  readonly label = input.required<string>();
  readonly tone = input<ProgressTone>('primary');
  readonly size = input<'md' | 'lg'>('md');
  readonly variant = input<'bar' | 'backdrop'>('bar');
  /** Palette key whose soft tone fills a backdrop. */
  readonly color = input<string | null>(null);

  protected readonly fill = computed(() => Math.min(Math.max(this.value(), 0), 1));
  protected readonly percent = computed(() => Math.round(Math.max(this.value(), 0) * 100));
  protected readonly clampedPercent = computed(() => Math.min(this.percent(), 100));
  protected readonly tint = computed(() => {
    const color = this.color();
    return color ? paletteColor(colorOrFallback(color)) : null;
  });
}
