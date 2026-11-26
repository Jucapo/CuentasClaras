import { Component, input, output } from '@angular/core';
import { ColorSwatch } from '../../atoms/color-swatch/color-swatch';
import { ListItem } from '../../molecules/list-item/list-item';

/** A tag as the list shows it. */
export interface TagListEntry {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly subtitle?: string;
  readonly archived?: boolean;
}

/** Tags with their color; choosing one emits `opened`, e.g. to edit it in a sheet. */
@Component({
  selector: 'cc-tag-list',
  imports: [ListItem, ColorSwatch],
  templateUrl: './tag-list.html',
  styleUrl: './tag-list.scss',
})
export class TagList {
  readonly tags = input.required<readonly TagListEntry[]>();
  /** Lets each tag be chosen. */
  readonly actionable = input(true);
  readonly opened = output<string>();
}
