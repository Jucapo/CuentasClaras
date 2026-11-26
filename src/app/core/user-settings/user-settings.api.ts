import { inject, Injectable } from '@angular/core';
import { actionFailed, DataResult } from '../action-result';
import { UserSettings, UserSettingsPatch } from '../spaces/space.models';
import {
  dataErrorMessage,
  LOAD_ERROR_MESSAGE,
  NOT_ALLOWED_MESSAGE,
} from '../supabase/data-error-messages';
import { SupabaseService } from '../supabase/supabase.service';

/** Supabase queries for the user's own settings row. */
@Injectable({ providedIn: 'root' })
export class UserSettingsApi {
  private readonly client = inject(SupabaseService).client;

  /** The user's settings (created on sign-up). */
  async fetch(userId: string): Promise<DataResult<UserSettings>> {
    const { data, error, status } = await this.client
      .from('user_settings')
      .select()
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return data ? { ok: true, value: data } : actionFailed(LOAD_ERROR_MESSAGE);
  }

  /** Saves some preferences; returns the saved row. */
  async update(userId: string, patch: UserSettingsPatch): Promise<DataResult<UserSettings>> {
    const { data, error, status } = await this.client
      .from('user_settings')
      .update(patch)
      .eq('user_id', userId)
      .select();
    if (error) {
      return actionFailed(dataErrorMessage(error, status));
    }
    const [row] = data;
    return row ? { ok: true, value: row } : actionFailed(NOT_ALLOWED_MESSAGE);
  }
}
