import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { afterRenderEffect, Component, ElementRef, inject, input, output } from '@angular/core';
import { moveItem } from '../../../../domain/categories/category-tree';
import { Donut } from '../../atoms/donut/donut';
import { CategoryBubble } from '../../molecules/category-bubble/category-bubble';
import { TOUCH_DRAG_DELAY_MS, UI_TEXT } from '../../ui.constants';

/** A top-level category as the grid shows it. */
export interface CategoryGridItem {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string | null;
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
  imports: [CdkDropList, CdkDrag, CategoryBubble, Donut],
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
  /** Category whose screen is open next to the grid. */
  readonly selectedId = input<string | null>(null);
  /** A category was chosen in edit mode. */
  readonly opened = output<string>();
  readonly add = output<void>();
  /** Ids in their new order after a move. */
  readonly reorder = output<readonly string[]>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private focusAfterMove: string | null = null;

  protected readonly helpId = `cc-category-grid-help-${nextGridId++}`;
  protected readonly keyboardHelp = UI_TEXT.gridEditHelpKeyboard;
  protected readonly dragDelay = { touch: TOUCH_DRAG_DELAY_MS, mouse: 0 };

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
