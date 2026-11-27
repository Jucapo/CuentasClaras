import { Component, computed, inject, input, output } from '@angular/core';
import { formatMoney } from '../../../../domain/money/money';
import { Amount } from '../../atoms/amount/amount';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { Icon } from '../../atoms/icon/icon';
import { colorOrFallback, paletteColor } from '../../colors/color-palette';
import { MONEY_FORMAT } from '../../money/money-format';
import { UI_TEXT } from '../../ui.constants';

/**
 * A category around the donut (spec §7): name over its badge. `view` is a button that opens the
 * quick entry and shows what remains of the budget above the badge, what was spent below it, a ring
 * that fills as the budget is spent and a mark when it went over. `edit` is a button that opens the
 * category, and `add` is the dashed "+" bubble that creates one.
 */
@Component({
  selector: 'cc-category-bubble',
  imports: [IconBadge, Icon, Amount],
  templateUrl: './category-bubble.html',
  styleUrl: './category-bubble.scss',
  host: { '[class.selected]': 'selected()' },
})
export class CategoryBubble {
  readonly name = input.required<string>();
  /** Icon key; not used by the `add` bubble. */
  readonly icon = input('');
  readonly color = input<string | null>(null);
  readonly variant = input<'view' | 'edit' | 'add'>('view');
  /** Its screen is open next to the grid. */
  readonly selected = input(false);
  /** Id of the help text about moving it. */
  readonly describedBy = input<string | null>(null);
  readonly keyShortcuts = input<string | null>(null);
  /** Spent or received in the period, in minor units of `currency`; hidden when null. */
  readonly amount = input<number | null>(null);
  /** What remains of the budget; hidden when null (no budget). */
  readonly remaining = input<number | null>(null);
  readonly currency = input<string | null>(null);
  /** Share of the budget used, 0–1 or more; no ring when null. */
  readonly progress = input<number | null>(null);
  readonly activate = output<void>();

  private readonly format = inject(MONEY_FORMAT);

  protected readonly over = computed(() => (this.remaining() ?? 0) < 0);
  protected readonly ringColor = computed(() =>
    this.over() ? null : paletteColor(colorOrFallback(this.color())),
  );
  protected readonly ringProgress = computed(() => {
    const progress = this.progress();
    return progress === null ? null : Math.min(Math.max(progress, 0), 1);
  });
  protected readonly overLabel = UI_TEXT.overBudget;

  /** "Mercado, $ 250.000, quedan $ 50.000" for screen readers. */
  protected readonly accessibleName = computed(() => {
    const currency = this.currency();
    const parts = [this.name()];
    const amount = this.amount();
    const remaining = this.remaining();
    if (currency && amount !== null) {
      parts.push(formatMoney(amount, currency, this.format()));
    }
    if (currency && remaining !== null) {
      parts.push(
        this.over()
          ? `${UI_TEXT.overBudget}: ${formatMoney(-remaining, currency, this.format())}`
          : `${UI_TEXT.remaining} ${formatMoney(remaining, currency, this.format())}`,
      );
    }
    return parts.join(', ');
  });
}
