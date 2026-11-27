import { MemberRole } from '../spaces/space.models';

/** An open invitation of the active space, as its owner sees it in Miembros (spec §7). */
export interface PendingInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: MemberRole;
  /** ISO timestamp; an open invitation past it can still be resent. */
  readonly expiresAt: string;
}

/** An invitation addressed to the signed-in user, to a space they are not in yet. */
export interface ReceivedInvitation {
  readonly id: string;
  readonly spaceId: string;
  readonly spaceName: string;
  readonly spaceIcon: string;
  readonly spaceColor: string;
  readonly inviterName: string | null;
  readonly role: MemberRole;
  readonly expiresAt: string;
}

/** State of an invitation, as `/invitacion` shows it. */
export type InvitationStatus = 'pending' | 'expired' | 'accepted' | 'declined' | 'revoked';

/** What `/invitacion` shows before signing in (RPC `invitation_preview`). */
export interface InvitationPreview {
  readonly id: string;
  readonly spaceName: string;
  readonly spaceIcon: string;
  readonly spaceColor: string;
  readonly inviterName: string | null;
  readonly role: MemberRole;
  readonly email: string;
  readonly expiresAt: string;
  readonly status: InvitationStatus;
}

/**
 * How an invitation reaches the person: by email (a new account) or by a link the owner copies
 * (an existing account, which also sees it when entering the app).
 */
export type InvitationDelivery =
  | { readonly kind: 'email'; readonly email: string }
  | { readonly kind: 'link'; readonly email: string; readonly link: string };

/** Which invitation to answer: by its token (a link) or its id (the in-app notice). */
export type InvitationRef = { readonly token: string } | { readonly invitationId: string };
