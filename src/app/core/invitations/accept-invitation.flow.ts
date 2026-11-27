import { inject, Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ProfileService } from '../profiles/profile.service';
import { InvitationsService } from './invitations.service';

/** What a new account types to accept the invitation from the email (spec §3.3). */
export interface NewAccountAcceptance {
  /** The invitation token of the link. */
  readonly token: string;
  /** Auth's token hash of the email link, which signs the new account in. */
  readonly tokenHash: string;
  /** The invited email (from the preview). */
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
}

/** Outcome of accepting as a new account. `link_used` means Auth's part of the link no longer works. */
export type NewAccountResult =
  | { readonly ok: true; readonly spaceId: string }
  | { readonly ok: false; readonly reason: 'link_used' }
  | { readonly ok: false; readonly reason: 'failed'; readonly message: string };

/**
 * Accepting the invitation from the email, in the browser it opened (Safari on iPhone):
 * 1. Auth's token is verified only when submitting, so a link scanner cannot spend it, and only
 *    if this browser is not signed in as the invitee already (a retry after a failed step).
 * 2. The password and the display name are saved.
 * 3. The invitation is accepted.
 * Nothing here relies on the session afterwards: the installed app signs in with the password.
 */
@Injectable({ providedIn: 'root' })
export class AcceptInvitationFlow {
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly invitations = inject(InvitationsService);

  async acceptAsNewAccount(input: NewAccountAcceptance): Promise<NewAccountResult> {
    const signedInAs = this.auth.user()?.email?.toLowerCase() ?? null;
    if (signedInAs !== input.email.toLowerCase()) {
      const verified = await this.auth.verifyInvite(input.tokenHash);
      if (!verified.ok) {
        return { ok: false, reason: 'link_used' };
      }
    }
    const password = await this.auth.updatePassword(input.password);
    if (!password.ok) {
      return { ok: false, reason: 'failed', message: password.message };
    }
    const named = await this.profile.updateDisplayName(input.displayName);
    if (!named.ok) {
      return { ok: false, reason: 'failed', message: named.message };
    }
    const accepted = await this.invitations.accept({ token: input.token });
    if (!accepted.ok) {
      return { ok: false, reason: 'failed', message: accepted.message };
    }
    return { ok: true, spaceId: accepted.value };
  }
}
