import { inject, Injectable } from '@angular/core';
import { actionFailed, ActionResult, ACTION_OK, DataResult } from '../action-result';
import { deleteResult, DeleteResult } from '../catalogs/catalog-result';
import {
  dataErrorMessage,
  LOAD_ERROR_MESSAGE,
  NOT_ALLOWED_MESSAGE,
} from '../supabase/data-error-messages';
import { SupabaseService } from '../supabase/supabase.service';
import { NewTag, Tag, TagPatch } from './category.models';

/** Shown when a tag cannot be deleted because movements use it (from F1d). */
export const TAG_IN_USE_MESSAGE =
  'Esta etiqueta está en uso, así que no se puede eliminar. Archívala para dejar de ofrecerla.';

/** Supabase queries for tags. */
@Injectable({ providedIn: 'root' })
export class TagsApi {
  private readonly client = inject(SupabaseService).client;

  /** Tags of a space by name. */
  async fetch(spaceId: string): Promise<DataResult<Tag[]>> {
    const { data, error, status } = await this.client
      .from('tags')
      .select('*')
      .eq('space_id', spaceId)
      .order('name');
    return error
      ? actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE))
      : { ok: true, value: data };
  }

  /** Creates a tag; returns its id. */
  async create(tag: NewTag): Promise<DataResult<string>> {
    const { data, error, status } = await this.client
      .from('tags')
      .insert(tag)
      .select('id')
      .single();
    return error ? actionFailed(dataErrorMessage(error, status)) : { ok: true, value: data.id };
  }

  /** Changes a tag. */
  async update(id: string, patch: TagPatch): Promise<ActionResult> {
    const { data, error, status } = await this.client
      .from('tags')
      .update(patch)
      .eq('id', id)
      .select('id');
    if (error) {
      return actionFailed(dataErrorMessage(error, status));
    }
    return data.length > 0 ? ACTION_OK : actionFailed(NOT_ALLOWED_MESSAGE);
  }

  /** Deletes a tag (its default-tag links go with it). */
  async remove(id: string): Promise<DeleteResult> {
    const { data, error, status } = await this.client
      .from('tags')
      .delete()
      .eq('id', id)
      .select('id');
    return deleteResult(error, status, data?.length ?? 0, TAG_IN_USE_MESSAGE);
  }
}
