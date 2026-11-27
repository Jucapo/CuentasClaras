import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { Params, RouterLink } from '@angular/router';
import { LinkCommands } from '../../atoms/button/button';
import { Icon } from '../../atoms/icon/icon';
import { iconOrFallback } from '../../icons/icon-glyphs';

/**
 * Row of a list: leading visual (`[ccListItemLeading]`), title and subtitle, trailing content
 * (`[ccListItemTrailing]`). With `link` the row navigates; with `actionable` it is a button that
 * emits `activate` (e.g. to open a sheet). `[ccListItemStart]` and `[ccListItemEnd]` sit outside
 * the link or button, for controls such as a drag handle.
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
  /** Icon key before the subtitle, e.g. the account of a movement. */
  readonly subtitleIcon = input<string>();
  /** A third line, e.g. the note of a movement. */
  readonly note = input<string>();
  readonly link = input<LinkCommands>();
  readonly queryParams = input<Params | null>(null);
  /** Dims the row, e.g. for archived items. */
  readonly muted = input(false);
  /** Without a link, renders a button that emits `activate`. */
  readonly actionable = input(false);
  /** Marks the row whose detail is open next to the list. */
  readonly selected = input(false);
  readonly activate = output<void>();

  protected readonly iconName = iconOrFallback;
}
