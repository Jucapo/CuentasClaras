import { Component, computed, input } from '@angular/core';
import { colorOrFallback, paletteColor } from '../../colors/color-palette';
import { iconOrFallback } from '../../icons/icon-glyphs';
import { Icon, IconSize } from '../icon/icon';

/** White filled icon on a palette-colored circle, as 1Money shows categories and accounts. */
@Component({
  selector: 'cc-icon-badge',
  imports: [Icon],
  templateUrl: './icon-badge.html',
  styleUrl: './icon-badge.scss',
  host: {
    '[class]': "'size-' + size()",
    '[style.--cc-badge-color]': 'background()',
  },
})
export class IconBadge {
  /** Icon key as stored in the database; unknown keys show the fallback icon. */
  readonly icon = input.required<string>();
  /** Palette key; unknown keys show the fallback color. */
  readonly color = input.required<string | null>();
  readonly size = input<IconSize>('md');
  /** Accessible name; omit it when the badge sits next to its own text. */
  readonly label = input<string>();

  protected readonly iconName = computed(() => iconOrFallback(this.icon()));
  protected readonly background = computed(() => paletteColor(colorOrFallback(this.color())));
}
