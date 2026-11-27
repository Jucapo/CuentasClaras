import { Component, input, output } from '@angular/core';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { colorOrFallback, paletteColor } from '../../colors/color-palette';

/** One block of `cc-entry-endpoints`, e.g. "De cuenta · Efectivo". */
export interface EntryEndpoint {
  /** What the block is, e.g. "De cuenta" or "A categoría". */
  readonly role: string;
  /** What is picked, or what to pick, e.g. "Elige la cuenta". */
  readonly name: string;
  readonly icon: string;
  /** Palette key; the block takes a soft tone of it and the badge the color itself. */
  readonly color: string | null;
}

/**
 * Where a movement comes from and where it goes (spec §7), as blocks in a row: "De cuenta → A
 * categoría" for an expense, "De categoría → A cuenta" for an income, "De cuenta → A cuenta" for a
 * transfer. Each block has its color and icon; touching it emits its index, to pick another one.
 * The soft tone keeps the text at AA, as the rows of Presupuesto do.
 */
@Component({
  selector: 'cc-entry-endpoints',
  imports: [IconBadge],
  templateUrl: './entry-endpoints.html',
  styleUrl: './entry-endpoints.scss',
})
export class EntryEndpoints {
  readonly endpoints = input.required<readonly EntryEndpoint[]>();
  /** Accessible name of the group, e.g. "Origen y destino". */
  readonly label = input.required<string>();
  readonly picked = output<number>();

  protected tint(color: string | null): string {
    return paletteColor(colorOrFallback(color));
  }
}
