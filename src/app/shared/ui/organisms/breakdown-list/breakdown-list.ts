import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { percentText } from '../../../../domain/reports/averages';
import { Amount } from '../../atoms/amount/amount';
import { Icon } from '../../atoms/icon/icon';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { ProgressBar } from '../../atoms/progress-bar/progress-bar';
import { FALLBACK_COLOR } from '../../colors/color-palette';
import { UI_TEXT } from '../../ui.constants';

/** A row of `cc-breakdown-list`: a category, tag, account or person with its share. */
export interface BreakdownItem {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  /** Palette key of the badge and the bar. */
  readonly color: string | null;
  /** Minor units of the list's currency. */
  readonly amount: number;
  /** Share of the total, 0 to 1. */
  readonly share: number;
  /** Rows that unfold under it, e.g. the subcategories; touching it then toggles them. */
  readonly children?: readonly BreakdownItem[];
  /** Without children, whether touching it emits `opened`, e.g. to see its movements. */
  readonly actionable?: boolean;
}

/**
 * Amounts with their share (spec §7): a badge, the name and the amount, and a bar with the % in
 * the color of each row. A row with children unfolds them; one without children can open its
 * movements. The rows in `rest` go folded in a gray "Más…" row, as in 1Money.
 */
@Component({
  selector: 'cc-breakdown-list',
  imports: [NgTemplateOutlet, Amount, Icon, IconBadge, ProgressBar],
  templateUrl: './breakdown-list.html',
  styleUrl: './breakdown-list.scss',
})
export class BreakdownList {
  readonly items = input.required<readonly BreakdownItem[]>();
  /** Rows folded under "Más…"; none when empty. */
  readonly rest = input<readonly BreakdownItem[]>([]);
  readonly currency = input.required<string>();
  /** Accessible name of the list, e.g. "Gastos por categoría". */
  readonly label = input.required<string>();
  readonly emptyText = input<string>('');
  /** A row without children was touched. */
  readonly opened = output<string>();

  protected readonly text = UI_TEXT;
  protected readonly restColor = FALLBACK_COLOR;
  protected readonly percent = percentText;
  private readonly unfolded = signal<ReadonlySet<string>>(new Set());
  protected readonly restOpen = signal(false);

  protected readonly restTotal = computed(() =>
    this.rest().reduce(
      (sum, item) => ({ amount: sum.amount + item.amount, share: sum.share + item.share }),
      { amount: 0, share: 0 },
    ),
  );

  protected isOpen(id: string): boolean {
    return this.unfolded().has(id);
  }

  protected activate(item: BreakdownItem): void {
    if (item.children?.length) {
      this.unfolded.update((ids) => {
        const next = new Set(ids);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
    } else if (item.actionable) {
      this.opened.emit(item.id);
    }
  }

  protected toggleRest(): void {
    this.restOpen.update((open) => !open);
  }
}
