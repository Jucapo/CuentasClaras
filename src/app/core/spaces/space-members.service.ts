import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { ActionResult, actionFailed } from '../action-result';
import { AuthService } from '../auth/auth.service';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { MemberRole, SpaceMember } from './space.models';
import { SpaceService } from './space.service';
import { SpacesApi } from './spaces.api';

/** Members of the active space, e.g. for the person filter and Miembros (spec §7). */
@Injectable({ providedIn: 'root' })
export class SpaceMembersService {
  private readonly api = inject(SpacesApi);
  private readonly auth = inject(AuthService);
  private readonly spaces = inject(SpaceService);
  private readonly changes = signal(0);

  private readonly store = resource({
    params: () => {
      const spaceId = this.spaces.activeSpace()?.id;
      return spaceId ? { spaceId, revision: this.changes() } : undefined;
    },
    loader: async ({ params }) => {
      const result = await this.api.fetchMembers(params.spaceId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  readonly members = computed<readonly SpaceMember[]>(() =>
    this.store.hasValue() ? this.store.value() : [],
  );
  readonly isLoading = this.store.isLoading;
  readonly loadError = computed(() => (this.store.error() ? this.store.error()?.message : null));

  /** Loads the members again, e.g. after someone changed their name. */
  reload(): void {
    this.changes.update((value) => value + 1);
  }

  /** Changes another member's role in the active space (owner only). */
  async changeRole(userId: string, role: MemberRole): Promise<ActionResult> {
    const spaceId = this.spaces.activeSpace()?.id;
    if (!spaceId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const result = await this.api.updateMemberRole(spaceId, userId, role);
    if (result.ok) {
      this.reload();
    }
    return result;
  }

  /** Removes another member from the active space (owner only). Their data stays (spec §3.2). */
  async remove(userId: string): Promise<ActionResult> {
    const spaceId = this.spaces.activeSpace()?.id;
    if (!spaceId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const result = await this.api.removeMember(spaceId, userId);
    if (result.ok) {
      this.reload();
    }
    return result;
  }

  /**
   * Leaves the active space. The user's spaces load again, so another space becomes active, or
   * none: the caller decides where to go with `SpaceService.hasSpace()`.
   */
  async leave(): Promise<ActionResult> {
    const spaceId = this.spaces.activeSpace()?.id;
    const userId = this.auth.user()?.id;
    if (!spaceId || !userId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const result = await this.api.removeMember(spaceId, userId);
    if (!result.ok) {
      return result;
    }
    return this.spaces.reload();
  }
}
