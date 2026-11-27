import { Component, computed, input } from '@angular/core';
import { Skeleton } from '../../atoms/skeleton/skeleton';

/**
 * Placeholder rows while a list loads (spec §13.4): an icon and two lines each, or plain blocks.
 * Announced once for the whole list.
 */
@Component({
  selector: 'cc-skeleton-list',
  imports: [Skeleton],
  templateUrl: './skeleton-list.html',
  styleUrl: './skeleton-list.scss',
  host: { role: 'status', '[attr.aria-label]': 'label()' },
})
export class SkeletonList {
  readonly rows = input(4);
  /** Rows with a round icon, as accounts and movements; blocks otherwise, as summaries. */
  readonly variant = input<'rows' | 'blocks'>('rows');
  readonly label = input('Cargando');

  protected readonly items = computed(() =>
    Array.from({ length: this.rows() }, (_, index) => index),
  );
}
