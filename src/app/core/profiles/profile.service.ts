import { computed, inject, Injectable, resource } from '@angular/core';
import { ACTION_OK, actionFailed, ActionResult } from '../action-result';
import { AuthService } from '../auth/auth.service';
import { SpaceMembersService } from '../spaces/space-members.service';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { Profile } from './profile.models';
import { ProfilesApi } from './profiles.api';

/** The profile of the signed-in user (spec §7, Configuración). */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ProfilesApi);
  private readonly auth = inject(AuthService);
  private readonly members = inject(SpaceMembersService);

  private readonly store = resource({
    params: () => this.auth.user()?.id,
    loader: async ({ params: userId }) => {
      const result = await this.api.fetch(userId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  readonly profile = computed<Profile | null>(() =>
    this.store.hasValue() ? this.store.value() : null,
  );

  /** Saves the name other members see; filters and lists with names load it again. */
  async updateDisplayName(displayName: string): Promise<ActionResult> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const saved = await this.api.updateDisplayName(userId, displayName.trim());
    if (!saved.ok) {
      return saved;
    }
    this.store.set(saved.value);
    this.members.reload();
    return ACTION_OK;
  }
}
