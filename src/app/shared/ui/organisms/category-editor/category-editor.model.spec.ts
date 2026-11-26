import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apply, form } from '@angular/forms/signals';
import {
  CATEGORY_FORM_MESSAGES,
  categoryFormSchema,
  categoryFormToRow,
  CategoryFormValue,
  categoryToFormValue,
  newCategoryFormValue,
} from './category-editor.model';

describe('category form model', () => {
  it('starts a subcategory inheriting the color of its parent', () => {
    expect(newCategoryFormValue('expense').color).toBe('blue');
    expect(newCategoryFormValue('expense', 'hogar')).toMatchObject({
      parentId: 'hogar',
      color: null,
    });
  });

  it('maps a top-level category to an empty parent and back to null', () => {
    const value = categoryToFormValue(
      { name: 'Hogar', kind: 'expense', parent_id: null, icon: 'home', color: 'orange' },
      ['fijos'],
    );
    expect(value.parentId).toBe('');
    expect(categoryFormToRow({ ...value, name: ' Casa ' })).toEqual({
      name: 'Casa',
      parent_id: null,
      icon: 'home',
      color: 'orange',
    });
  });

  describe('validation', () => {
    function errors(value: Partial<CategoryFormValue>): string[] {
      const model = signal({ ...newCategoryFormValue('expense'), name: 'Mercado', ...value });
      const f = TestBed.runInInjectionContext(() =>
        form(model, (path) => apply(path, categoryFormSchema)),
      );
      return f()
        .errorSummary()
        .map((error) => error.message ?? '');
    }

    it('accepts a category with its own color and a subcategory that inherits', () => {
      expect(errors({})).toEqual([]);
      expect(errors({ parentId: 'hogar', color: null })).toEqual([]);
    });

    it('needs a color of its own for a top-level category', () => {
      expect(errors({ parentId: '', color: null })).toEqual([CATEGORY_FORM_MESSAGES.colorRequired]);
    });

    it('needs a name of at most 40 characters', () => {
      expect(errors({ name: '  ' })).toContain(CATEGORY_FORM_MESSAGES.nameRequired);
      expect(errors({ name: 'x'.repeat(41) })).toContain(CATEGORY_FORM_MESSAGES.nameTooLong);
    });
  });
});
