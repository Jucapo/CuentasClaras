import { inject, Injectable } from '@angular/core';
import { actionFailed, DataResult } from '../action-result';
import {
  dataErrorMessage,
  LOAD_ERROR_MESSAGE,
  NOT_ALLOWED_MESSAGE,
} from '../supabase/data-error-messages';
import { SupabaseService } from '../supabase/supabase.service';
import { Profile } from './profile.models';

/** Supabase queries for the user's profile. */
@Injectable({ providedIn: 'root' })
export class ProfilesApi {
  private readonly client = inject(SupabaseService).client;

  /** The profile of a user; null if it is not there. */
  async fetch(userId: string): Promise<DataResult<Profile | null>> {
    const { data, error, status } = await this.client
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return { ok: true, value: data };
  }

  /** Changes the display name of the user (only their own); returns the saved profile. */
  async updateDisplayName(userId: string, displayName: string): Promise<DataResult<Profile>> {
    const { data, error, status } = await this.client
      .from('profiles')
      .update({ display_name: displayName })
      .eq('user_id', userId)
      .select('user_id, display_name, avatar_url');
    if (error) {
      return actionFailed(dataErrorMessage(error, status));
    }
    const [row] = data;
    return row ? { ok: true, value: row } : actionFailed(NOT_ALLOWED_MESSAGE);
  }
}
