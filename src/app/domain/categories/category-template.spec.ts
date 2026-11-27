import { checklistIds } from './category-checklist';
import { pickTemplate, TemplateCategory, templateNodes } from './category-template';

describe('category template', () => {
  const template: readonly TemplateCategory[] = [
    {
      name: 'Hogar',
      icon: 'home',
      color: 'orange',
      children: [
        { name: 'Arriendo', icon: 'key' },
        { name: 'Aseo', icon: 'cleaning_services' },
      ],
    },
    { name: 'Regalos', icon: 'card_giftcard', color: 'rose', children: [] },
  ];

  it('gives every category and subcategory a checklist id', () => {
    expect(checklistIds(templateNodes(template))).toEqual(['0', '0.0', '0.1', '1']);
  });

  it('keeps only what is checked, subcategories without their own color', () => {
    const nodes = templateNodes(template);
    expect(pickTemplate(nodes, ['0', '0.1'])).toEqual([
      {
        name: 'Hogar',
        icon: 'home',
        color: 'orange',
        children: [{ name: 'Aseo', icon: 'cleaning_services' }],
      },
    ]);
  });

  it('creates nothing when nothing is checked', () => {
    expect(pickTemplate(templateNodes(template), [])).toEqual([]);
  });
});
