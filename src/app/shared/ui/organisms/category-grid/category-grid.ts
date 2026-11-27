import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { moveItem } from '../../../../domain/categories/category-tree';
import { formatMoney } from '../../../../domain/money/money';
import { Amount } from '../../atoms/amount/amount';
import { Donut, DonutSegment } from '../../atoms/donut/donut';
import { CategoryBubble } from '../../molecules/category-bubble/category-bubble';
import { MONEY_FORMAT } from '../../money/money-format';
import { TOUCH_DRAG_DELAY_MS, UI_TEXT } from '../../ui.constants';

/** A top-level category as the grid shows it. */
export interface CategoryGridItem {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string | null;
  /** Spent or received in the period, in the grid's currency (view mode). */
  readonly amount?: number | null;
  /** What remains of its budget; null without one. */
  readonly remaining?: number | null;
  /** Share of the budget used; null without one. */
  readonly progress?: number | null;
}

/** A total in the middle of the donut, e.g. Gastos $ 1.250.000. */
export interface CategoryGridTotal {
  readonly label: string;
  readonly amount: number;
}

const MOVE_KEYS: Readonly<Record<string, -1 | 1>> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
};

let nextGridId = 0;

/**
 * Categories as bubbles around the donut (spec §7): four columns on phones and six on wide
 * containers, with the donut in the middle. `edit` mode turns the bubbles into buttons, adds the
 * "+" bubble and, with `reorderable`, lets them move by dragging (a long press on touch screens)
 * or with Alt and the arrows.
 */
@Component({
  selector: 'cc-category-grid',
  imports: [CdkDropList, CdkDrag, CategoryBubble, Donut, Amount],
  templateUrl: './category-grid.html',
  styleUrl: './category-grid.scss',
})
export class CategoryGrid {
  readonly items = input.required<readonly CategoryGridItem[]>();
  readonly mode = input<'view' | 'edit'>('view');
  /** Accessible name of the grid, e.g. "Categorías de gasto". */
  readonly label = input.required<string>();
  /** Text in the middle of the donut, e.g. "Gastos". */
  readonly centerLabel = input.required<string>();
  /** Label of the "+" bubble of the edit mode; none without it. */
  readonly addLabel = input<string | null>(null);
  readonly reorderable = input(false);
  /** Currency of the amounts and totals; without it the bubbles show no amounts. */
  readonly currency = input<string | null>(null);
  /** Totals in the middle of the donut, the first one larger; `centerLabel` shows without them. */
  readonly totals = input<readonly CategoryGridTotal[]>([]);
  /** Category whose screen is open next to the grid. */
  readonly selectedId = input<string | null>(null);
  /** Without the donut it is a plain grid, e.g. to pick a category (spec §7). */
  readonly donut = input(true);
  /** `category` paints each amount in the color of its category. */
  readonly amountColor = input<'neutral' | 'category'>('neutral');
  /** A category was chosen: its screen in edit mode, the quick entry in view mode. */
  readonly opened = output<string>();
  readonly add = output<void>();
  /** Ids in their new order after a move. */
  readonly reorder = output<readonly string[]>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly format = inject(MONEY_FORMAT);
  private focusAfterMove: string | null = null;

  protected readonly helpId = `cc-category-grid-help-${nextGridId++}`;
  protected readonly keyboardHelp = UI_TEXT.gridEditHelpKeyboard;
  protected readonly dragDelay = { touch: TOUCH_DRAG_DELAY_MS, mouse: 0 };
  /** The totals drawn in the donut, read out before the bubbles. */
  protected readonly totalsText = computed(() => {
    const currency = this.currency();
    return currency
      ? this.totals()
          .map((total) => `${total.label}: ${formatMoney(total.amount, currency, this.format())}`)
          .join('. ')
      : '';
  });
  /** Whether some bubble shows a remaining amount; only then the others keep its line. */
  protected readonly anyRemaining = computed(() =>
    this.items().some((item) => item.remaining !== null && item.remaining !== undefined),
  );
  protected readonly segments = computed<DonutSegment[]>(() =>
    this.mode() === 'view'
      ? this.items().map((item) => ({ value: item.amount ?? 0, color: item.color }))
      : [],
  );

  constructor() {
    // Moving a bubble moves its element, which drops the focus; give it back after the move.
    afterRenderEffect(() => {
      this.items();
      const id = this.focusAfterMove;
      if (id) {
        this.focusAfterMove = null;
        this.host.nativeElement
          .querySelector<HTMLButtonElement>(`[data-id="${CSS.escape(id)}"] button`)
          ?.focus();
      }
    });
  }

  protected dropped(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const step = MOVE_KEYS[event.key];
    if (!this.reorderable() || !event.altKey || step === undefined) {
      return;
    }
    event.preventDefault();
    const id = this.items()[index]?.id ?? null;
    if (this.move(index, index + step)) {
      this.focusAfterMove = id;
    }
  }

  private move(from: number, to: number): boolean {
    const ids = this.items().map((item) => item.id);
    if (to < 0 || to >= ids.length || from === to) {
      return false;
    }
    this.reorder.emit(moveItem(ids, from, to));
    return true;
  }
}
