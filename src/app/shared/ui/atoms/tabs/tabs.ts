import { Component, input, model } from '@angular/core';
import { MatTabLink, MatTabNav, MatTabNavPanel } from '@angular/material/tabs';
import { IconName } from '../../icons/icon-glyphs';
import { Icon } from '../icon/icon';

/** One tab of `cc-tabs`. */
export interface TabOption<T> {
  readonly value: T;
  readonly label: string;
  readonly icon?: IconName;
}

/**
 * Material 3 primary tabs that switch the projected content without routing, e.g. Gastos /
 * Ingresos or Ícono / Color. The content is the tab panel of the selected tab.
 */
@Component({
  selector: 'cc-tabs',
  imports: [MatTabNav, MatTabLink, MatTabNavPanel, Icon],
  templateUrl: './tabs.html',
  styleUrl: './tabs.scss',
})
export class Tabs<T> {
  readonly value = model.required<T>();
  readonly options = input.required<readonly TabOption<T>[]>();
  /** Accessible name of the tab list. */
  readonly label = input.required<string>();
}
