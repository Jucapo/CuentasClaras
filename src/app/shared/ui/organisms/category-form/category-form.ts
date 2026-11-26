import { Component, computed, effect, input, untracked } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { CATEGORY_KIND_LABELS } from '../../../../core/config/catalog.constants';
import { CategoryKind } from '../../../../core/categories/category.models';
import { SegmentedControl, SegmentOption } from '../../atoms/segmented-control/segmented-control';
import { Select, SelectOption } from '../../atoms/select/select';
import { TextField } from '../../atoms/text-field/text-field';
import { ChipOption, ChipSelect } from '../../molecules/chip-select/chip-select';
import { ColorPicker } from '../../molecules/color-picker/color-picker';
import { IconPicker } from '../../molecules/icon-picker/icon-picker';
import { CategoryFormValue } from './category-form.model';

/** A top-level category that can be picked as parent. */
export interface ParentCategoryOption {
  readonly id: string;
  readonly name: string;
  readonly kind: CategoryKind;
  readonly color: string | null;
}

/**
 * Fields of a category or subcategory (spec §4.3). Used by Configuración and the setup wizard;
 * validate the tree with `categoryFormSchema` and disable `kind`/`parentId` when they cannot change.
 */
@Component({
  selector: 'cc-category-form',
  imports: [FormField, SegmentedControl, TextField, Select, IconPicker, ColorPicker, ChipSelect],
  templateUrl: './category-form.html',
  styleUrl: './category-form.scss',
})
export class CategoryForm {
  readonly fields = input.required<FieldTree<CategoryFormValue>>();
  /** Top-level categories of both kinds; the form offers those of the current kind. */
  readonly parents = input<readonly ParentCategoryOption[]>([]);
  readonly tagOptions = input<readonly ChipOption[]>([]);

  protected readonly kindOptions: readonly SegmentOption<CategoryKind>[] = [
    { value: 'expense', label: CATEGORY_KIND_LABELS.expense },
    { value: 'income', label: CATEGORY_KIND_LABELS.income },
  ];

  private readonly kind = computed(() => this.fields().kind().value());
  private readonly parent = computed(
    () => this.parents().find((parent) => parent.id === this.fields().parentId().value()) ?? null,
  );
  protected readonly parentOptions = computed<readonly SelectOption<string>[]>(() => [
    { value: '', label: 'Ninguna: es una categoría principal' },
    ...this.parents()
      .filter((parent) => parent.kind === this.kind())
      .map((parent) => ({ value: parent.id, label: parent.name })),
  ]);
  /** Color a subcategory inherits; null for a top-level category. */
  protected readonly parentColor = computed(() => this.parent()?.color ?? null);
  protected readonly previewColor = computed(
    () => this.fields().color().value() ?? this.parentColor(),
  );

  constructor() {
    // A parent of the other kind is not valid: switching the kind makes it top-level again.
    effect(() => {
      const kind = this.kind();
      untracked(() => {
        const parentId = this.fields().parentId();
        const parent = this.parents().find((option) => option.id === parentId.value());
        if (parent && parent.kind !== kind) {
          parentId.value.set('');
        }
      });
    });
  }
}
