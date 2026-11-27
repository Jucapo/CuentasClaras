import { checklistIds, ChecklistNode, toggleChecklistItem } from './category-checklist';

describe('category checklist', () => {
  const nodes: readonly ChecklistNode[] = [
    { id: 'home', children: [{ id: 'rent' }, { id: 'utilities' }] },
    { id: 'gifts', children: [] },
  ];

  it('lists each category followed by its subcategories', () => {
    expect(checklistIds(nodes)).toEqual(['home', 'rent', 'utilities', 'gifts']);
  });

  describe('linked (what to create)', () => {
    it('checks a category with all its subcategories', () => {
      expect(toggleChecklistItem(nodes, [], 'home', true, true)).toEqual([
        'home',
        'rent',
        'utilities',
      ]);
    });

    it('unchecks a category with its subcategories', () => {
      const all = checklistIds(nodes);
      expect(toggleChecklistItem(nodes, all, 'home', false, true)).toEqual(['gifts']);
    });

    it('checks the category of a checked subcategory', () => {
      expect(toggleChecklistItem(nodes, ['gifts'], 'utilities', true, true)).toEqual([
        'home',
        'utilities',
        'gifts',
      ]);
    });

    it('keeps the category when one of its subcategories is unchecked', () => {
      const all = checklistIds(nodes);
      expect(toggleChecklistItem(nodes, all, 'rent', false, true)).toEqual([
        'home',
        'utilities',
        'gifts',
      ]);
    });
  });

  describe('independent (where a tag applies)', () => {
    it('checks only the item', () => {
      expect(toggleChecklistItem(nodes, [], 'home', true, false)).toEqual(['home']);
      expect(toggleChecklistItem(nodes, [], 'rent', true, false)).toEqual(['rent']);
    });

    it('unchecks only the item', () => {
      expect(toggleChecklistItem(nodes, ['home', 'rent'], 'home', false, false)).toEqual([
        'rent',
      ]);
    });
  });

  it('ignores the order of the given selection', () => {
    expect(toggleChecklistItem(nodes, ['gifts', 'rent'], 'home', true, false)).toEqual([
      'home',
      'rent',
      'gifts',
    ]);
  });
});
