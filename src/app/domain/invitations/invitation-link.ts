/** Value of the `type` param that Auth puts in the invitation email link. */
export const INVITE_LINK_TYPE = 'invite';

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Query params of `/invitacion`, as they arrive (missing ones are null). */
export interface InvitationLinkParams {
  readonly token: string | null;
  readonly tokenHash: string | null;
  readonly type: string | null;
  readonly id: string | null;
}

/**
 * How `/invitacion` was opened (spec §3.3):
 * - `email`: the invitation email to a new account, with the invitation token and Auth's token hash;
 * - `link`: a copied link (an existing account), with the invitation token only;
 * - `app`: the in-app notice, with the invitation id (the confirmed email is the proof);
 * - `invalid`: anything else.
 */
export type InvitationLink =
  | { readonly kind: 'email'; readonly token: string; readonly tokenHash: string }
  | { readonly kind: 'link'; readonly token: string }
  | { readonly kind: 'app'; readonly invitationId: string }
  | { readonly kind: 'invalid' };

/** Reads the params of `/invitacion`; a token wins over an id. */
export function parseInvitationLink(params: InvitationLinkParams): InvitationLink {
  const token = params.token?.trim().toLowerCase() ?? '';
  if (TOKEN_PATTERN.test(token)) {
    const tokenHash = params.tokenHash?.trim() ?? '';
    return tokenHash !== '' && params.type === INVITE_LINK_TYPE
      ? { kind: 'email', token, tokenHash }
      : { kind: 'link', token };
  }
  if (params.token) {
    return { kind: 'invalid' };
  }
  const id = params.id?.trim() ?? '';
  return UUID_PATTERN.test(id) ? { kind: 'app', invitationId: id.toLowerCase() } : { kind: 'invalid' };
}
