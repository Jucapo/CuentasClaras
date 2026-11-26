import { Component, input } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../atoms/icon/icon';
import { LinkCommands } from '../../atoms/button/button';
import { IconName } from '../../icons/icon-glyphs';

/** Destination of the main navigation (bottom bar or rail). */
export interface NavLink {
  /** Route path segment (no leading slash). */
  readonly path: string;
  readonly label: string;
  readonly icon: IconName;
}

/**
 * Destination of the main navigation with an indicator while its route is active. `stacked` puts
 * the label under the icon (bottom bar, rail); `inline` puts it beside it (expanded rail).
 */
@Component({
  selector: 'cc-nav-item',
  imports: [RouterLink, RouterLinkActive, MatRipple, Icon],
  templateUrl: './nav-item.html',
  styleUrl: './nav-item.scss',
})
export class NavItem {
  readonly link = input.required<LinkCommands>();
  readonly label = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly layout = input<'stacked' | 'inline'>('stacked');
}
