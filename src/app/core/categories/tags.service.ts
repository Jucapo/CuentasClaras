import { computed, inject, Injectable, resource } from '@angular/core';
import { actionFailed, ActionResult, DataResult } from '../action-result';
import { DeleteResult } from '../catalogs/catalog-result';
import { SpaceService } from '../spaces/space.service';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { NewTag, Tag, TagPatch } from './category.models';
import { CategoriesService } from './categories.service';
import { TagsApi } from './tags.api';

/** Tags of the active space; reloads when the space changes or after every change. */
@Injectable({ providedIn: 'root' })
export class TagsService {
  private readonly api = inject(TagsApi);
  private readonly spaces = inject(SpaceService);
  private readonly categories = inject(CategoriesService);

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

  /** Every tag, archived ones included, by name. */
  readonly tags = computed<readonly Tag[]>(() => (this.store.hasValue() ? this.store.value() : []));
  /** Tags that can still be picked. */
  readonly activeTags = computed(() => this.tags().filter((tag) => !tag.archived_at));
  readonly loading = computed(() => this.store.isLoading());
  readonly loaded = computed(() => this.store.hasValue());
  readonly loadError = computed(() => this.store.error()?.message ?? null);

  /** One tag by id, once loaded. */
  find(id: string): Tag | null {
    return this.tags().find((tag) => tag.id === id) ?? null;
  }

  /** Creates a tag in the active space; returns its id. */
  async create(tag: Omit<NewTag, 'space_id'>): Promise<DataResult<string>> {
    const spaceId = this.spaces.activeSpace()?.id;
    if (!spaceId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const created = await this.api.create({ ...tag, space_id: spaceId });
    if (created.ok) {
      this.store.reload();
    }
    return created;
  }

  /** Saves a tag. */
  async update(id: string, patch: TagPatch): Promise<ActionResult> {
    const saved = await this.api.update(id, patch);
    if (saved.ok) {
      this.store.reload();
    }
    return saved;
  }

  /** Archives (stops offering) or restores a tag. */
  setArchived(id: string, archived: boolean): Promise<ActionResult> {
    return this.update(id, { archived_at: archived ? new Date().toISOString() : null });
  }

  /** Deletes a tag; the categories reload because their default tags changed. */
  async remove(id: string): Promise<DeleteResult> {
    const deleted = await this.api.remove(id);
    if (deleted.ok) {
      this.store.reload();
      this.categories.reload();
    }
    return deleted;
  }
}
