import { Component, inject } from '@angular/core';
import { ColorSwatch } from '../../atoms/color-swatch/color-swatch';
import { COLOR_PALETTE } from '../../colors/color-palette';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { OverlayPanel } from '../overlay-panel/overlay-panel';

/** Data of the color picker panel. */
export interface ColorPickerData {
  readonly title: string;
  readonly selected: string | null;
  /** Offers "same as the category" (null) when set. */
  readonly allowInherit: boolean;
}

/** What the color panel returns: a palette key, or null for "same as the category". */
export interface ColorPick {
  readonly color: string | null;
}

/** Content of the color picker overlay: the palette as a grid. */
@Component({
  selector: 'cc-color-picker-panel',
  imports: [OverlayPanel, ColorSwatch],
  templateUrl: './color-picker-panel.html',
  styleUrl: './color-picker-panel.scss',
})
export class ColorPickerPanel {
  protected readonly data = inject<ColorPickerData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<ColorPick>>(OverlayHandle);

  protected readonly palette = COLOR_PALETTE;
  protected readonly inheritLabel = UI_TEXT.inheritColor;

  protected pick(color: string | null): void {
    this.handle.close({ color });
  }

  protected close(): void {
    this.handle.close();
  }
}
