import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { apply, disabled, form } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { isInUse } from '../../../../core/catalogs/catalog-result';
import { CategoriesService } from '../../../../core/categories/categories.service';
import { TagsService } from '../../../../core/categories/tags.service';
import {
  CATEGORY_KIND_PARAM,
  categoryKindFromParam,
} from '../../../../core/config/catalog.constants';
import {
  APP_PATHS,
  CATEGORY_QUERY_PARAMS,
  SETTINGS_PATHS,
} from '../../../../core/routing/app-paths';
import { SpaceService } from '../../../../core/spaces/space.service';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Message } from '../../../../shared/ui/atoms/message/message';
import { ChipOption } from '../../../../shared/ui/molecules/chip-select/chip-select';
import { FormActions } from '../../../../shared/ui/molecules/form-actions/form-actions';
import { Form } from '../../../../shared/ui/molecules/form/form';
import { PageHeader } from '../../../../shared/ui/molecules/page-header/page-header';
import {
  CategoryForm,
  ParentCategoryOption,
} from '../../../../shared/ui/organisms/category-form/category-form';
import {
  categoryFormSchema,
  categoryFormToRow,
  CategoryFormValue,
  categoryToFormValue,
  newCategoryFormValue,
} from '../../../../shared/ui/organisms/category-form/category-form.model';
import { ConfirmService } from '../../../../shared/ui/services/confirm.service';
import { ToastService } from '../../../../shared/ui/services/toast.service';

/** Creates a category or subcategory, or edits, archives and deletes one. */
@Component({
  selector: 'app-category-edit-page',
  imports: [PageHeader, Form, FormActions, Button, Message, CategoryForm],
  templateUrl: './category-edit-page.html',
  styleUrl: './category-edit-page.scss',
})
export class CategoryEditPage {
  /** Route param; absent when creating. */
  readonly id = input<string>();
  /** Query param `clase` of a new category. */
  readonly clase = input<string>();
  /** Query param `padre` of a new subcategory. */
  readonly padre = input<string>();

  private readonly categories = inject(CategoriesService);
  private readonly tags = inject(TagsService);
  private readonly spaces = inject(SpaceService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly canEdit = this.spaces.canEdit;
  private readonly listPath = ['/', APP_PATHS.settings, SETTINGS_PATHS.categories];
  protected readonly existing = computed(() => {
    const id = this.id();
    return id ? (this.categories.categories().find((category) => category.id === id) ?? null) : null;
  });
  protected readonly notFound = computed(
    () => !!this.id() && this.categories.loaded() && !this.existing(),
  );
  protected readonly archived = computed(() => !!this.existing()?.archived_at);
  private readonly children = computed(() => {
    const category = this.existing();
    return category
      ? this.categories.categories().filter((child) => child.parent_id === category.id)
      : [];
  });

  private readonly model = linkedSignal<CategoryFormValue>(() => {
    const category = this.existing();
    return category
      ? categoryToFormValue(category, category.default_tag_ids)
      : newCategoryFormValue(categoryKindFromParam(this.clase()), this.padre() ?? '');
  });
  protected readonly form = form(
    this.model,
    (path) => {
      apply(path, categoryFormSchema);
      disabled(path, () => !this.canEdit());
      // The kind never changes after creating (spec §4.3); a category with subcategories stays
      // top-level.
      disabled(path.kind, () => !!this.existing());
      disabled(path.parentId, () => this.children().length > 0);
    },
    { submission: { action: () => this.save() } },
  );

  protected readonly title = computed(() => {
    const category = this.existing();
    if (category) {
      return category.name;
    }
    return this.model().parentId ? 'Nueva subcategoría' : 'Nueva categoría';
  });
  protected readonly backLink = this.listPath;
  protected readonly backParams = computed(() => ({
    [CATEGORY_QUERY_PARAMS.kind]: CATEGORY_KIND_PARAM[this.model().kind],
  }));
  protected readonly parents = computed<ParentCategoryOption[]>(() =>
    this.categories
      .categories()
      .filter(
        (category) =>
          !category.parent_id && !category.archived_at && category.id !== this.existing()?.id,
      )
      .map(({ id, name, kind, color }) => ({ id, name, kind, color })),
  );
  protected readonly tagOptions = computed<ChipOption[]>(() =>
    this.tags.activeTags().map((tag) => ({ value: tag.id, label: tag.name, color: tag.color })),
  );

  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly inUse = signal(false);
  protected readonly busy = signal(false);

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
      await this.goBack();
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
    await this.goBack();
  }

  private async save(): Promise<void> {
    this.error.set(null);
    const value = this.model();
    const row = categoryFormToRow(value);
    const category = this.existing();
    const result = category
      ? await this.categories.update(category.id, row, value.tagIds)
      : await this.categories.create({ ...row, kind: value.kind }, value.tagIds);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    void this.toast.show(category ? 'Categoría guardada.' : 'Categoría creada.');
    await this.goBack();
  }

  private goBack(): Promise<boolean> {
    return this.router.navigate(this.listPath, { queryParams: this.backParams() });
  }
}
