import { Component, input } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../atoms/icon/icon';
import { LinkCommands } from '../../atoms/button/button';
import { IconName } from '../../icons/icon-glyphs';

/** Tab of the bottom navigation: icon, label and an indicator while its route is active. */
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
}
