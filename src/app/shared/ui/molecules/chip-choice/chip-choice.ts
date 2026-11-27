import { Component, computed, input, model } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { MatChipListbox, MatChipListboxChange, MatChipOption } from '@angular/material/chips';
import { ColorSwatch } from '../../atoms/color-swatch/color-swatch';
import { FormControlBase } from '../../atoms/form-control-base';
import { Icon } from '../../atoms/icon/icon';
import {
  colorOrFallback,
  paletteColor,
  paletteLargeTextColor,
  paletteOnColorText,
  paletteTextColor,
} from '../../colors/color-palette';
import { iconOrFallback } from '../../icons/icon-glyphs';
import { ChipOption } from '../chip-select/chip-select';

let nextChipChoiceId = 0;

/**
 * Single choice shown as chips in one scrolling row, e.g. the subcategory of a movement. Binds a
 * string (null when nothing is picked) with [formField]; without `allowNone` tapping the picked
 * chip keeps it. Styled like `cc-chip-select`, whose value is a list instead. With `accent`, a
 * palette key, the chips take that color and the picked one is filled with it (spec §7).
 */
@Component({
  selector: 'cc-chip-choice',
  imports: [MatChipListbox, MatChipOption, ColorSwatch, Icon],
  templateUrl: './chip-choice.html',
  styleUrl: './chip-choice.scss',
  host: {
    '[class.accented]': 'accent() !== null',
    '[style.--cc-chip-accent]': 'accentColor()',
    '[style.--cc-chip-on-accent]': 'accentForeground()',
    '[style.--cc-chip-accent-text]': 'accentText()',
    '[style.--cc-chip-accent-outline]': 'accentOutline()',
  },
})
export class ChipChoice extends FormControlBase implements FormValueControl<string | null> {
  readonly value = model<string | null>(null);
  readonly options = input.required<readonly ChipOption[]>();
  readonly allowNone = input(false);
  /** Hides the visible label when the context already names the choice. */
  readonly hideLabel = input(false);
  /** Palette key of the chips, e.g. the category of the subcategories. */
  readonly accent = input<string | null>(null);

  protected readonly labelId = `cc-chip-choice-${nextChipChoiceId++}`;
  protected readonly iconName = iconOrFallback;
  private readonly accentKey = computed(() => {
    const accent = this.accent();
    return accent === null ? null : colorOrFallback(accent);
  });
  protected readonly accentColor = computed(() => {
    const key = this.accentKey();
    return key ? paletteColor(key) : null;
  });
  /** The label of the picked chip, over the color: AA for text (spec §7). */
  protected readonly accentForeground = computed(() => {
    const key = this.accentKey();
    return key ? paletteOnColorText(key) : null;
  });
  protected readonly accentText = computed(() => {
    const key = this.accentKey();
    return key ? paletteTextColor(key) : null;
  });
  /** The outline of the other chips: 3:1, the contrast of a control's border. */
  protected readonly accentOutline = computed(() => {
    const key = this.accentKey();
    return key ? paletteLargeTextColor(key) : null;
  });

  protected onChange(event: MatChipListboxChange, listbox: MatChipListbox): void {
    const picked = (event.value as string | undefined) ?? null;
    if (picked === null && !this.allowNone()) {
      // Material deselects a chip tapped twice; put the selection back.
      listbox.value = this.value();
      return;
    }
    this.value.set(picked);
    this.touch.emit();
  }
}
