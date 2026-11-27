import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { actionFailed, ActionResult, DataResult } from '../action-result';
import { AuthService } from '../auth/auth.service';
import { MemberRole } from '../spaces/space.models';
import { SpaceService } from '../spaces/space.service';
import { GENERIC_DATA_ERROR_MESSAGE } from '../supabase/data-error-messages';
import {
  InvitationDelivery,
  InvitationPreview,
  InvitationRef,
  PendingInvitation,
  ReceivedInvitation,
} from './invitation.models';
import { InvitationsApi } from './invitations.api';

/**
 * Invitations (spec §3.3): the open ones of the active space for its owner, the ones addressed to
 * the signed-in user, and inviting, resending, revoking, accepting and declining.
 */
@Injectable({ providedIn: 'root' })
export class InvitationsService {
  private readonly api = inject(InvitationsApi);
  private readonly auth = inject(AuthService);
  private readonly spaces = inject(SpaceService);
  private readonly pendingChanges = signal(0);
  private readonly mineChanges = signal(0);

  private readonly pendingStore = resource({
    params: () => {
      const spaceId = this.spaces.activeSpace()?.id;
      return spaceId && this.spaces.canConfigure()
        ? { spaceId, revision: this.pendingChanges() }
        : undefined;
    },
    loader: async ({ params }) => {
      const result = await this.api.fetchPending(params.spaceId);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  private readonly mineStore = resource({
    params: () => {
      const userId = this.auth.user()?.id;
      return userId ? { userId, revision: this.mineChanges() } : undefined;
    },
    loader: async () => {
      const result = await this.api.fetchMine();
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.value;
    },
  });

  /** Open invitations of the active space; empty unless the user is its owner. */
  readonly pending = computed<readonly PendingInvitation[]>(() =>
    this.pendingStore.hasValue() ? this.pendingStore.value() : [],
  );
  readonly pendingLoadError = computed(() => this.pendingStore.error()?.message ?? null);

  /** Invitations addressed to the signed-in user, to spaces they are not in yet. */
  readonly mine = computed<readonly ReceivedInvitation[]>(() =>
    this.mineStore.hasValue() ? this.mineStore.value() : [],
  );
  /** Whether `mine` has loaded at least once for this user. */
  readonly mineLoaded = computed(() => this.mineStore.hasValue());

  /** Invites an email to the active space with a role. */
  async invite(email: string, role: MemberRole): Promise<DataResult<InvitationDelivery>> {
    const spaceId = this.spaces.activeSpace()?.id;
    if (!spaceId) {
      return actionFailed(GENERIC_DATA_ERROR_MESSAGE);
    }
    const result = await this.api.invite(spaceId, email.trim(), role);
    if (result.ok) {
      this.reloadPending();
    }
    return result;
  }

  /** Resends an invitation: a new email, or a new link for an existing account. */
  async resend(invitationId: string): Promise<DataResult<InvitationDelivery>> {
    const result = await this.api.resend(invitationId);
    if (result.ok) {
      this.reloadPending();
    }
    return result;
  }

  /** Revokes an open invitation of the active space. */
  async revoke(invitationId: string): Promise<ActionResult> {
    const result = await this.api.revoke(invitationId);
    if (result.ok) {
      this.reloadPending();
    }
    return result;
  }

  /** What the invitation page shows for a token; null when the token is unknown. */
  preview(token: string): Promise<DataResult<InvitationPreview | null>> {
    return this.api.preview(token);
  }

  /** Accepts an invitation; the joined space loads and becomes the active one. */
  async accept(ref: InvitationRef): Promise<DataResult<string>> {
    const accepted = await this.api.accept(ref);
    if (!accepted.ok) {
      return accepted;
    }
    this.reloadMine();
    const reloaded = await this.spaces.reload();
    if (reloaded.ok) {
      // The membership exists already; failing to remember the space only affects the next visit.
      await this.spaces.select(accepted.value);
    }
    return accepted;
  }

  /** Declines an invitation addressed to the signed-in user. */
  async decline(ref: InvitationRef): Promise<ActionResult> {
    const result = await this.api.decline(ref);
    if (result.ok) {
      this.reloadMine();
    }
    return result;
  }

  /** Loads the invitations addressed to the user again. */
  reloadMine(): void {
    this.mineChanges.update((value) => value + 1);
  }

  private reloadPending(): void {
    this.pendingChanges.update((value) => value + 1);
  }
}
