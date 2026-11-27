import { Component, computed, input, model } from '@angular/core';
import { ColorSwatch } from '../../atoms/color-swatch/color-swatch';
import { PALETTE_TONES, resolveColorKey } from '../../colors/color-palette';
import { UI_TEXT } from '../../ui.constants';

/**
 * The palette as a grid of tone × intensity (spec §13.3): a row per tone in a narrow container and
 * a column per tone in a wide one. With `inheritFrom` (a subcategory) it first offers "same as the
 * category", which sets the value to null. A key of the first palette marks its equivalent color.
 */
@Component({
  selector: 'cc-color-grid',
  imports: [ColorSwatch],
  templateUrl: './color-grid.html',
  styleUrl: './color-grid.scss',
})
export class ColorGrid {
  /** Palette key, or null to inherit. */
  readonly value = model.required<string | null>();
  /** Color of the parent; when set, offers to inherit it. */
  readonly inheritFrom = input<string | null>(null);

  protected readonly tones = PALETTE_TONES;
  protected readonly text = UI_TEXT;
  protected readonly selected = computed(() => resolveColorKey(this.value()));
}
