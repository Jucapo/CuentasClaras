import { Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** Icon sizes, mapped to the --cc-icon-size-* tokens. */
export type IconSize = 'sm' | 'md' | 'lg';

/** Material Symbols icon. Decorative unless it gets a `label`. */
@Component({
  selector: 'cc-icon',
  imports: [MatIcon],
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  host: {
    '[class]': "'size-' + size()",
    '[attr.role]': "label() ? 'img' : null",
    '[attr.aria-label]': 'label() ?? null',
    '[attr.aria-hidden]': "label() ? null : 'true'",
  },
})
export class Icon {
  /** Material Symbols ligature, e.g. `savings`. */
  readonly name = input.required<string>();
  readonly size = input<IconSize>('md');
  /** Accessible name; omit it for decorative icons. */
  readonly label = input<string>();
}
