import { Component, input } from '@angular/core';
import { NavItem, NavLink } from '../../molecules/nav-item/nav-item';

/** Bottom tab bar of the app, for the compact window class. */
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
