import { Component, computed, input, output } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import { UI_TEXT } from '../../ui.constants';

/** One filter of a `cc-filter-chips`. */
export interface FilterChip {
  readonly key: string;
  /** e.g. "Cuenta". */
  readonly label: string;
  /** What is picked, e.g. "Efectivo +2"; null while the filter is off. */
  readonly summary: string | null;
}

/**
 * Filters as chips in one row that scrolls sideways (spec §7). Tapping a chip asks the page to open
 * its options (`opened`), and `expanded` tells which ones are open; an active one shows what is
 * picked and a ✕ that clears it (`cleared`). With two or more active, "Limpiar" clears them all.
 * Own buttons instead of Material chips: none opens options and also clears with ✕.
 */
@Component({
  selector: 'cc-filter-chips',
  imports: [Icon],
  templateUrl: './filter-chips.html',
  styleUrl: './filter-chips.scss',
})
export class FilterChips {
  readonly filters = input.required<readonly FilterChip[]>();
  /** Accessible name of the row, e.g. "Filtros". */
  readonly label = input.required<string>();
  /** The key of the filter whose options are open (its `aria-expanded`). */
  readonly expanded = input<string | null>(null);
  readonly opened = output<string>();
  readonly cleared = output<string>();
  readonly clearedAll = output<void>();

  protected readonly text = UI_TEXT;
  protected readonly activeCount = computed(
    () => this.filters().filter((filter) => filter.summary !== null).length,
  );
}
