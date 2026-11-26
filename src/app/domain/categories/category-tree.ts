/** What the tree needs from a category. */
export interface TreeCategory {
  readonly id: string;
  readonly parent_id: string | null;
  readonly name: string;
  readonly sort_order: number;
  readonly color: string | null;
}

/** A top-level category with its subcategories (spec §4.3: two levels at most). */
export interface CategoryNode<T extends TreeCategory> {
  readonly category: T;
  readonly children: readonly T[];
}

function bySortOrder(a: TreeCategory, b: TreeCategory): number {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'es');
}

/**
 * Top-level categories with their subcategories, both in their saved order. A subcategory whose
 * parent is not in the list (e.g. filtered out) is shown as top-level so it never disappears.
 */
export function buildCategoryTree<T extends TreeCategory>(
  categories: readonly T[],
): CategoryNode<T>[] {
  const ids = new Set(categories.map((category) => category.id));
  const childrenOf = new Map<string, T[]>();
  const roots: T[] = [];
  for (const category of categories) {
    if (category.parent_id && ids.has(category.parent_id)) {
      const siblings = childrenOf.get(category.parent_id) ?? [];
      siblings.push(category);
      childrenOf.set(category.parent_id, siblings);
    } else {
      roots.push(category);
    }
  }
  return roots.sort(bySortOrder).map((category) => ({
    category,
    children: (childrenOf.get(category.id) ?? []).sort(bySortOrder),
  }));
}

/** Color a subcategory shows: its own, or its parent's when it inherits (null). */
export function effectiveColor(
  category: Pick<TreeCategory, 'color'>,
  parent: Pick<TreeCategory, 'color'> | null | undefined,
): string | null {
  return category.color ?? parent?.color ?? null;
}

/** A copy of `items` with the item at `from` moved to `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  if (from < 0 || from >= result.length) {
    return result;
  }
  const target = Math.max(0, Math.min(to, result.length - 1));
  const [moved] = result.splice(from, 1);
  result.splice(target, 0, moved);
  return result;
}
