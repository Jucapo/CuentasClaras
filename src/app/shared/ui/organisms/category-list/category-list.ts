import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, input, output } from '@angular/core';
import { moveItem } from '../../../../domain/categories/category-tree';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { Icon } from '../../atoms/icon/icon';
import { ListItem } from '../../molecules/list-item/list-item';
import { UI_TEXT } from '../../ui.constants';

/** A category or subcategory as the list shows it. */
export interface CategoryListEntry {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  /** Color to paint: its own or the inherited one. */
  readonly color: string | null;
  /** E.g. its default tags. */
  readonly subtitle?: string;
  /** Dims the row, e.g. when archived. */
  readonly muted?: boolean;
}

let nextListId = 0;

/**
 * Categories as rows that open their sheet or screen (`opened`), with an optional "add" row at the
 * end. With `reorderable`, rows move by dragging the handle or with Alt + up/down on it.
 */
@Component({
  selector: 'cc-category-list',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, ListItem, IconBadge, Icon],
  templateUrl: './category-list.html',
  styleUrl: './category-list.scss',
})
export class CategoryList {
  readonly entries = input.required<readonly CategoryListEntry[]>();
  /** Accessible name of the list. */
  readonly label = input.required<string>();
  readonly reorderable = input(false);
  /** Label of the row that adds an item; no row without it. */
  readonly addLabel = input<string | null>(null);
  /** An entry was chosen, to open its sheet or screen. */
  readonly opened = output<string>();
  readonly add = output<void>();
  /** Ids in their new order after a move. */
  readonly reorder = output<readonly string[]>();

  protected readonly instructionsId = `cc-category-list-help-${nextListId++}`;
  protected readonly instructions = UI_TEXT.dragToReorder;

  protected dropped(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  protected onHandleKeydown(event: KeyboardEvent, index: number): void {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
      return;
    }
    event.preventDefault();
    this.move(index, event.key === 'ArrowUp' ? index - 1 : index + 1);
  }

  private move(from: number, to: number): void {
    const ids = this.entries().map((entry) => entry.id);
    if (to < 0 || to >= ids.length || from === to) {
      return;
    }
    this.reorder.emit(moveItem(ids, from, to));
  }
}
