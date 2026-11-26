import { Component, computed, inject, input, model } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { ColorSwatch } from '../../atoms/color-swatch/color-swatch';
import { FormControlBase } from '../../atoms/form-control-base';
import { colorLabel, colorOrFallback } from '../../colors/color-palette';
import { OverlayService } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { PickerTrigger } from '../picker-trigger/picker-trigger';
import { ColorPick, ColorPickerData, ColorPickerPanel } from './color-picker-panel';

/**
 * Color field: shows the current palette color and opens the palette grid. With `inheritFrom`
 * (a subcategory) the value may be null, meaning "same as the category".
 */
@Component({
  selector: 'cc-color-picker',
  imports: [PickerTrigger, ColorSwatch],
  templateUrl: './color-picker.html',
})
export class ColorPicker extends FormControlBase implements FormValueControl<string | null> {
  /** Palette key, or null to inherit. */
  readonly value = model<string | null>(null);
  /** Color of the parent; when set, the value may be null to inherit it. */
  readonly inheritFrom = input<string | null>(null);

  private readonly overlay = inject(OverlayService);

  /** Color shown in the preview: its own, or the inherited one. */
  protected readonly shownColor = computed(() => this.value() ?? this.inheritFrom());
  protected readonly valueText = computed(() => {
    const value = this.value();
    if (value !== null) {
      return colorLabel(colorOrFallback(value));
    }
    const parent = this.inheritFrom();
    return parent ? `${UI_TEXT.inheritColor} (${colorLabel(colorOrFallback(parent))})` : '';
  });

  protected async open(): Promise<void> {
    if (this.disabled()) {
      return;
    }
    const picked = await this.overlay.open<ColorPick, ColorPickerData>(ColorPickerPanel, {
      label: this.label(),
      data: {
        title: this.label(),
        selected: this.value(),
        allowInherit: this.inheritFrom() !== null,
      },
    });
    if (picked) {
      this.value.set(picked.color);
    }
    this.touch.emit();
  }
}
