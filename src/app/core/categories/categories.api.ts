import { inject, Injectable } from '@angular/core';
import { actionFailed, ActionResult, ACTION_OK, DataResult } from '../action-result';
import { deleteResult, DeleteResult } from '../catalogs/catalog-result';
import {
  dataErrorMessage,
  LOAD_ERROR_MESSAGE,
  NOT_ALLOWED_MESSAGE,
} from '../supabase/data-error-messages';
import { TablesInsert } from '../supabase/database.types';
import { SupabaseService } from '../supabase/supabase.service';
import { Category, CategoryPatch, NewCategory } from './category.models';

/** Shown when a category (or one of its subcategories) has movements (from F1d). */
export const CATEGORY_IN_USE_MESSAGE =
  'Esta categoría o alguna de sus subcategorías tiene movimientos, así que no se puede eliminar. Archívala para ocultarla sin perder el historial.';

/** Supabase queries for categories, their order and their default tags. */
@Injectable({ providedIn: 'root' })
export class CategoriesApi {
  private readonly client = inject(SupabaseService).client;

  /** Categories of a space, with the ids of their default tags. */
  async fetch(spaceId: string): Promise<DataResult<Category[]>> {
    const [categories, links] = await Promise.all([
      this.client.from('categories').select('*').eq('space_id', spaceId).order('sort_order'),
      this.client
        .from('category_default_tags')
        .select('category_id, tag_id')
        .eq('space_id', spaceId),
    ]);
    const failed = categories.error ? categories : links.error ? links : null;
    if (failed?.error) {
      return actionFailed(dataErrorMessage(failed.error, failed.status, LOAD_ERROR_MESSAGE));
    }
    const tagsByCategory = new Map<string, string[]>();
    for (const link of links.data ?? []) {
      tagsByCategory.set(link.category_id, [
        ...(tagsByCategory.get(link.category_id) ?? []),
        link.tag_id,
      ]);
    }
    return {
      ok: true,
      value: (categories.data ?? []).map((category) => ({
        ...category,
        default_tag_ids: tagsByCategory.get(category.id) ?? [],
      })),
    };
  }

  /** Creates a category; returns its id. */
  async create(category: NewCategory): Promise<DataResult<string>> {
    const { data, error, status } = await this.client
      .from('categories')
      // A trigger appends the category to its siblings when sort_order is missing.
      .insert(category as TablesInsert<'categories'>)
      .select('id')
      .single();
    return error ? actionFailed(dataErrorMessage(error, status)) : { ok: true, value: data.id };
  }

  /** Changes a category. */
  async update(id: string, patch: CategoryPatch): Promise<ActionResult> {
    const { data, error, status } = await this.client
      .from('categories')
      .update(patch)
      .eq('id', id)
      .select('id');
    if (error) {
      return actionFailed(dataErrorMessage(error, status));
    }
    return data.length > 0 ? ACTION_OK : actionFailed(NOT_ALLOWED_MESSAGE);
  }

  /** Deletes a category and its subcategories; fails with `inUse` when any has movements. */
  async remove(id: string): Promise<DeleteResult> {
    const { data, error, status } = await this.client
      .from('categories')
      .delete()
      .eq('id', id)
      .select('id');
    return deleteResult(error, status, data?.length ?? 0, CATEGORY_IN_USE_MESSAGE);
  }

  /** Saves the order of sibling categories (RPC `reorder_categories`). */
  async reorder(ids: readonly string[]): Promise<ActionResult> {
    const { error, status } = await this.client.rpc('reorder_categories', {
      category_ids: [...ids],
    });
    return error ? actionFailed(dataErrorMessage(error, status)) : ACTION_OK;
  }

  /** Adds and removes default tags so the category ends with exactly `tagIds`. */
  async setDefaultTags(
    spaceId: string,
    categoryId: string,
    current: readonly string[],
    tagIds: readonly string[],
  ): Promise<ActionResult> {
    const removed = current.filter((id) => !tagIds.includes(id));
    const added = tagIds.filter((id) => !current.includes(id));
    if (removed.length > 0) {
      const { error, status } = await this.client
        .from('category_default_tags')
        .delete()
        .eq('category_id', categoryId)
        .in('tag_id', removed);
      if (error) {
        return actionFailed(dataErrorMessage(error, status));
      }
    }
    if (added.length > 0) {
      const { error, status } = await this.client
        .from('category_default_tags')
        .insert(
          added.map((tagId) => ({ space_id: spaceId, category_id: categoryId, tag_id: tagId })),
        );
      if (error) {
        return actionFailed(dataErrorMessage(error, status));
      }
    }
    return ACTION_OK;
  }
}
