/** A category of a checklist with its subcategories (two levels at most, spec §4.3). */
export interface ChecklistNode {
  readonly id: string;
  readonly children: readonly { readonly id: string }[];
}

/** Every id of the checklist, each category followed by its subcategories. */
export function checklistIds(nodes: readonly ChecklistNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...node.children.map((child) => child.id)]);
}

/**
 * The selection after checking or unchecking `id`, in checklist order. With `linked` (picking what
 * to create), a category carries its subcategories and a subcategory needs its category; without it
 * every item stands alone (e.g. where a tag applies by default).
 */
export function toggleChecklistItem(
  nodes: readonly ChecklistNode[],
  selected: readonly string[],
  id: string,
  checked: boolean,
  linked: boolean,
): string[] {
  const next = new Set(selected);
  const category = nodes.find((node) => node.id === id);
  const parent = category
    ? undefined
    : nodes.find((node) => node.children.some((child) => child.id === id));
  if (checked) {
    next.add(id);
    if (linked && category) {
      category.children.forEach((child) => next.add(child.id));
    }
    if (linked && parent) {
      next.add(parent.id);
    }
  } else {
    next.delete(id);
    if (linked && category) {
      category.children.forEach((child) => next.delete(child.id));
    }
  }
  return checklistIds(nodes).filter((item) => next.has(item));
}
