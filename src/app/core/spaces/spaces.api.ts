import { inject, Injectable } from '@angular/core';
import { actionFailed, ActionResult, ACTION_OK, DataResult } from '../action-result';
import {
  dataErrorMessage,
  LOAD_ERROR_MESSAGE,
  NOT_ALLOWED_MESSAGE,
} from '../supabase/data-error-messages';
import { SupabaseService } from '../supabase/supabase.service';
import {
  NewSpace,
  SpaceMembership,
  SpacePatch,
  SpaceSettings,
  SpaceSettingsPatch,
} from './space.models';

/** Supabase queries for spaces, memberships and space settings. */
@Injectable({ providedIn: 'root' })
export class SpacesApi {
  private readonly client = inject(SupabaseService).client;

  /** Spaces the user belongs to, oldest membership first, with role and settings. */
  async fetchMemberships(userId: string): Promise<DataResult<SpaceMembership[]>> {
    const { data, error, status } = await this.client
      .from('space_members')
      .select('role, joined_at, default_account_id, spaces(id, name, icon, color, space_settings(*))')
      .eq('user_id', userId)
      .order('joined_at');
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    const memberships: SpaceMembership[] = [];
    for (const row of data) {
      const space = row.spaces;
      const settings = space?.space_settings;
      if (space && settings) {
        memberships.push({
          space: { id: space.id, name: space.name, icon: space.icon, color: space.color },
          role: row.role,
          defaultAccountId: row.default_account_id,
          settings,
        });
      }
    }
    return { ok: true, value: memberships };
  }

  /** Creates a space with the user as owner (RPC `create_space`); returns its id. */
  async createSpace(input: NewSpace): Promise<DataResult<string>> {
    const { data, error, status } = await this.client.rpc('create_space', {
      space_name: input.name,
      main_currency: input.mainCurrency,
      month_start_day: input.monthStartDay,
      week_start: input.weekStart,
    });
    if (error) {
      return actionFailed(dataErrorMessage(error, status));
    }
    return { ok: true, value: data };
  }

  /** Changes the name, icon or color of a space (owner only). */
  async updateSpace(spaceId: string, patch: SpacePatch): Promise<ActionResult> {
    const { data, error, status } = await this.client
      .from('spaces')
      .update(patch)
      .eq('id', spaceId)
      .select('id');
    if (error) {
      return actionFailed(dataErrorMessage(error, status));
    }
    // RLS filters forbidden rows out instead of failing, so an empty result means "not allowed".
    return data.length > 0 ? ACTION_OK : actionFailed(NOT_ALLOWED_MESSAGE);
  }

  /** Updates the space preferences (owner only); returns the saved row. */
  async updateSettings(
    spaceId: string,
    patch: SpaceSettingsPatch,
  ): Promise<DataResult<SpaceSettings>> {
    const { data, error, status } = await this.client
      .from('space_settings')
      .update(patch)
      .eq('space_id', spaceId)
      .select();
    if (error) {
      return actionFailed(dataErrorMessage(error, status));
    }
    const [row] = data;
    return row ? { ok: true, value: row } : actionFailed(NOT_ALLOWED_MESSAGE);
  }

  /** Sets (or clears, with null) the caller's default account in a space. */
  async setDefaultAccount(spaceId: string, accountId: string | null): Promise<ActionResult> {
    const { error, status } = await this.client.rpc('set_default_account', {
      target_space_id: spaceId,
      // The generated type omits null, but the RPC clears the default with it.
      target_account_id: accountId as string,
    });
    return error ? actionFailed(dataErrorMessage(error, status)) : ACTION_OK;
  }
}
