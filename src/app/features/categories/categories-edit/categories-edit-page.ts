import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CategoriesService } from '../../../core/categories/categories.service';
import { CategoryKind } from '../../../core/categories/category.models';
import {
  CATEGORY_KIND_LABELS,
  CATEGORY_KIND_PARAM,
  categoryKindFromParam,
} from '../../../core/config/catalog.constants';
import {
  APP_PATHS,
  CATEGORY_PATHS,
  CATEGORY_QUERY_PARAMS,
  NEW_ITEM_PATH,
} from '../../../core/routing/app-paths';
import { originUrl } from '../../../core/routing/origin-url';
import { SpaceService } from '../../../core/spaces/space.service';
import { Button } from '../../../shared/ui/atoms/button/button';
import { Icon } from '../../../shared/ui/atoms/icon/icon';
import { Message } from '../../../shared/ui/atoms/message/message';
import { TabOption, Tabs } from '../../../shared/ui/atoms/tabs/tabs';
import { Disclosure } from '../../../shared/ui/molecules/disclosure/disclosure';
import {
  CategoryGrid,
  CategoryGridItem,
} from '../../../shared/ui/organisms/category-grid/category-grid';
import {
  CategoryList,
  CategoryListEntry,
} from '../../../shared/ui/organisms/category-list/category-list';
import { useShortcuts } from '../../../shared/ui/services/keyboard-shortcuts';
import { ToastService } from '../../../shared/ui/services/toast.service';
import { UI_TEXT } from '../../../shared/ui/ui.constants';
import { FlowLayout } from '../../../shared/ui/templates/flow-layout/flow-layout';
import { ListDetailLayout } from '../../../shared/ui/templates/list-detail-layout/list-detail-layout';
import { CategoryPage } from '../category/category-page';
import { CATEGORY_GRID_LABELS, CATEGORY_KIND_TABS } from '../category-texts';

/**
 * Edit mode of the categories (spec §7): the same grid with a "+" bubble; tapping a category opens
 * its screen and bubbles move by dragging. Reached from the pencil of Categorías and from
 * Configuración → Categorías: one flow, two ways in.
 */
@Component({
  selector: 'app-categories-edit-page',
  imports: [
    RouterOutlet,
    ListDetailLayout,
    FlowLayout,
    Tabs,
    CategoryGrid,
    CategoryList,
    Disclosure,
    Button,
    Icon,
    Message,
  ],
  templateUrl: './categories-edit-page.html',
  styleUrl: './categories-edit-page.scss',
})
export class CategoriesEditPage {
  /** Query param `clase`: which kind to show. */
  readonly clase = input<string>();

  private readonly categories = inject(CategoriesService);
  private readonly spaces = inject(SpaceService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  /** Where the user came from (the Categorías tab or Configuración); read while activating. */
  private readonly origin = originUrl(this.router);

  protected readonly canEdit = this.spaces.canEdit;
  protected readonly loadError = this.categories.loadError;
  protected readonly help = UI_TEXT.gridEditHelp;
  protected readonly kindTabs: readonly TabOption<CategoryKind>[] = CATEGORY_KIND_TABS;
  protected readonly kind = computed(() => categoryKindFromParam(this.clase()));
  protected readonly kindLabel = computed(() => CATEGORY_KIND_LABELS[this.kind()]);
  protected readonly gridLabel = computed(() => CATEGORY_GRID_LABELS[this.kind()]);

  /** The category screen open in the detail pane, if any. */
  private readonly detail = signal<CategoryPage | null>(null);
  protected readonly detailOpen = computed(() => this.detail() !== null);
  protected readonly selectedId = computed(() => this.detail()?.id() ?? null);

  protected readonly items = computed<CategoryGridItem[]>(() =>
    this.categories.tree(this.kind()).map(({ category }) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
    })),
  );
  /** Archived top-level categories; archived subcategories show in their category's screen. */
  protected readonly archived = computed<CategoryListEntry[]>(() =>
    this.categories
      .categories()
      .filter(
        (category) => category.kind === this.kind() && category.archived_at && !category.parent_id,
      )
      .map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
        color: category.color,
        subtitle: 'Archivada',
        muted: true,
      })),
  );
  protected readonly archivedLabel = computed(() => `Archivadas (${this.archived().length})`);

  constructor() {
    useShortcuts({
      n: () => void this.create(),
      Escape: () => void this.back(),
    });
  }

  protected onActivate(component: unknown): void {
    this.detail.set(component instanceof CategoryPage ? component : null);
  }

  protected onDeactivate(): void {
    this.detail.set(null);
  }

  /** Switching kind closes the open category: it belongs to the other tab. */
  protected changeKind(kind: CategoryKind): void {
    void this.router.navigate(this.editPath(), {
      queryParams: this.kindParams(kind),
      replaceUrl: true,
    });
  }

  protected open(id: string): void {
    void this.router.navigate([...this.editPath(), id], { queryParams: this.kindParams() });
  }

  protected async create(): Promise<void> {
    if (this.canEdit()) {
      await this.router.navigate([...this.editPath(), NEW_ITEM_PATH], {
        queryParams: this.kindParams(),
      });
    }
  }

  protected async reorder(ids: readonly string[]): Promise<void> {
    const saved = await this.categories.reorder(ids);
    if (!saved.ok) {
      void this.toast.show(saved.message);
    }
  }

  /** Back where the user came from; to the Categorías tab, on the kind shown here. */
  protected async back(): Promise<void> {
    const origin = this.origin;
    if (origin && !origin.startsWith(`/${APP_PATHS.categories}`)) {
      await this.router.navigateByUrl(origin);
      return;
    }
    await this.router.navigate(['/', APP_PATHS.categories], { queryParams: this.kindParams() });
  }

  private editPath(): string[] {
    return ['/', APP_PATHS.categories, CATEGORY_PATHS.edit];
  }

  private kindParams(kind: CategoryKind = this.kind()): Record<string, string> {
    return { [CATEGORY_QUERY_PARAMS.kind]: CATEGORY_KIND_PARAM[kind] };
  }
}
