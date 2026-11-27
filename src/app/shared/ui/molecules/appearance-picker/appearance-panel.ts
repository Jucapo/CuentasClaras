import { Component, inject, signal } from '@angular/core';
import { IconContext } from '../../icons/icon-search';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { AppearanceEditor } from '../appearance-editor/appearance-editor';
import { OverlayPanel } from '../overlay-panel/overlay-panel';

/** Icon and color of an item. */
export interface Appearance {
  readonly icon: string;
  /** Palette key, or null to inherit the parent's. */
  readonly color: string | null;
}

/** Data of the icon and color panel. */
export interface AppearancePanelData extends Appearance {
  readonly title: string;
  readonly inheritFrom: string | null;
  /** What the icon is for and the name typed, for the suggested icons. */
  readonly iconContext?: IconContext | null;
  readonly itemName?: string;
}

/** Sheet or dialog of `cc-appearance-picker`: ✓ applies icon and color, ✕ discards them. */
@Component({
  selector: 'cc-appearance-panel',
  imports: [OverlayPanel, AppearanceEditor],
  templateUrl: './appearance-panel.html',
})
export class AppearancePanel {
  protected readonly data = inject<AppearancePanelData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<Appearance>>(OverlayHandle);

  protected readonly text = UI_TEXT;
  protected readonly icon = signal(this.data.icon);
  protected readonly color = signal(this.data.color);

  protected done(): void {
    this.handle.close({ icon: this.icon(), color: this.color() });
  }

  protected close(): void {
    this.handle.close();
  }
}
