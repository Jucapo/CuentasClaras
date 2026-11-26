import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, input, output } from '@angular/core';
import { Params } from '@angular/router';
import { moveItem } from '../../../../domain/categories/category-tree';
import { LinkCommands } from '../../atoms/button/button';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { Icon } from '../../atoms/icon/icon';
import { ListItem } from '../../molecules/list-item/list-item';
import { UI_TEXT } from '../../ui.constants';

/** A category as the list shows it. */
export interface CategoryListEntry {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  /** Color to paint: its own or the inherited one. */
  readonly color: string | null;
  readonly subtitle?: string;
  readonly link?: LinkCommands;
}

/** A top-level category with its subcategories. */
export interface CategoryListNode extends CategoryListEntry {
  readonly children: readonly CategoryListEntry[];
  /** Link to create a subcategory under it; hidden when absent. */
  readonly addChildLink?: LinkCommands;
  readonly addChildQueryParams?: Params;
}

/** New order of sibling categories after a move. */
export interface CategoryReorder {
  readonly parentId: string | null;
  readonly ids: readonly string[];
}

let nextListId = 0;

/**
 * Categories with their subcategories. With `reorderable`, siblings move by dragging the handle
 * or, from the keyboard, with Alt + up/down on it; subcategories stay under their parent.
 */
@Component({
  selector: 'cc-category-list',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, ListItem, IconBadge, Icon],
  templateUrl: './category-list.html',
  styleUrl: './category-list.scss',
})
export class CategoryList {
  readonly nodes = input.required<readonly CategoryListNode[]>();
  readonly reorderable = input(false);
  readonly addChildLabel = input('Agregar subcategoría');
  readonly reorder = output<CategoryReorder>();

  protected readonly instructionsId = `cc-category-list-help-${nextListId++}`;
  protected readonly instructions = UI_TEXT.dragToReorder;

  protected dropped(
    parentId: string | null,
    siblings: readonly CategoryListEntry[],
    event: CdkDragDrop<unknown>,
  ): void {
    this.move(parentId, siblings, event.previousIndex, event.currentIndex);
  }

  protected onHandleKeydown(
    event: KeyboardEvent,
    parentId: string | null,
    siblings: readonly CategoryListEntry[],
    index: number,
  ): void {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
      return;
    }
    event.preventDefault();
    this.move(parentId, siblings, index, event.key === 'ArrowUp' ? index - 1 : index + 1);
  }

  private move(
    parentId: string | null,
    siblings: readonly CategoryListEntry[],
    from: number,
    to: number,
  ): void {
    if (to < 0 || to >= siblings.length || from === to) {
      return;
    }
    const ids = moveItem(
      siblings.map((entry) => entry.id),
      from,
      to,
    );
    this.reorder.emit({ parentId, ids });
  }
}
