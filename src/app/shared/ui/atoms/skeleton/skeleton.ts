import { Component, input } from '@angular/core';

/**
 * A placeholder that stands for content on its way (spec §13.4), instead of an empty screen or a
 * "$ 0": a line of text, a circle (an icon or a bubble) or a block. It shimmers unless motion is
 * reduced. Silent for assistive technology unless it gets a `label`, e.g. "Cargando", which it
 * announces once; groups of skeletons announce it once for all.
 */
@Component({
  selector: 'cc-skeleton',
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.scss',
  host: {
    '[class]': "'shape-' + shape()",
    '[attr.role]': "label() ? 'status' : null",
    '[attr.aria-hidden]': "label() ? null : 'true'",
  },
})
export class Skeleton {
  readonly shape = input<'text' | 'circle' | 'block'>('text');
  /** Announced while it shows; none for skeletons inside a group that already says it. */
  readonly label = input<string>();
}
