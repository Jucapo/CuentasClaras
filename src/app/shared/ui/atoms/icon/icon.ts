import { Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { iconGlyph, IconName } from '../../icons/icon-glyphs';

/** Icon sizes, mapped to the --cc-icon-size-* tokens. */
export type IconSize = 'sm' | 'md' | 'lg';

/** Material Symbols icon, rendered by codepoint. Decorative unless it gets a `label`. */
@Component({
  selector: 'cc-icon',
  imports: [MatIcon],
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  host: {
    '[class]': "'size-' + size()",
    '[class.filled]': 'filled()',
    '[attr.data-icon]': 'name()',
    '[attr.role]': "label() ? 'img' : null",
    '[attr.aria-label]': 'label() ?? null',
    '[attr.aria-hidden]': "label() ? null : 'true'",
  },
})
export class Icon {
  /** Icon of the font subset, e.g. `savings`. */
  readonly name = input.required<IconName>();
  readonly size = input<IconSize>('md');
  /** Filled instead of outlined (the font keeps the FILL axis). */
  readonly filled = input(false);
  /** Accessible name; omit it for decorative icons. */
  readonly label = input<string>();

  protected readonly glyph = computed(() => iconGlyph(this.name()));
}
