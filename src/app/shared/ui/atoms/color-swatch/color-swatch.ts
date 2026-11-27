import { Component, computed, input } from '@angular/core';
import { colorOrFallback, paletteColor, paletteForeground } from '../../colors/color-palette';
import { Icon } from '../icon/icon';

/** Round palette color; a pressable button by default, or a plain dot with `decorative`. */
@Component({
  selector: 'cc-color-swatch',
  imports: [Icon],
  templateUrl: './color-swatch.html',
  styleUrl: './color-swatch.scss',
  host: {
    '[style.--cc-swatch-color]': 'background()',
    '[style.--cc-swatch-on-color]': 'foreground()',
    '[class.decorative]': 'decorative()',
    '[class.small]': 'small()',
  },
})
export class ColorSwatch {
  /** Palette key; null shows the "inherit" swatch. */
  readonly color = input.required<string | null>();
  /** Accessible name, e.g. the color name. */
  readonly label = input.required<string>();
  readonly selected = input(false);
  /** A dot next to a label (tags) instead of a button. */
  readonly decorative = input(false);
  readonly small = input(false);

  protected readonly inherits = computed(() => this.color() === null);
  protected readonly background = computed(() => {
    const color = this.color();
    return color === null ? null : paletteColor(colorOrFallback(color));
  });
  /** The check of the selected swatch, readable on light colors too. */
  protected readonly foreground = computed(() => {
    const color = this.color();
    return color === null ? null : paletteForeground(colorOrFallback(color));
  });
}
