import { Component, computed, inject, input, model } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { FormControlBase } from '../../atoms/form-control-base';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { iconLabel } from '../../icons/icon-search';
import { OverlayService } from '../../services/overlay.service';
import { PickerTrigger } from '../picker-trigger/picker-trigger';
import { IconPickerData, IconPickerPanel } from './icon-picker-panel';

/** Icon field: shows the current icon and opens the catalog with search and groups. */
@Component({
  selector: 'cc-icon-picker',
  imports: [PickerTrigger, IconBadge],
  templateUrl: './icon-picker.html',
})
export class IconPicker extends FormControlBase implements FormValueControl<string> {
  /** Icon key, as stored in the database. */
  readonly value = model('');
  /** Palette key used to preview the icon. */
  readonly color = input<string | null>(null);

  private readonly overlay = inject(OverlayService);

  protected readonly valueText = computed(() => iconLabel(this.value()));

  protected async open(): Promise<void> {
    if (this.disabled()) {
      return;
    }
    const picked = await this.overlay.open<string, IconPickerData>(IconPickerPanel, {
      label: this.label(),
      data: { title: this.label(), selected: this.value(), color: this.color() },
    });
    if (picked) {
      this.value.set(picked);
    }
    this.touch.emit();
  }
}
