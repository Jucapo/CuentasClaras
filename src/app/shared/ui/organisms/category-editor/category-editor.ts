import { Component, computed, inject, input, output } from '@angular/core';
import { FieldTree, FormField } from '@angular/forms/signals';
import { TitleField } from '../../atoms/title-field/title-field';
import { AppearancePicker } from '../../molecules/appearance-picker/appearance-picker';
import { ChipOption } from '../../molecules/chip-select/chip-select';
import { Disclosure } from '../../molecules/disclosure/disclosure';
import { FieldRow } from '../../molecules/field-row/field-row';
import { FlowHero } from '../../molecules/flow-hero/flow-hero';
import { OptionPanel, OptionPanelData } from '../../molecules/option-panel/option-panel';
import { OverlayService } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { CategoryList, CategoryListEntry } from '../category-list/category-list';
import { CategoryFormValue } from './category-editor.model';

/** Texts of the category screen. */
const TEXT = {
  tags: 'Etiquetas por defecto',
  noTags: 'Ninguna',
  noTagsYet: 'Aún no hay etiquetas. Créalas en Configuración → Etiquetas.',
  subcategories: 'Subcategorías',
  addSubcategory: 'Añadir subcategoría',
} as const;

let nextEditorId = 0;

/**
 * A category as a short flow (spec §7, §13.5): the large name with the icon and color badge, its
 * default tags, and its subcategories with "Añadir subcategoría". Subcategories open in a sheet
 * that the page shows (`cc-subcategory-sheet`). Validate the tree with `categoryFormSchema`.
 */
@Component({
  selector: 'cc-category-editor',
  imports: [FormField, FlowHero, TitleField, AppearancePicker, FieldRow, CategoryList, Disclosure],
  templateUrl: './category-editor.html',
  styleUrl: './category-editor.scss',
})
export class CategoryEditor {
  readonly fields = input.required<FieldTree<CategoryFormValue>>();
  /** Active tags that can be defaults. */
  readonly tagOptions = input<readonly ChipOption[]>([]);
  readonly subcategories = input<readonly CategoryListEntry[]>([]);
  readonly archivedSubcategories = input<readonly CategoryListEntry[]>([]);
  /** Shows "Añadir subcategoría" and lets subcategories move. */
  readonly canEdit = input(true);
  /** Puts the cursor in the name; only when creating (spec §13.5). */
  readonly autofocusName = input(false);
  readonly openSubcategory = output<string>();
  readonly addSubcategory = output<void>();
  readonly reorderSubcategories = output<readonly string[]>();

  private readonly overlay = inject(OverlayService);

  protected readonly text = { ...UI_TEXT, ...TEXT };
  protected readonly titleId = `cc-category-editor-${nextEditorId++}`;
  protected readonly tagsText = computed(() => {
    const names = new Map(this.tagOptions().map((tag) => [tag.value, tag.label]));
    const picked = this.fields()
      .tagIds()
      .value()
      .map((id) => names.get(id))
      .filter((name): name is string => !!name);
    return picked.length > 0 ? picked.join(', ') : TEXT.noTags;
  });
  protected readonly archivedLabel = computed(
    () => `Archivadas (${this.archivedSubcategories().length})`,
  );

  protected async pickTags(): Promise<void> {
    const tagIds = this.fields().tagIds;
    const picked = await this.overlay.open<readonly string[], OptionPanelData<string>>(
      OptionPanel,
      {
        label: TEXT.tags,
        data: {
          title: TEXT.tags,
          mode: 'multiple',
          selected: tagIds().value(),
          emptyText: TEXT.noTagsYet,
          options: this.tagOptions().map((tag) => ({
            value: tag.value,
            label: tag.label,
            icon: 'label',
            color: tag.color ?? null,
          })),
        },
      },
    );
    if (picked) {
      tagIds().value.set([...picked]);
    }
  }
}
