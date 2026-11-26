import { inject, Injectable, signal } from '@angular/core';
import { ACTION_OK, actionFailed, ActionResult } from '../action-result';
import { UserSettings, UserSettingsPatch } from '../spaces/space.models';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { UserSettingsApi } from './user-settings.api';

/** The signed-in user's preferences (theme, number format, last space…). */
@Injectable({ providedIn: 'root' })
export class UserSettingsService {
  private readonly api = inject(UserSettingsApi);
  private readonly current = signal<UserSettings | null>(null);

  /** Loaded settings, or null before loading and after signing out. */
  readonly settings = this.current.asReadonly();

  /** Loads the settings of the given user. */
  async load(userId: string): Promise<ActionResult> {
    const result = await this.api.fetch(userId);
    if (!result.ok) {
      return result;
    }
    this.current.set(result.value);
    return ACTION_OK;
  }

  /** Saves some preferences of the loaded user. */
  async update(patch: UserSettingsPatch): Promise<ActionResult> {
    const settings = this.current();
    if (!settings) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const result = await this.api.update(settings.user_id, patch);
    if (!result.ok) {
      return result;
    }
    this.current.set(result.value);
    return ACTION_OK;
  }

  /** Forgets the loaded settings (sign-out or user change). */
  reset(): void {
    this.current.set(null);
  }
}
