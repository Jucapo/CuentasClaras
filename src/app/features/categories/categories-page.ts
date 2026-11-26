import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { CategoriesService } from '../../core/categories/categories.service';
import { CategoryKind } from '../../core/categories/category.models';
import {
  CATEGORY_KIND_LABELS,
  CATEGORY_KIND_PARAM,
  categoryKindFromParam,
} from '../../core/config/catalog.constants';
import { APP_PATHS, CATEGORY_PATHS, CATEGORY_QUERY_PARAMS } from '../../core/routing/app-paths';
import { SpaceService } from '../../core/spaces/space.service';
import { Button } from '../../shared/ui/atoms/button/button';
import { IconButton } from '../../shared/ui/atoms/icon-button/icon-button';
import { Message } from '../../shared/ui/atoms/message/message';
import { TabOption, Tabs } from '../../shared/ui/atoms/tabs/tabs';
import { PageHeader } from '../../shared/ui/molecules/page-header/page-header';
import { Section } from '../../shared/ui/molecules/section/section';
import {
  CategoryGrid,
  CategoryGridItem,
} from '../../shared/ui/organisms/category-grid/category-grid';
import { useShortcuts } from '../../shared/ui/services/keyboard-shortcuts';
import { CATEGORY_GRID_LABELS, CATEGORY_KIND_TABS, EMPTY_CATEGORIES_TITLE } from './category-texts';

/**
 * Home screen (spec §7): the categories of a kind around the donut. The pencil opens the edit
 * mode; amounts and the quick entry arrive in F1d.
 */
@Component({
  selector: 'app-categories-page',
  imports: [PageHeader, IconButton, Button, Message, Section, Tabs, CategoryGrid],
  templateUrl: './categories-page.html',
  styleUrl: './categories-page.scss',
})
export class CategoriesPage {
  /** Query param `clase`: which kind to show. */
  readonly clase = input<string>();

  private readonly categories = inject(CategoriesService);
  private readonly spaces = inject(SpaceService);
  private readonly router = inject(Router);

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly loadError = this.categories.loadError;
  protected readonly kindTabs: readonly TabOption<CategoryKind>[] = CATEGORY_KIND_TABS;
  protected readonly kind = computed(() => categoryKindFromParam(this.clase()));
  protected readonly kindLabel = computed(() => CATEGORY_KIND_LABELS[this.kind()]);
  protected readonly gridLabel = computed(() => CATEGORY_GRID_LABELS[this.kind()]);
  protected readonly items = computed<CategoryGridItem[]>(() =>
    this.categories.tree(this.kind()).map(({ category }) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
    })),
  );
  protected readonly isEmpty = computed(
    () => this.categories.loaded() && this.items().length === 0,
  );
  protected readonly emptyTitle = computed(() => EMPTY_CATEGORIES_TITLE[this.kind()]);

  constructor() {
    useShortcuts({ e: () => void this.edit() });
  }

  protected changeKind(kind: CategoryKind): void {
    void this.router.navigate(['/', APP_PATHS.categories], {
      queryParams: { [CATEGORY_QUERY_PARAMS.kind]: CATEGORY_KIND_PARAM[kind] },
      replaceUrl: true,
    });
  }

  protected async edit(): Promise<void> {
    if (!this.canEdit()) {
      return;
    }
    await this.router.navigate(['/', APP_PATHS.categories, CATEGORY_PATHS.edit], {
      queryParams: { [CATEGORY_QUERY_PARAMS.kind]: CATEGORY_KIND_PARAM[this.kind()] },
    });
  }
}
