import { Component, input } from '@angular/core';
import { IconName } from '../../icons/icon-glyphs';
import { NavItem } from '../../molecules/nav-item/nav-item';

/** Destination of the bottom navigation. */
export interface NavLink {
  /** Route path segment (no leading slash). */
  readonly path: string;
  readonly label: string;
  readonly icon: IconName;
}

/** Bottom tab bar of the app. */
@Component({
  selector: 'cc-bottom-nav',
  imports: [NavItem],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
})
export class BottomNav {
  readonly items = input.required<readonly NavLink[]>();
  /** Accessible name of the navigation landmark. */
  readonly label = input.required<string>();
}
