// invite-member (F1f, spec §3.3): invites someone to a space, or resends an invitation.
// - The caller's JWT is verified here (verify_jwt is off in config.jsonc) and every data change
//   goes through RPCs with that JWT, so the database applies its own owner rule again.
// - The service role is used only for auth.admin.inviteUserByEmail: Auth sends the email over
//   its SMTP (Edge Functions cannot open SMTP connections).
// - An email that already has a confirmed account gets no email: the response carries the link.
import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import { corsHeaders, isAllowedOrigin } from '../_shared/cors.ts';

type MemberRole = 'owner' | 'editor' | 'viewer';

type InviteRequest =
  | { readonly action: 'invite'; readonly spaceId: string; readonly email: string; readonly role: MemberRole }
  | { readonly action: 'resend'; readonly invitationId: string };

/** A row of create_invitation and rotate_invitation. */
interface InvitationRow {
  readonly invitation_id: string;
  readonly token: string;
  readonly email: string;
  readonly expires_at: string;
  readonly invitee_has_account: boolean;
  readonly space_name: string;
  readonly inviter_name: string | null;
}

interface Env {
  readonly url: string;
  readonly publishableKey: string;
  readonly serviceRoleKey: string;
  readonly appUrl: string;
}

const MEMBER_ROLES: readonly MemberRole[] = ['owner', 'editor', 'viewer'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EMAIL_MAX_LENGTH = 254;
/** Route of the accept page in the app (APP_PATHS.invitation) and its token parameter. */
const INVITATION_PATH = '/invitacion';
const TOKEN_PARAM = 'token';
/** Business errors of the RPCs (P0001) that the app translates; anything else is unexpected. */
const RPC_ERROR_CODES = new Set(['already_member', 'invitation_pending', 'invitation_closed']);

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  const fail = (status: number, code: string) => reply(status, { error: { code } });

  // A browser always sends Origin; calls without it (curl, servers) still need a valid JWT.
  if (origin !== null && !isAllowedOrigin(origin)) {
    return fail(403, 'origin_not_allowed');
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return fail(405, 'method_not_allowed');
  }

  const env = readEnv();
  if (!env) {
    console.error('invite-member: missing SUPABASE_URL, API keys or APP_URL');
    return fail(500, 'misconfigured');
  }

  const jwt = bearerToken(request);
  if (!jwt) {
    return fail(401, 'not_authenticated');
  }
  const userClient = createClient(env.url, env.publishableKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData.user) {
    return fail(401, 'not_authenticated');
  }

  const body = parseRequest(await request.json().catch(() => null));
  if (!body) {
    return fail(400, 'invalid_request');
  }

  let invitation: InvitationRow;
  if (body.action === 'invite') {
    // Checked here too so a non-owner never reaches the admin API; create_invitation checks again.
    const { data: membership, error } = await userClient
      .from('space_members')
      .select('role')
      .eq('space_id', body.spaceId)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (error) {
      console.error('invite-member: membership lookup failed', error.code);
      return fail(500, 'unexpected');
    }
    if (membership?.role !== 'owner') {
      return fail(403, 'not_space_owner');
    }
    const result = await userClient
      .rpc('create_invitation', {
        target_space_id: body.spaceId,
        invitee_email: body.email,
        invitee_role: body.role,
      })
      .single<InvitationRow>();
    if (result.error) {
      return rpcFailure(result.error, fail);
    }
    invitation = result.data;
  } else {
    const result = await userClient
      .rpc('rotate_invitation', { target_invitation_id: body.invitationId })
      .single<InvitationRow>();
    if (result.error) {
      return rpcFailure(result.error, fail);
    }
    invitation = result.data;
  }

  const link = invitationLink(env.appUrl, invitation.token);
  const summary = {
    invitationId: invitation.invitation_id,
    email: invitation.email,
    expiresAt: invitation.expires_at,
  };
  if (invitation.invitee_has_account) {
    return reply(200, { ...summary, delivery: 'link', link });
  }

  const sent = await sendInvitationEmail(env, invitation, link);
  if (sent !== 'sent') {
    // A new invitation that could not be emailed is revoked, so the owner can simply try again.
    if (body.action === 'invite') {
      await userClient.rpc('revoke_invitation', { target_invitation_id: invitation.invitation_id });
    }
    return sent === 'rate_limited'
      ? fail(429, 'over_email_send_rate_limit')
      : fail(502, 'email_failed');
  }
  return reply(200, { ...summary, delivery: 'email' });
});

/** Auth creates the user if needed and sends the invite template; it resends to an unconfirmed one. */
async function sendInvitationEmail(
  env: Env,
  invitation: InvitationRow,
  link: string,
): Promise<'sent' | 'rate_limited' | 'failed'> {
  const admin: SupabaseClient = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.inviteUserByEmail(invitation.email, {
    redirectTo: link,
    data: { space_name: invitation.space_name, inviter_name: invitation.inviter_name },
  });
  if (!error) {
    return 'sent';
  }
  console.error('invite-member: inviteUserByEmail failed', error.status, error.code);
  return error.status === 429 ? 'rate_limited' : 'failed';
}

function rpcFailure(error: PostgrestError, fail: (status: number, code: string) => Response) {
  if (error.code === '42501') {
    return fail(403, 'not_space_owner');
  }
  if (error.code === '23514') {
    return fail(400, 'invalid_email');
  }
  if (error.code === 'P0001' && RPC_ERROR_CODES.has(error.message)) {
    return fail(409, error.message);
  }
  console.error('invite-member: rpc failed', error.code);
  return fail(500, 'unexpected');
}

function parseRequest(value: unknown): InviteRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const body = value as Record<string, unknown>;
  if (body['action'] === 'resend') {
    const invitationId = body['invitationId'];
    return typeof invitationId === 'string' && UUID_PATTERN.test(invitationId)
      ? { action: 'resend', invitationId }
      : null;
  }
  if (body['action'] !== 'invite') {
    return null;
  }
  const { spaceId, email, role } = body;
  if (
    typeof spaceId !== 'string' ||
    !UUID_PATTERN.test(spaceId) ||
    typeof email !== 'string' ||
    typeof role !== 'string' ||
    !MEMBER_ROLES.includes(role as MemberRole)
  ) {
    return null;
  }
  const normalized = email.trim().toLowerCase();
  if (normalized.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(normalized)) {
    return null;
  }
  return { action: 'invite', spaceId, email: normalized, role: role as MemberRole };
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') ?? '');
  return match?.[1] ?? null;
}

function invitationLink(appUrl: string, token: string): string {
  const url = new URL(INVITATION_PATH, appUrl);
  url.searchParams.set(TOKEN_PARAM, token);
  return url.href;
}

/** The injected keys: the legacy ones, or the default of the new JSON key sets once those replace them. */
function readEnv(): Env | null {
  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey =
    Deno.env.get('SUPABASE_ANON_KEY') ?? defaultKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'));
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? defaultKey(Deno.env.get('SUPABASE_SECRET_KEYS'));
  const appUrl = Deno.env.get('APP_URL');
  if (!url || !publishableKey || !serviceRoleKey || !appUrl) {
    return null;
  }
  return { url, publishableKey, serviceRoleKey, appUrl };
}

function defaultKey(keySet: string | undefined): string | undefined {
  if (!keySet) {
    return undefined;
  }
  try {
    const keys = JSON.parse(keySet) as Record<string, unknown>;
    return typeof keys['default'] === 'string' ? keys['default'] : undefined;
  } catch {
    return undefined;
  }
}
