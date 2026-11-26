import { Component, computed, ElementRef, inject, signal, viewChildren } from '@angular/core';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { TextField } from '../../atoms/text-field/text-field';
import { searchIcons } from '../../icons/icon-search';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { OverlayPanel } from '../overlay-panel/overlay-panel';

/** Data of the icon picker panel. */
export interface IconPickerData {
  readonly title: string;
  readonly selected: string;
  /** Palette key used to preview the icons. */
  readonly color: string | null;
}

/** Content of the icon picker overlay: search, shortcuts to each group and the icon grid. */
@Component({
  selector: 'cc-icon-picker-panel',
  imports: [OverlayPanel, TextField, IconBadge],
  templateUrl: './icon-picker-panel.html',
  styleUrl: './icon-picker-panel.scss',
})
export class IconPickerPanel {
  protected readonly data = inject<IconPickerData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<string>>(OverlayHandle);
  private readonly sections = viewChildren<ElementRef<HTMLElement>>('section');

  protected readonly text = UI_TEXT;
  protected readonly query = signal('');
  protected readonly groups = computed(() => searchIcons(this.query()));

  protected pick(name: string): void {
    this.handle.close(name);
  }

  protected close(): void {
    this.handle.close();
  }

  protected jumpTo(groupId: string): void {
    this.sections()
      .find((section) => section.nativeElement.dataset['group'] === groupId)
      ?.nativeElement.scrollIntoView({ block: 'start' });
  }
}
