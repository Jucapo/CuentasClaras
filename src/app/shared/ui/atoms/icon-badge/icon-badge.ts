import { Component, computed, input } from '@angular/core';
import { colorOrFallback, paletteColor, paletteForeground } from '../../colors/color-palette';
import { iconOrFallback } from '../../icons/icon-glyphs';
import { Icon, IconSize } from '../icon/icon';

/**
 * Filled icon on a palette-colored circle, as 1Money shows categories and accounts. The icon is
 * white, or dark on the light colors where white would not read (spec §13.3).
 */
@Component({
  selector: 'cc-icon-badge',
  imports: [Icon],
  templateUrl: './icon-badge.html',
  styleUrl: './icon-badge.scss',
  host: {
    '[class]': "'size-' + size()",
    '[style.--cc-badge-color]': 'background()',
    '[style.--cc-badge-on-color]': 'foreground()',
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
  private readonly colorKey = computed(() => colorOrFallback(this.color()));
  protected readonly background = computed(() => paletteColor(this.colorKey()));
  protected readonly foreground = computed(() => paletteForeground(this.colorKey()));
}
