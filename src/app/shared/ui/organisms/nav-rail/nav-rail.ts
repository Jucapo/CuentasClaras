import { Component, input } from '@angular/core';
import { NavItem, NavLink } from '../../molecules/nav-item/nav-item';

/**
 * Side navigation for the medium and expanded window classes (spec §13.5): icons over labels, or
 * icon and label in one row when `expanded`.
 */
@Component({
  selector: 'cc-nav-rail',
  imports: [NavItem],
  templateUrl: './nav-rail.html',
  styleUrl: './nav-rail.scss',
  host: { '[class.expanded]': 'expanded()' },
})
export class NavRail {
  readonly items = input.required<readonly NavLink[]>();
  /** Accessible name of the navigation landmark. */
  readonly label = input.required<string>();
  readonly expanded = input(false);
}
