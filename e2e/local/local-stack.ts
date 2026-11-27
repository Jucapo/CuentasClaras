import { expect, Page } from '@playwright/test';
import { environment } from '../../src/environments/environment.development';

// Helpers for the flows against the real local stack: Supabase's REST and Auth APIs and Mailpit.

const API_URL = environment.supabase.url;
const API_KEY = environment.supabase.publishableKey;
/** Mailpit's web API (`npm run db:start` prints it as MAILPIT_URL). */
const MAILPIT_URL = 'http://127.0.0.1:54324';
/** Seed account without a space (supabase/seed.sql). */
export const SEED_EXISTING_ACCOUNT = {
  email: 'ana@cuentasclaras.test',
  password: 'cuentas-claras-dev',
};

/** A unique email per run, so runs never collide in the database or Mailpit. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}${Math.floor(Math.random() * 1000)}@cuentasclaras.test`;
}

async function call(path: string, init: RequestInit & { token?: string } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('apikey', API_KEY);
  headers.set('Content-Type', 'application/json');
  if (init.token) {
    headers.set('Authorization', `Bearer ${init.token}`);
  }
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

/**
 * An owner with a space ready to use: signs up (the local stack confirms right away), creates the
 * space and postpones the setup wizard so signing in opens the app.
 */
export async function createOwnerWithSpace(email: string, password: string): Promise<string> {
  const signUp = await call('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  expect(signUp.ok, await signUp.clone().text()).toBe(true);
  const token = ((await signUp.json()) as { access_token: string }).access_token;

  const created = await call('/rest/v1/rpc/create_space', {
    method: 'POST',
    token,
    body: JSON.stringify({
      space_name: 'Hogar',
      main_currency: 'COP',
      month_start_day: 1,
      week_start: 'monday',
    }),
  });
  expect(created.ok, await created.clone().text()).toBe(true);
  const spaceId = (await created.json()) as string;

  const postponed = await call(`/rest/v1/space_settings?space_id=eq.${spaceId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ onboarding_postponed_at: new Date().toISOString() }),
  });
  expect(postponed.ok, await postponed.clone().text()).toBe(true);
  return spaceId;
}

/** Whether Auth still accepts an invitation email's token hash (it signs in if it does). */
export async function inviteTokenWorks(tokenHash: string): Promise<boolean> {
  const response = await call('/auth/v1/verify', {
    method: 'POST',
    body: JSON.stringify({ type: 'invite', token_hash: tokenHash }),
  });
  return response.ok;
}

/** POSTs to invite-member as a browser on another origin would. */
export async function callInviteMemberFrom(origin: string): Promise<number> {
  const response = await call('/functions/v1/invite-member', {
    method: 'POST',
    headers: { Origin: origin },
    body: JSON.stringify({}),
  });
  return response.status;
}

interface MailpitMessage {
  readonly ID: string;
}

/** Emails Mailpit received for an address, newest first. */
export async function emailsTo(email: string): Promise<readonly MailpitMessage[]> {
  const query = encodeURIComponent(`to:"${email}"`);
  const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
  const body = (await response.json()) as { messages?: MailpitMessage[] };
  return body.messages ?? [];
}

/** Waits until an address has `count` emails and returns the invitation link of the newest. */
export async function waitForInvitationLink(email: string, count: number): Promise<string> {
  await expect
    .poll(async () => (await emailsTo(email)).length, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(count);
  const [newest] = await emailsTo(email);
  const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${newest.ID}`)).json()) as {
    HTML: string;
    Subject: string;
  };
  expect(message.Subject).toBe('Te invitaron a Cuentas Claras');
  const href = /href="([^"]*\/invitacion\?[^"]*)"/.exec(message.HTML)?.[1];
  expect(href, 'the email links to /invitacion').toBeTruthy();
  return (href ?? '').replaceAll('&amp;', '&');
}

/** Signs in through the login page and waits for the app. */
export async function signInThroughUi(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
