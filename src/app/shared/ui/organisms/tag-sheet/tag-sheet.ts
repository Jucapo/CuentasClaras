import { Component, computed, inject, signal } from '@angular/core';
import { apply, form, FormField, submit } from '@angular/forms/signals';
import { ActionResult } from '../../../../core/action-result';
import { Button } from '../../atoms/button/button';
import { ColorSwatch } from '../../atoms/color-swatch/color-swatch';
import { Message } from '../../atoms/message/message';
import { TextField } from '../../atoms/text-field/text-field';
import { ColorGrid } from '../../molecules/color-grid/color-grid';
import { Disclosure } from '../../molecules/disclosure/disclosure';
import { FormActions } from '../../molecules/form-actions/form-actions';
import { Form } from '../../molecules/form/form';
import { OverlayPanel } from '../../molecules/overlay-panel/overlay-panel';
import { OVERLAY_DATA, OverlayHandle } from '../../services/overlay.service';
import { UI_TEXT } from '../../ui.constants';
import { CategoryChecklist, CategoryChecklistNode } from '../category-checklist/category-checklist';
import { tagFormSchema, TagFormValue } from './tag-sheet.model';

/** What the sheet asks the page to do after closing; `saved` means it already saved. */
export type TagSheetResult = 'saved' | 'archive' | 'unarchive' | 'delete';

/** A group of categories the tag can apply to, e.g. Gastos. */
export interface TagSheetCategoryGroup {
  readonly label: string;
  readonly nodes: readonly CategoryChecklistNode[];
}

/** Data of `cc-tag-sheet`. */
export interface TagSheetData {
  readonly title: string;
  readonly value: TagFormValue;
  /** Categories where the tag can apply by default; the section hides without any. */
  readonly categories?: readonly TagSheetCategoryGroup[];
  /** Archive or unarchive, and delete; omitted when creating. */
  readonly actions?: { readonly archived: boolean; readonly canDelete: boolean };
  /** Saves the values; the sheet shows the error or closes. */
  readonly save: (value: TagFormValue) => Promise<ActionResult>;
}

/**
 * A tag in a short sheet (spec §7): name, color and the categories where it applies by default,
 * inline because a sheet never opens another. Archiving and deleting close the sheet so the page
 * can confirm (spec §13.5).
 */
@Component({
  selector: 'cc-tag-sheet',
  imports: [
    FormField,
    OverlayPanel,
    Form,
    TextField,
    ColorGrid,
    ColorSwatch,
    Disclosure,
    CategoryChecklist,
    FormActions,
    Button,
    Message,
  ],
  templateUrl: './tag-sheet.html',
  styleUrl: './tag-sheet.scss',
})
export class TagSheet {
  protected readonly data = inject<TagSheetData>(OVERLAY_DATA);
  private readonly handle = inject<OverlayHandle<TagSheetResult>>(OverlayHandle);

  protected readonly text = UI_TEXT;
  protected readonly error = signal<string | null>(null);
  protected readonly categoryGroups = (this.data.categories ?? []).filter(
    (group) => group.nodes.length > 0,
  );

  private readonly model = signal<TagFormValue>(this.data.value);
  protected readonly form = form(this.model, (path) => apply(path, tagFormSchema), {
    submission: { action: () => this.save() },
  });

  protected readonly categoriesLabel = computed(() => {
    const count = this.model().categoryIds.length;
    return count === 0
      ? '¿En qué categorías se pone sola?'
      : `¿En qué categorías se pone sola? (${count})`;
  });

  protected setCategories(ids: readonly string[], group: TagSheetCategoryGroup): void {
    const own = new Set(
      group.nodes.flatMap((node) => [node.id, ...node.children.map((c) => c.id)]),
    );
    this.model.update((value) => ({
      ...value,
      categoryIds: [...value.categoryIds.filter((id) => !own.has(id)), ...ids],
    }));
  }

  protected done(): void {
    void submit(this.form);
  }

  protected act(result: Exclude<TagSheetResult, 'saved'>): void {
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
