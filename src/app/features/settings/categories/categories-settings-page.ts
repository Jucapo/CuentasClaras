import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import { CategoriesService } from '../../../core/categories/categories.service';
import { Category, CategoryKind } from '../../../core/categories/category.models';
import { TagsService } from '../../../core/categories/tags.service';
import {
  CATEGORY_KIND_LABELS,
  CATEGORY_KIND_PARAM,
  categoryKindFromParam,
} from '../../../core/config/catalog.constants';
import {
  APP_PATHS,
  CATEGORY_QUERY_PARAMS,
  NEW_ITEM_PATH,
  SETTINGS_PATHS,
} from '../../../core/routing/app-paths';
import { SpaceService } from '../../../core/spaces/space.service';
import { effectiveColor } from '../../../domain/categories/category-tree';
import { Button } from '../../../shared/ui/atoms/button/button';
import { Message } from '../../../shared/ui/atoms/message/message';
import {
  SegmentedControl,
  SegmentOption,
} from '../../../shared/ui/atoms/segmented-control/segmented-control';
import { PageHeader } from '../../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../../shared/ui/molecules/section/section';
import {
  CategoryList,
  CategoryListEntry,
  CategoryListNode,
  CategoryReorder,
} from '../../../shared/ui/organisms/category-list/category-list';
import { ToastService } from '../../../shared/ui/services/toast.service';

/** Configuración → Categorías: expense and income categories with subcategories and order. */
@Component({
  selector: 'app-categories-settings-page',
  imports: [PageHeader, SegmentedControl, Button, Message, Section, CategoryList],
  templateUrl: './categories-settings-page.html',
  styleUrl: './categories-settings-page.scss',
})
export class CategoriesSettingsPage {
  /** Query param `clase`: which kind to show. */
  readonly clase = input<string>();

  private readonly categories = inject(CategoriesService);
  private readonly tags = inject(TagsService);
  private readonly spaces = inject(SpaceService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly loaded = this.categories.loaded;
  protected readonly loadError = this.categories.loadError;
  protected readonly backLink = ['/', APP_PATHS.settings];
  protected readonly listPath = ['/', APP_PATHS.settings, SETTINGS_PATHS.categories];
  protected readonly newLink = [...this.listPath, NEW_ITEM_PATH];
  protected readonly kindOptions: readonly SegmentOption<CategoryKind>[] = [
    { value: 'expense', label: CATEGORY_KIND_LABELS.expense },
    { value: 'income', label: CATEGORY_KIND_LABELS.income },
  ];

  protected readonly kind = linkedSignal<CategoryKind>(() => categoryKindFromParam(this.clase()));
  protected readonly newParams = computed(() => ({
    [CATEGORY_QUERY_PARAMS.kind]: CATEGORY_KIND_PARAM[this.kind()],
  }));

  protected readonly nodes = computed<CategoryListNode[]>(() => {
    const tagNames = new Map(this.tags.tags().map((tag) => [tag.id, tag.name]));
    return this.categories.tree(this.kind()).map(({ category, children }) => ({
      ...this.entry(category, null, tagNames),
      children: children.map((child) => this.entry(child, category, tagNames)),
      addChildLink: this.canEdit() ? this.newLink : undefined,
      addChildQueryParams: {
        ...this.newParams(),
        [CATEGORY_QUERY_PARAMS.parent]: category.id,
      },
    }));
  });
  protected readonly archived = computed(() =>
    this.categories
      .categories()
      .filter((category) => category.kind === this.kind() && category.archived_at)
      .map((category) => ({
        ...this.entry(category, this.categories.find(category.parent_id ?? ''), new Map()),
        children: [],
        subtitle: 'Archivada',
      })),
  );
  protected readonly isEmpty = computed(() => this.loaded() && this.nodes().length === 0);

  protected changeKind(kind: CategoryKind): void {
    this.kind.set(kind);
    void this.router.navigate(this.listPath, {
      queryParams: { [CATEGORY_QUERY_PARAMS.kind]: CATEGORY_KIND_PARAM[kind] },
      replaceUrl: true,
    });
  }

  protected async reorder(change: CategoryReorder): Promise<void> {
    const saved = await this.categories.reorder(change.ids);
    if (!saved.ok) {
      void this.toast.show(saved.message);
    }
  }

  private entry(
    category: Category,
    parent: Category | null,
    tagNames: ReadonlyMap<string, string>,
  ): CategoryListEntry {
    const tags = category.default_tag_ids
      .map((id) => tagNames.get(id))
      .filter((name): name is string => !!name);
    return {
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: effectiveColor(category, parent),
      subtitle: tags.length > 0 ? tags.join(' · ') : undefined,
      link: [...this.listPath, category.id],
    };
  }
}
