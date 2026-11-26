import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { RouterLink } from '@angular/router';
import { LinkCommands } from '../../atoms/button/button';
import { Icon } from '../../atoms/icon/icon';

/**
 * Row of a list: leading visual (`[ccListItemLeading]`), title and subtitle, trailing content
 * (`[ccListItemTrailing]`). With `link` the row navigates. `[ccListItemStart]` and
 * `[ccListItemEnd]` sit outside the link, for controls such as a drag handle.
 */
@Component({
  selector: 'cc-list-item',
  imports: [NgTemplateOutlet, RouterLink, MatRipple, Icon],
  templateUrl: './list-item.html',
  styleUrl: './list-item.scss',
  host: { '[class.muted]': 'muted()' },
})
export class ListItem {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  readonly link = input<LinkCommands>();
  /** Dims the row, e.g. for archived items. */
  readonly muted = input(false);
}
