import { Component, computed, inject, input, model } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FormControlBase } from '../../atoms/form-control-base';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { Icon } from '../../atoms/icon/icon';
import { colorLabel, colorOrFallback } from '../../colors/color-palette';
import { IconContext, iconLabel } from '../../icons/icon-search';
import { OverlayService } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { Appearance, AppearancePanel, AppearancePanelData } from './appearance-panel';

/**
 * The large icon badge in the header of a flow (spec §13.3, §13.5): opens "Ícono y color" with a
 * live preview. It binds the icon with [formField] and the color with [(color)], so permissions
 * that disable the icon field disable it too.
 */
@Component({
  selector: 'cc-appearance-picker',
  imports: [IconBadge, Icon],
  templateUrl: './appearance-picker.html',
  styleUrl: './appearance-picker.scss',
})
export class AppearancePicker extends FormControlBase implements FormValueControl<string> {
  /** Icon key. */
  readonly value = model('');
  /** Palette key, or null to inherit `inheritFrom`. */
  readonly color = model<string | null>(null);
  /** Color of the parent; when set, the color may be null to inherit it. */
  readonly inheritFrom = input<string | null>(null);
  readonly size = input<'lg' | 'xl'>('xl');
  /** What the icon is for; it decides the groups suggested first (spec §13.3). */
  readonly iconContext = input<IconContext | null>(null);
  /** Name typed for the item; its words suggest icons. */
  readonly itemName = input('');

  private readonly overlay = inject(OverlayService);

  protected readonly shownColor = computed(() => this.color() ?? this.inheritFrom());
  /** Accessible name: what the button does, then the current icon and color. */
  protected readonly accessibleName = computed(() => {
    const color = this.shownColor();
    const parts = [iconLabel(this.value()), color ? colorLabel(colorOrFallback(color)) : null];
    return `${this.label()}: ${parts.filter(Boolean).join(', ')}`;
  });

  protected async open(): Promise<void> {
    if (this.disabled()) {
      return;
    }
    const picked = await this.overlay.open<Appearance, AppearancePanelData>(AppearancePanel, {
      label: UI_TEXT.appearanceTitle,
      data: {
        title: UI_TEXT.appearanceTitle,
        icon: this.value(),
        color: this.color(),
        inheritFrom: this.inheritFrom(),
        iconContext: this.iconContext(),
        itemName: this.itemName(),
      },
    });
    if (picked) {
      this.value.set(picked.icon);
      this.color.set(picked.color);
    }
    this.touch.emit();
  }
}
