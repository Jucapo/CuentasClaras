import { Component, input, output } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import {
  colorOrFallback,
  paletteColor,
  paletteLargeTextColor,
  paletteOnColorText,
} from '../../colors/color-palette';
import { iconOrFallback } from '../../icons/icon-glyphs';

/** One block of `cc-entry-endpoints`, e.g. "De cuenta · Efectivo". */
export interface EntryEndpoint {
  /** What the block is, e.g. "De cuenta" or "A categoría". */
  readonly role: string;
  /** What is picked, or what to pick, e.g. "Elige la cuenta". */
  readonly name: string;
  readonly icon: string;
  /** Palette key; the block is filled with it. */
  readonly color: string | null;
  /** Accounts float in a rounded square, categories in a circle, as in 1Money. */
  readonly kind: 'account' | 'category';
}

/**
 * Where a movement comes from and where it goes (spec §7), as 1Money's blocks: edge to edge on top
 * of the quick entry, each filled with its color, the text in the color that reads on it (AA). The
 * icon of the first block floats over its top edge at the start, the one of the last block at the
 * end, so the middle stays free for the sheet's handle. Touching a block emits its index, to pick
 * another one; the icons belong to their block.
 */
@Component({
  selector: 'cc-entry-endpoints',
  imports: [Icon],
  templateUrl: './entry-endpoints.html',
  styleUrl: './entry-endpoints.scss',
})
export class EntryEndpoints {
  readonly endpoints = input.required<readonly EntryEndpoint[]>();
  /** Accessible name of the group, e.g. "Origen y destino". */
  readonly label = input.required<string>();
  readonly picked = output<number>();

  protected readonly iconName = iconOrFallback;

  protected fill(color: string | null): string {
    return paletteColor(colorOrFallback(color));
  }

  protected onFill(color: string | null): string {
    return paletteOnColorText(colorOrFallback(color));
  }

  /** The icon on its floating badge, a surface: the color at 3:1, as an icon needs. */
  protected iconColor(color: string | null): string {
    return paletteLargeTextColor(colorOrFallback(color));
  }
}
