/** A subcategory of the suggested template; it inherits the color of its category. */
export interface TemplateSubcategory {
  readonly name: string;
  readonly icon: string;
}

/** A category of the suggested template (spec Anexo A). */
export interface TemplateCategory {
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly children: readonly TemplateSubcategory[];
}

/** A template category with the checklist ids of it and its subcategories. */
export interface TemplateNode extends Omit<TemplateCategory, 'children'> {
  readonly id: string;
  readonly children: readonly (TemplateSubcategory & { readonly id: string })[];
}

/** The template as checklist nodes: category "3", its subcategories "3.0", "3.1"… */
export function templateNodes(template: readonly TemplateCategory[]): TemplateNode[] {
  return template.map((category, index) => ({
    ...category,
    id: `${index}`,
    children: category.children.map((child, childIndex) => ({
      ...child,
      id: `${index}.${childIndex}`,
    })),
  }));
}

/** The checked part of the template, as `create_category_tree` receives it. */
export function pickTemplate(
  nodes: readonly TemplateNode[],
  selected: readonly string[],
): TemplateCategory[] {
  const checked = new Set(selected);
  return nodes
    .filter((node) => checked.has(node.id))
    .map(({ name, icon, color, children }) => ({
      name,
      icon,
      color,
      children: children
        .filter((child) => checked.has(child.id))
        .map((child) => ({ name: child.name, icon: child.icon })),
    }));
}
