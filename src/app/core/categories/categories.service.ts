import { computed, inject, Injectable, resource } from '@angular/core';
import { buildCategoryTree, CategoryNode } from '../../domain/categories/category-tree';
import { TemplateCategory } from '../../domain/categories/category-template';
import { actionFailed, ActionResult, ACTION_OK, DataResult } from '../action-result';
import { DeleteResult } from '../catalogs/catalog-result';
import { SpaceService } from '../spaces/space.service';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { CategoriesApi } from './categories.api';
import { Category, CategoryKind, CategoryPatch, NewCategory } from './category.models';

/** Categories of the active space; reloads when the space changes or after every change. */
@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly api = inject(CategoriesApi);
  private readonly spaces = inject(SpaceService);

  private readonly store = resource({
    params: () => this.spaces.activeSpace()?.id,
    loader: async ({ params: spaceId }) => {
      const result = await this.api.fetch(spaceId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  /** Every category, archived ones included, in their saved order. */
  readonly categories = computed<readonly Category[]>(() =>
    this.store.hasValue() ? this.store.value() : [],
  );
  readonly loading = computed(() => this.store.isLoading());
  readonly loaded = computed(() => this.store.hasValue());
  readonly loadError = computed(() => this.store.error()?.message ?? null);

  /** One category by id, once loaded. */
  find(id: string): Category | null {
    return this.categories().find((category) => category.id === id) ?? null;
  }

  /** Loads the categories again (e.g. after a tag they use was deleted). */
  reload(): void {
    this.store.reload();
  }

  /** Active categories of a kind as a two-level tree. */
  tree(kind: CategoryKind): CategoryNode<Category>[] {
    return buildCategoryTree(
      this.categories().filter((category) => category.kind === kind && !category.archived_at),
    );
  }

  /** Creates a category with its default tags; returns its id. */
  async create(
    category: Omit<NewCategory, 'space_id'>,
    tagIds: readonly string[],
  ): Promise<DataResult<string>> {
    const spaceId = this.spaces.activeSpace()?.id;
    if (!spaceId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const created = await this.api.create({ ...category, space_id: spaceId });
    if (!created.ok) {
      return created;
    }
    const tagged = await this.api.setDefaultTags(spaceId, created.value, [], tagIds);
    this.store.reload();
    return tagged.ok ? created : tagged;
  }

  /** Saves a category and its default tags. */
  async update(id: string, patch: CategoryPatch, tagIds: readonly string[]): Promise<ActionResult> {
    const spaceId = this.spaces.activeSpace()?.id;
    const current = this.find(id);
    if (!spaceId || !current) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const saved = await this.api.update(id, patch);
    if (!saved.ok) {
      return saved;
    }
    const tagged = await this.api.setDefaultTags(spaceId, id, current.default_tag_ids, tagIds);
    this.store.reload();
    return tagged;
  }

  /** Creates categories with their subcategories at once, e.g. from the suggested template. */
  async createTree(kind: CategoryKind, tree: readonly TemplateCategory[]): Promise<ActionResult> {
    const spaceId = this.spaces.activeSpace()?.id;
    if (!spaceId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const created = await this.api.createTree(spaceId, kind, tree);
    if (created.ok) {
      this.store.reload();
    }
    return created;
  }

  /** Ids of the categories where a tag applies by default. */
  categoriesWithTag(tagId: string): string[] {
    return this.categories()
      .filter((category) => category.default_tag_ids.includes(tagId))
      .map((category) => category.id);
  }

  /** Makes a tag apply by default to exactly these categories (spec §4.3). */
  async setTagCategories(tagId: string, categoryIds: readonly string[]): Promise<ActionResult> {
    const spaceId = this.spaces.activeSpace()?.id;
    if (!spaceId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const saved = await this.api.setTagCategories(
      spaceId,
      tagId,
      this.categoriesWithTag(tagId),
      categoryIds,
    );
    this.store.reload();
    return saved;
  }

  /** Archives (hides) or restores a category. */
  async setArchived(id: string, archived: boolean): Promise<ActionResult> {
    const saved = await this.api.update(id, {
      archived_at: archived ? new Date().toISOString() : null,
    });
    if (saved.ok) {
      this.store.reload();
    }
    return saved;
  }

  /** Deletes a category and its subcategories; fails with `inUse` when any has movements. */
  async remove(id: string): Promise<DeleteResult> {
    const deleted = await this.api.remove(id);
    if (deleted.ok) {
      this.store.reload();
    }
    return deleted;
  }

  /** Saves a new order of sibling categories, showing it right away. */
  async reorder(ids: readonly string[]): Promise<ActionResult> {
    if (ids.length < 2) {
      return ACTION_OK;
    }
    const previous = this.store.hasValue() ? this.store.value() : null;
    if (previous) {
      const position = new Map(ids.map((id, index) => [id, index]));
      this.store.set(
        previous.map((category) =>
          position.has(category.id)
            ? { ...category, sort_order: position.get(category.id) ?? category.sort_order }
            : category,
        ),
      );
    }
    const saved = await this.api.reorder(ids);
    if (!saved.ok && previous) {
      this.store.set(previous);
    }
    return saved;
  }
}
