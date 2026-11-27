import { Component, computed, input, model, signal } from '@angular/core';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { TabOption, Tabs } from '../../atoms/tabs/tabs';
import { IconContext } from '../../icons/icon-search';
import { UI_TEXT } from '../../ui.constants';
import { ColorGrid } from '../color-grid/color-grid';
import { IconGrid } from '../icon-grid/icon-grid';

type AppearanceTab = 'icon' | 'color';

/**
 * Icon and color together (spec §13.3): a live preview and the tabs Ícono | Color. Used inline
 * where a sheet cannot open another one (subcategories), and inside `cc-appearance-picker`.
 */
@Component({
  selector: 'cc-appearance-editor',
  imports: [Tabs, IconGrid, ColorGrid, IconBadge],
  templateUrl: './appearance-editor.html',
  styleUrl: './appearance-editor.scss',
})
export class AppearanceEditor {
  /** Icon key. */
  readonly icon = model.required<string>();
  /** Palette key, or null to inherit `inheritFrom`. */
  readonly color = model.required<string | null>();
  /** Color of the parent; when set, the color may be null to inherit it. */
  readonly inheritFrom = input<string | null>(null);
  /** Hides the large preview when the surrounding screen already shows one. */
  readonly showPreview = input(true);
  /** What the icon is for; it decides the groups suggested. */
  readonly iconContext = input<IconContext | null>(null);
  /** Name typed for the item; its words suggest icons. */
  readonly itemName = input('');

  protected readonly text = UI_TEXT;
  protected readonly tab = signal<AppearanceTab>('icon');
  protected readonly tabs: readonly TabOption<AppearanceTab>[] = [
    { value: 'icon', label: UI_TEXT.iconTab, icon: 'category' },
    { value: 'color', label: UI_TEXT.colorTab, icon: 'palette' },
  ];
  protected readonly shownColor = computed(() => this.color() ?? this.inheritFrom());
}
