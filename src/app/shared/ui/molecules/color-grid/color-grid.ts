import { Component, input, model } from '@angular/core';
import { ColorSwatch } from '../../atoms/color-swatch/color-swatch';
import { COLOR_PALETTE } from '../../colors/color-palette';
import { UI_TEXT } from '../../ui.constants';

/**
 * The color palette as a grid (spec §13.3). With `inheritFrom` (a subcategory) the first swatch is
 * "same as the category", which sets the value to null.
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

  protected readonly palette = COLOR_PALETTE;
  protected readonly text = UI_TEXT;
}
