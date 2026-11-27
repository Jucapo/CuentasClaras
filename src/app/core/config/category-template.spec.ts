import { NAME_MAX_LENGTH } from './catalog.constants';
import { CATEGORY_TEMPLATE } from './category-template';

describe('CATEGORY_TEMPLATE', () => {
  it('suggests names the database accepts: trimmed, short and unique among siblings', () => {
    for (const kind of ['expense', 'income'] as const) {
      const names = CATEGORY_TEMPLATE[kind].map((category) => category.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
      for (const category of CATEGORY_TEMPLATE[kind]) {
        const children = category.children.map((child) => child.name.toLowerCase());
        expect(new Set(children).size).toBe(children.length);
        for (const name of [category.name, ...category.children.map((child) => child.name)]) {
          expect(name.length).toBeLessThanOrEqual(NAME_MAX_LENGTH.category);
          expect(name).toBe(name.trim());
        }
      }
    }
  });

  it('follows the suggested template of the spec (Anexo A)', () => {
    expect(CATEGORY_TEMPLATE.expense).toHaveLength(13);
    expect(CATEGORY_TEMPLATE.income.map((category) => category.name)).toEqual([
      'Salario',
      'Trabajo independiente',
      'Intereses',
      'Otros',
    ]);
  });
});
