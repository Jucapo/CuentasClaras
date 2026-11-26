import { Component, input } from '@angular/core';
import { LinkCommands } from '../../atoms/button/button';
import { ColorSwatch } from '../../atoms/color-swatch/color-swatch';
import { ListItem } from '../../molecules/list-item/list-item';

/** A tag as the list shows it. */
export interface TagListEntry {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly subtitle?: string;
  readonly link?: LinkCommands;
  readonly archived?: boolean;
}

/** Tags with their color. */
@Component({
  selector: 'cc-tag-list',
  imports: [ListItem, ColorSwatch],
  templateUrl: './tag-list.html',
  styleUrl: './tag-list.scss',
})
export class TagList {
  readonly tags = input.required<readonly TagListEntry[]>();
}
