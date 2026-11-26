import { Component, computed, inject, signal } from '@angular/core';
import { apply, form, FormField, submit } from '@angular/forms/signals';
import { ActionResult } from '../../../../core/action-result';
import { NAME_MAX_LENGTH } from '../../../../core/config/catalog.constants';
import { Button } from '../../atoms/button/button';
import { IconBadge } from '../../atoms/icon-badge/icon-badge';
import { Message } from '../../atoms/message/message';
import { Select, SelectOption } from '../../atoms/select/select';
import { TextField } from '../../atoms/text-field/text-field';
import { AppearanceEditor } from '../../molecules/appearance-editor/appearance-editor';
import { ChipOption, ChipSelect } from '../../molecules/chip-select/chip-select';
import { Disclosure } from '../../molecules/disclosure/disclosure';
import { FormActions } from '../../molecules/form-actions/form-actions';
import { Form } from '../../molecules/form/form';
import { OverlayPanel } from '../../molecules/overlay-panel/overlay-panel';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { categoryFormSchema, CategoryFormValue } from '../category-editor/category-editor.model';

/** A top-level category a subcategory can belong to. */
export interface ParentCategoryOption {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
}

/** What the sheet asks the page to do after closing; `saved` means it already saved. */
export type SubcategorySheetResult = 'saved' | 'archive' | 'unarchive' | 'delete';

/** Data of `cc-subcategory-sheet`. */
export interface SubcategorySheetData {
  readonly title: string;
  /** Starting values; `parentId` is the category it belongs to. */
  readonly value: CategoryFormValue;
  /** Active top-level categories of the same kind, its own included: it can move to them. */
  readonly parents: readonly ParentCategoryOption[];
  readonly tagOptions: readonly ChipOption[];
  /** Archive or unarchive, and delete; omitted when creating. */
  readonly actions?: { readonly archived: boolean; readonly canDelete: boolean };
  /** Saves the values; the sheet shows the error or closes. */
  readonly save: (value: CategoryFormValue) => Promise<ActionResult>;
}

/**
 * A subcategory in a sheet (spec §7): name, default tags and the icon grid. The color is inherited
 * from the category but can change; "Más opciones" moves it to another category or makes it a
 * main one. Archiving and deleting close the sheet so the page can confirm (spec §13.5).
 */
@Component({
  selector: 'cc-subcategory-sheet',
  imports: [
    FormField,
    OverlayPanel,
    Form,
    TextField,
    ChipSelect,
    AppearanceEditor,
    Select,
    Disclosure,
    FormActions,
    Button,
    IconBadge,
    Message,
  ],
  templateUrl: './subcategory-sheet.html',
  styleUrl: './subcategory-sheet.scss',
})
export class SubcategorySheet {
  protected readonly data = inject<SubcategorySheetData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<SubcategorySheetResult>>(OverlayHandle);

  protected readonly text = UI_TEXT;
  protected readonly nameMaxLength = NAME_MAX_LENGTH.category;
  protected readonly error = signal<string | null>(null);

  private readonly model = signal<CategoryFormValue>(this.data.value);
  protected readonly form = form(this.model, (path) => apply(path, categoryFormSchema), {
    submission: { action: () => this.save() },
  });

  protected readonly parentOptions: readonly SelectOption<string>[] = [
    { value: '', label: 'Ninguna: es una categoría principal' },
    ...this.data.parents.map((parent) => ({ value: parent.id, label: parent.name })),
  ];
  /** Color it inherits while it has none of its own; none once it is a main category. */
  protected readonly inheritFrom = computed(() => {
    const parentId = this.model().parentId;
    return this.data.parents.find((parent) => parent.id === parentId)?.color ?? null;
  });
  protected readonly shownColor = computed(() => this.model().color ?? this.inheritFrom());
  protected readonly colorError = computed(() => {
    const color = this.form.color();
    return color.touched() ? (color.errors()[0]?.message ?? null) : null;
  });

  protected done(): void {
    void submit(this.form);
  }

  protected act(result: Exclude<SubcategorySheetResult, 'saved'>): void {
    this.handle.close(result);
  }

  protected close(): void {
    this.handle.close();
  }

  private async save(): Promise<undefined> {
    this.error.set(null);
    const result = await this.data.save(this.model());
    if (!result.ok) {
      this.error.set(result.message);
      return undefined;
    }
    this.handle.close('saved');
    return undefined;
  }
}
