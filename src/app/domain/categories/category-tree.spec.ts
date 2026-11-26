import { buildCategoryTree, effectiveColor, moveItem, TreeCategory } from './category-tree';

function category(
  id: string,
  sortOrder: number,
  parentId: string | null = null,
  color: string | null = 'teal',
): TreeCategory {
  return { id, name: id, sort_order: sortOrder, parent_id: parentId, color };
}

describe('category tree', () => {
  it('nests subcategories under their parent, both in saved order', () => {
    const tree = buildCategoryTree([
      category('Mercado', 1),
      category('Servicios', 1, 'Hogar', null),
      category('Hogar', 0),
      category('Arriendo', 0, 'Hogar', null),
    ]);
    expect(tree.map((node) => node.category.id)).toEqual(['Hogar', 'Mercado']);
    expect(tree[0].children.map((child) => child.id)).toEqual(['Arriendo', 'Servicios']);
    expect(tree[1].children).toEqual([]);
  });

  it('breaks ties by name', () => {
    const tree = buildCategoryTree([category('Salud', 0), category('Ocio', 0)]);
    expect(tree.map((node) => node.category.id)).toEqual(['Ocio', 'Salud']);
  });

  it('keeps a subcategory whose parent is missing as top-level', () => {
    const tree = buildCategoryTree([category('Arriendo', 0, 'archivada')]);
    expect(tree.map((node) => node.category.id)).toEqual(['Arriendo']);
  });

  it('inherits the parent color only when the subcategory has none', () => {
    expect(effectiveColor({ color: null }, { color: 'orange' })).toBe('orange');
    expect(effectiveColor({ color: 'red' }, { color: 'orange' })).toBe('red');
    expect(effectiveColor({ color: null }, null)).toBeNull();
  });

  it('moves an item within a list without mutating it', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(items, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(items, 1, 99)).toEqual(['a', 'c', 'd', 'b']);
    expect(moveItem(items, 9, 0)).toEqual(items);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });
});
