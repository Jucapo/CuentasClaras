import { inject, Injectable } from '@angular/core';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { actionFailed, ActionResult, ACTION_OK, DataResult } from '../action-result';
import { INVITE_MEMBER_FUNCTION } from '../config/member.constants';
import { MemberRole } from '../spaces/space.models';
import { dataErrorMessage, LOAD_ERROR_MESSAGE } from '../supabase/data-error-messages';
import { SupabaseService } from '../supabase/supabase.service';
import { inviteErrorMessage } from './invitation-error-messages';
import {
  InvitationDelivery,
  InvitationPreview,
  InvitationRef,
  InvitationStatus,
  PendingInvitation,
  ReceivedInvitation,
} from './invitation.models';

/** Answer of the invite-member Edge Function. */
interface InviteResponse {
  readonly email: string;
  readonly delivery: 'email' | 'link';
  readonly link?: string;
}

const INVITATION_STATUSES: readonly InvitationStatus[] = [
  'pending',
  'expired',
  'accepted',
  'declined',
  'revoked',
];

/** Supabase calls for invitations: the table, its RPCs and the invite-member Edge Function. */
@Injectable({ providedIn: 'root' })
export class InvitationsApi {
  private readonly client = inject(SupabaseService).client;

  /** Open invitations of a space (owner only; RLS hides them from the rest), oldest first. */
  async fetchPending(spaceId: string): Promise<DataResult<PendingInvitation[]>> {
    // Explicit columns: the client has no access to token_hash, so `*` would fail.
    const { data, error, status } = await this.client
      .from('space_invitations')
      .select('id, email, role, expires_at')
      .eq('space_id', spaceId)
      .is('accepted_at', null)
      .is('declined_at', null)
      .is('revoked_at', null)
      .order('created_at');
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return {
      ok: true,
      value: data.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        expiresAt: row.expires_at,
      })),
    };
  }

  /** Invites an email to a space (Edge Function: emails a new account, links an existing one). */
  invite(spaceId: string, email: string, role: MemberRole): Promise<DataResult<InvitationDelivery>> {
    return this.callInviteMember({ action: 'invite', spaceId, email, role });
  }

  /** Resends an invitation with a new token; the previous link stops working. */
  resend(invitationId: string): Promise<DataResult<InvitationDelivery>> {
    return this.callInviteMember({ action: 'resend', invitationId });
  }

  /** Revokes an open invitation (owner only). */
  async revoke(invitationId: string): Promise<ActionResult> {
    const { error, status } = await this.client.rpc('revoke_invitation', {
      target_invitation_id: invitationId,
    });
    return error ? actionFailed(dataErrorMessage(error, status)) : ACTION_OK;
  }

  /** What the invitation page shows, also before signing in; null for an unknown token. */
  async preview(token: string): Promise<DataResult<InvitationPreview | null>> {
    const { data, error, status } = await this.client
      .rpc('invitation_preview', { invitation_token: token })
      .maybeSingle();
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    if (!data) {
      return { ok: true, value: null };
    }
    const statusValue = INVITATION_STATUSES.find((value) => value === data.status) ?? 'revoked';
    return {
      ok: true,
      value: {
        id: data.invitation_id,
        spaceName: data.space_name,
        spaceIcon: String(data.space_icon),
        spaceColor: String(data.space_color),
        inviterName: data.inviter_name,
        role: data.role,
        email: data.email,
        expiresAt: data.expires_at,
        status: statusValue,
      },
    };
  }

  /** Open invitations for the signed-in user's confirmed email, to spaces they are not in. */
  async fetchMine(): Promise<DataResult<ReceivedInvitation[]>> {
    const { data, error, status } = await this.client.rpc('my_invitations');
    if (error) {
      return actionFailed(dataErrorMessage(error, status, LOAD_ERROR_MESSAGE));
    }
    return {
      ok: true,
      value: data.map((row) => ({
        id: row.invitation_id,
        spaceId: row.space_id,
        spaceName: row.space_name,
        spaceIcon: String(row.space_icon),
        spaceColor: String(row.space_color),
        inviterName: row.inviter_name,
        role: row.role,
        expiresAt: row.expires_at,
      })),
    };
  }

  /** Accepts an invitation for the signed-in user; returns the space joined. */
  async accept(ref: InvitationRef): Promise<DataResult<string>> {
    const { data, error, status } = await this.client.rpc('accept_invitation', refArgs(ref));
    return error ? actionFailed(dataErrorMessage(error, status)) : { ok: true, value: data };
  }

  /** Declines an invitation addressed to the signed-in user. */
  async decline(ref: InvitationRef): Promise<ActionResult> {
    const { error, status } = await this.client.rpc('decline_invitation', refArgs(ref));
    return error ? actionFailed(dataErrorMessage(error, status)) : ACTION_OK;
  }

  private async callInviteMember(body: object): Promise<DataResult<InvitationDelivery>> {
    const { data, error } = await this.client.functions.invoke<InviteResponse>(
      INVITE_MEMBER_FUNCTION,
      { body },
    );
    if (error) {
      return actionFailed(inviteErrorMessage(await functionErrorCode(error)));
    }
    if (!data) {
      return actionFailed(inviteErrorMessage('unexpected'));
    }
    return {
      ok: true,
      value:
        data.delivery === 'link' && data.link
          ? { kind: 'link', email: data.email, link: data.link }
          : { kind: 'email', email: data.email },
    };
  }
}

function refArgs(ref: InvitationRef): { invitation_token?: string; target_invitation_id?: string } {
  return 'token' in ref ? { invitation_token: ref.token } : { target_invitation_id: ref.invitationId };
}

/** The function's `{ error: { code } }`, 'unexpected' for an answer without it, null offline. */
async function functionErrorCode(error: unknown): Promise<string | null> {
  if (error instanceof FunctionsFetchError) {
    return null;
  }
  if (!(error instanceof FunctionsHttpError)) {
    return 'unexpected';
  }
  try {
    const body = (await (error.context as Response).json()) as { error?: { code?: unknown } };
    return typeof body.error?.code === 'string' ? body.error.code : 'unexpected';
  } catch {
    return 'unexpected';
  }
}
