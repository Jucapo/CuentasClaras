import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  untracked,
} from '@angular/core';
import { apply, disabled, form, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { ActionResult } from '../../../core/action-result';
import { isInUse } from '../../../core/catalogs/catalog-result';
import { CategoriesService } from '../../../core/categories/categories.service';
import { Category } from '../../../core/categories/category.models';
import { TagsService } from '../../../core/categories/tags.service';
import { CATEGORY_KIND_PARAM, categoryKindFromParam } from '../../../core/config/catalog.constants';
import {
  APP_PATHS,
  CATEGORY_PATHS,
  CATEGORY_QUERY_PARAMS,
} from '../../../core/routing/app-paths';
import { HasUnsavedChanges } from '../../../core/routing/unsaved-changes.guard';
import { SpaceService } from '../../../core/spaces/space.service';
import { effectiveColor } from '../../../domain/categories/category-tree';
import { Button } from '../../../shared/ui/atoms/button/button';
import { Message } from '../../../shared/ui/atoms/message/message';
import { ChipOption } from '../../../shared/ui/molecules/chip-select/chip-select';
import { FormActions } from '../../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../../shared/ui/molecules/form/form';
import { CategoryEditor } from '../../../shared/ui/organisms/category-editor/category-editor';
import {
  categoryFormSchema,
  categoryFormToRow,
  CategoryFormValue,
  categoryToFormValue,
  newCategoryFormValue,
} from '../../../shared/ui/organisms/category-editor/category-editor.model';
import { CategoryListEntry } from '../../../shared/ui/organisms/category-list/category-list';
import {
  ParentCategoryOption,
  SubcategorySheet,
  SubcategorySheetData,
  SubcategorySheetResult,
} from '../../../shared/ui/organisms/subcategory-sheet/subcategory-sheet';
import { ConfirmService } from '../../../shared/ui/services/confirm.service';
import { useShortcuts } from '../../../shared/ui/services/keyboard-shortcuts';
import { OverlayService } from '../../../shared/ui/services/overlay.service';
import { ToastService } from '../../../shared/ui/services/toast.service';
import { FlowLayout } from '../../../shared/ui/templates/flow-layout/flow-layout';

/** Navigation state that asks the category screen to open a new subcategory once it loads. */
const ADD_SUBCATEGORY_STATE = 'ccAddSubcategory';

/**
 * A category as a flow (spec §7, §13.5): name, icon and color, default tags and subcategories,
 * which open in a sheet. Creating at `/categorias/editar/nueva?clase=…`, editing at `…/:id`.
 */
@Component({
  selector: 'app-category-page',
  imports: [FlowLayout, Form, FormActions, Button, Message, CategoryEditor],
  templateUrl: './category-page.html',
  styleUrl: './category-page.scss',
})
export class CategoryPage implements HasUnsavedChanges {
  /** Route param; absent when creating. */
  readonly id = input<string>();
  /** Query param `clase`: kind of a new category. */
  readonly clase = input<string>();

  private readonly categories = inject(CategoriesService);
  private readonly tags = inject(TagsService);
  private readonly spaces = inject(SpaceService);
  private readonly router = inject(Router);
  private readonly overlay = inject(OverlayService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly existing = computed(() => {
    const id = this.id();
    return id ? (this.categories.categories().find((category) => category.id === id) ?? null) : null;
  });
  protected readonly loading = computed(() => !!this.id() && !this.categories.loaded());
  protected readonly notFound = computed(
    () => !!this.id() && this.categories.loaded() && !this.existing(),
  );
  protected readonly archived = computed(() => !!this.existing()?.archived_at);
  protected readonly title = computed(() =>
    this.id() ? (this.existing()?.name ?? 'Categoría') : 'Nueva categoría',
  );

  /** Kind of a new category, read once: query params reach every routed screen of the tree. */
  private readonly newKind = linkedSignal({
    source: this.id,
    computation: () => categoryKindFromParam(untracked(this.clase)),
  });

  // Local state starts over when another category opens in the same screen.
  protected readonly error = linkedSignal<string | undefined, string | null>({
    source: this.id,
    computation: () => null,
  });
  protected readonly actionError = linkedSignal<string | undefined, string | null>({
    source: this.id,
    computation: () => null,
  });
  protected readonly inUse = linkedSignal({ source: this.id, computation: () => false });
  protected readonly busy = linkedSignal({ source: this.id, computation: () => false });

  /** Values to edit, recomputed only when another category opens or the categories load. */
  private readonly loadedValue = computed<CategoryFormValue>(() => {
    const id = this.id();
    const kind = this.newKind();
    this.categories.loaded();
    return untracked(() => {
      const category = id ? this.categories.find(id) : null;
      return category
        ? categoryToFormValue(category, category.default_tag_ids)
        : newCategoryFormValue(kind);
    });
  });
  private readonly model = linkedSignal(() => this.loadedValue());
  /** What the model held when it was loaded or last saved. */
  private readonly baseline = linkedSignal(() => JSON.stringify(this.loadedValue()));

  protected readonly form = form(
    this.model,
    (path) => {
      apply(path, categoryFormSchema);
      disabled(path, () => !this.canEdit());
    },
    { submission: { action: () => this.save() } },
  );

  protected readonly tagOptions = computed<ChipOption[]>(() =>
    this.tags.activeTags().map((tag) => ({ value: tag.id, label: tag.name, color: tag.color })),
  );
  private readonly children = computed(() => {
    const category = this.existing();
    return category
      ? this.categories
          .categories()
          .filter((child) => child.parent_id === category.id)
          .sort((a, b) => a.sort_order - b.sort_order)
      : [];
  });
  protected readonly subcategories = computed(() =>
    this.children()
      .filter((child) => !child.archived_at)
      .map((child) => this.entry(child)),
  );
  protected readonly archivedSubcategories = computed(() =>
    this.children()
      .filter((child) => child.archived_at)
      .map((child) => ({ ...this.entry(child), muted: true })),
  );

  constructor() {
    useShortcuts({
      Escape: () => void this.close(),
      'Mod+s': () => this.submitForm(),
    });

    // A new category saved by "Añadir subcategoría" opens the subcategory sheet once it loads.
    let addSubcategory =
      this.router.currentNavigation()?.extras.state?.[ADD_SUBCATEGORY_STATE] === true;
    effect(() => {
      const category = this.existing();
      if (addSubcategory && category) {
        addSubcategory = false;
        untracked(() => void this.openSubcategory(null));
      }
    });
  }

  hasUnsavedChanges(): boolean {
    return this.canEdit() && JSON.stringify(this.model()) !== this.baseline();
  }

  protected submitForm(): void {
    if (this.canEdit()) {
      void submit(this.form);
    }
  }

  protected async close(): Promise<void> {
    await this.router.navigate(this.gridPath(), { queryParams: this.kindParams() });
  }

  /** New categories are saved first: their subcategories need them in the database. */
  protected async addSubcategory(): Promise<void> {
    if (this.existing()) {
      await this.openSubcategory(null);
      return;
    }
    this.form().markAsTouched();
    if (this.form().invalid()) {
      return;
    }
    const id = await this.create();
    if (!id) {
      return;
    }
    void this.toast.show('Categoría guardada.');
    await this.router.navigate([...this.gridPath(), id], {
      queryParams: this.kindParams(),
      replaceUrl: true,
      state: { [ADD_SUBCATEGORY_STATE]: true },
    });
  }

  /** Opens the sheet of a subcategory, or of a new one with `null`. */
  protected async openSubcategory(id: string | null): Promise<void> {
    const parent = this.existing();
    if (!parent) {
      return;
    }
    const subcategory = id ? this.categories.find(id) : null;
    const value = subcategory
      ? categoryToFormValue(subcategory, subcategory.default_tag_ids)
      : newCategoryFormValue(parent.kind, parent.id);
    const result = await this.overlay.open<SubcategorySheetResult, SubcategorySheetData>(
      SubcategorySheet,
      {
        label: subcategory ? subcategory.name : 'Nueva subcategoría',
        autoFocus: subcategory ? undefined : 'input',
        data: {
          title: subcategory ? 'Subcategoría' : 'Nueva subcategoría',
          value,
          parents: this.parentOptions(parent),
          tagOptions: this.tagOptions(),
          actions:
            subcategory && this.canEdit()
              ? { archived: !!subcategory.archived_at, canDelete: true }
              : undefined,
          save: (changed) => this.saveSubcategory(subcategory, changed),
        },
      },
    );
    if (!subcategory || !result || result === 'saved') {
      return;
    }
    if (result === 'delete') {
      await this.removeSubcategory(subcategory);
    } else {
      await this.archiveSubcategory(subcategory, result === 'archive');
    }
  }

  protected async reorderSubcategories(ids: readonly string[]): Promise<void> {
    const saved = await this.categories.reorder(ids);
    if (!saved.ok) {
      void this.toast.show(saved.message);
    }
  }

  protected async toggleArchived(): Promise<void> {
    const category = this.existing();
    if (!category) {
      return;
    }
    this.busy.set(true);
    const result = await this.categories.setArchived(category.id, !category.archived_at);
    this.busy.set(false);
    if (!result.ok) {
      this.actionError.set(result.message);
      return;
    }
    this.inUse.set(false);
    this.actionError.set(null);
    void this.toast.show(category.archived_at ? 'Categoría restaurada.' : 'Categoría archivada.');
    if (!category.archived_at) {
      this.markSaved();
      await this.close();
    }
  }

  protected async remove(): Promise<void> {
    const category = this.existing();
    if (!category) {
      return;
    }
    const children = this.children().map((child) => child.name);
    const confirmed = await this.confirm.confirm({
      title: `¿Eliminar ${category.name}?`,
      message:
        children.length === 0
          ? 'Se elimina para siempre. Si solo quieres ocultarla, archívala.'
          : children.length === 1
            ? 'También se eliminará su subcategoría:'
            : `También se eliminarán sus ${children.length} subcategorías:`,
      details: children,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.busy.set(true);
    const result = await this.categories.remove(category.id);
    this.busy.set(false);
    if (!result.ok) {
      this.actionError.set(result.message);
      this.inUse.set(isInUse(result));
      return;
    }
    void this.toast.show('Categoría eliminada.');
    this.markSaved();
    await this.close();
  }

  private async save(): Promise<void> {
    this.error.set(null);
    const category = this.existing();
    if (category) {
      const value = this.model();
      const result = await this.categories.update(
        category.id,
        categoryFormToRow(value),
        value.tagIds,
      );
      if (!result.ok) {
        this.error.set(result.message);
        return;
      }
      void this.toast.show('Categoría guardada.');
    } else {
      if (!(await this.create())) {
        return;
      }
      void this.toast.show('Categoría creada.');
    }
    this.markSaved();
    await this.close();
  }

  /** Creates the category being edited; returns its id, or null after showing the error. */
  private async create(): Promise<string | null> {
    this.error.set(null);
    const value = this.model();
    const result = await this.categories.create(
      { ...categoryFormToRow(value), kind: value.kind },
      value.tagIds,
    );
    if (!result.ok) {
      this.error.set(result.message);
      return null;
    }
    this.markSaved();
    return result.value;
  }

  private async saveSubcategory(
    subcategory: Category | null,
    value: CategoryFormValue,
  ): Promise<ActionResult> {
    const row = categoryFormToRow(value);
    const result = subcategory
      ? await this.categories.update(subcategory.id, row, value.tagIds)
      : await this.categories.create({ ...row, kind: value.kind }, value.tagIds);
    if (result.ok) {
      void this.toast.show(subcategory ? 'Subcategoría guardada.' : 'Subcategoría creada.');
    }
    return result.ok ? { ok: true } : result;
  }

  private async archiveSubcategory(subcategory: Category, archive: boolean): Promise<void> {
    const result = await this.categories.setArchived(subcategory.id, archive);
    void this.toast.show(
      !result.ok
        ? result.message
        : archive
          ? 'Subcategoría archivada.'
          : 'Subcategoría restaurada.',
    );
  }

  private async removeSubcategory(subcategory: Category): Promise<void> {
    const confirmed = await this.confirm.confirm({
      title: `¿Eliminar ${subcategory.name}?`,
      message: 'Se elimina para siempre. Si solo quieres ocultarla, archívala.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    const result = await this.categories.remove(subcategory.id);
    void this.toast.show(result.ok ? 'Subcategoría eliminada.' : result.message);
  }

  /** Leaving after saving, archiving or deleting needs no confirmation. */
  private markSaved(): void {
    this.baseline.set(JSON.stringify(this.model()));
  }

  private parentOptions(parent: Category): ParentCategoryOption[] {
    return this.categories
      .tree(parent.kind)
      .map(({ category }) => ({ id: category.id, name: category.name, color: category.color }));
  }

  private entry(child: Category): CategoryListEntry {
    const tagNames = new Map(this.tags.tags().map((tag) => [tag.id, tag.name]));
    const tags = child.default_tag_ids
      .map((id) => tagNames.get(id))
      .filter((name): name is string => !!name);
    return {
      id: child.id,
      name: child.name,
      icon: child.icon,
      color: effectiveColor(child, this.existing()),
      subtitle: tags.length > 0 ? tags.join(' · ') : undefined,
    };
  }

  private gridPath(): string[] {
    return ['/', APP_PATHS.categories, CATEGORY_PATHS.edit];
  }

  private kindParams(): Record<string, string> {
    return { [CATEGORY_QUERY_PARAMS.kind]: CATEGORY_KIND_PARAM[this.model().kind] };
  }
}
