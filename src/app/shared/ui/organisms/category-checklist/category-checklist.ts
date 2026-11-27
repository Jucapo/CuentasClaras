import { Component, computed, input, model } from '@angular/core';
import { toggleChecklistItem } from '../../../../domain/categories/category-checklist';
import { Checkbox } from '../../atoms/checkbox/checkbox';

/** A category or subcategory as the checklist shows it. */
export interface CategoryChecklistItem {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  /** Palette key; a subcategory without one shows its category's. */
  readonly color?: string | null;
}

/** A category with its subcategories. */
export interface CategoryChecklistNode extends CategoryChecklistItem {
  readonly children: readonly CategoryChecklistItem[];
}

/**
 * Categories and their subcategories with check boxes. With `linked` (picking what to create), a
 * category carries its subcategories and a subcategory needs its category; otherwise each item
 * stands alone (e.g. where a tag applies by default).
 */
@Component({
  selector: 'cc-category-checklist',
  imports: [Checkbox],
  templateUrl: './category-checklist.html',
  styleUrl: './category-checklist.scss',
})
export class CategoryChecklist {
  readonly nodes = input.required<readonly CategoryChecklistNode[]>();
  /** Accessible name of the list. */
  readonly label = input.required<string>();
  readonly linked = input(false);
  /** Ids of the checked items, in checklist order. */
  readonly selected = model<readonly string[]>([]);

  protected readonly checked = computed(() => new Set(this.selected()));

  protected toggle(id: string, checked: boolean): void {
    this.selected.set(
      toggleChecklistItem(this.nodes(), this.selected(), id, checked, this.linked()),
    );
  }
}
