import { expect, test } from '@playwright/test';
import { capture } from './support/screenshots';
import {
  blockSupabase,
  E2E_USER,
  InvitationRowFixture,
  mockDataApi,
  mockInviteeAuth,
  seedSession,
} from './support/supabase';

// The accept page of an invitation (spec §3.3). It also runs on the iPhone WebKit project: the
// email opens in Safari, not in the installed app.

const TOKEN = 'ab'.repeat(32);
const INVITEE = 'laura@example.com';

function preview(overrides: Record<string, unknown> = {}): InvitationRowFixture {
  return {
    invitation_id: '00000000-0000-4000-8000-0000000001a1',
    space_name: 'Hogar',
    space_icon: 'home',
    space_color: 'green',
    inviter_name: 'Juan',
    role: 'editor',
    email: INVITEE,
    expires_at: '2026-12-03T12:00:00Z',
    status: 'pending',
    ...overrides,
  };
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-26T12:00:00'));
  await blockSupabase(page);
});

test('a new account opens the email link, picks a name and a password, and accepts', async ({
  page,
}, testInfo) => {
  const api = await mockDataApi(page, { sharing: { preview: preview() } });
  const auth = await mockInviteeAuth(page, INVITEE);
  await page.goto(`/invitacion?token=${TOKEN}&token_hash=e12afa6d&type=invite`);

  await expect(page.getByText('Juan te invitó a «Hogar»')).toBeVisible();
  await expect(page.getByText('Como Editor')).toBeVisible();
  await expect(page.getByText(INVITEE)).toBeVisible();
  // Auth's token is spent only when submitting, so a link scanner cannot use it up.
  expect(auth.verified()).toBe(false);
  await capture(page, 'invitacion-cuenta-nueva');

  await page.getByRole('textbox', { name: 'Tu nombre' }).fill('Laura');
  await page.getByLabel('Contraseña', { exact: true }).fill('una-clave-segura');
  await page.getByLabel('Confirmar contraseña').fill('una-clave-segura');
  await page.getByRole('button', { name: 'Aceptar invitación' }).click();

  await expect(page.getByRole('heading', { name: '¡Listo!' })).toBeVisible();
  await expect(page.getByText('Ya eres parte de Hogar.')).toBeVisible();
  // The installed app does not share the browser's session: it signs in with the password.
  await expect(page.getByText(/entra con tu correo/)).toContainText(INVITEE);
  if (testInfo.project.name.startsWith('iphone')) {
    await expect(page.getByText('Agregar a inicio')).toBeVisible();
  }
  expect(auth.verified()).toBe(true);
  expect(api.rpcCalls('accept_invitation')).toEqual([{ invitation_token: TOKEN }]);
  expect(api.writes()).toContainEqual(
    expect.objectContaining({ table: 'profiles', body: { display_name: 'Laura' } }),
  );
  await capture(page, 'invitacion-lista');
});

test('an existing account signs in first, then accepts', async ({ page }) => {
  await mockDataApi(page, { sharing: { preview: preview({ email: E2E_USER.email }) } });
  await page.goto(`/invitacion?token=${TOKEN}`);

  await expect(page.getByText(`Inicia sesión con ${E2E_USER.email}`)).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/iniciar-sesion\?redirect=%2Finvitacion%3Ftoken%3D/);
  await capture(page, 'invitacion-iniciar-sesion');
});

test('signed in as the invitee, accepts or declines', async ({ page }) => {
  await seedSession(page);
  const api = await mockDataApi(page, { sharing: { preview: preview({ email: E2E_USER.email }) } });
  await page.goto(`/invitacion?token=${TOKEN}`);

  await expect(page.getByRole('button', { name: 'Rechazar' })).toBeVisible();
  await capture(page, 'invitacion-aceptar');
  await page.getByRole('button', { name: 'Aceptar invitación' }).click();

  await expect(page.getByRole('heading', { name: '¡Listo!' })).toBeVisible();
  expect(api.rpcCalls('accept_invitation')).toEqual([{ invitation_token: TOKEN }]);
});

test('an expired invitation says so', async ({ page }) => {
  await mockDataApi(page, { sharing: { preview: preview({ status: 'expired' }) } });
  await page.goto(`/invitacion?token=${TOKEN}&token_hash=e12afa6d&type=invite`);

  await expect(page.getByText('Esta invitación venció')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aceptar invitación' })).toHaveCount(0);
  await capture(page, 'invitacion-vencida');
});

test('an unknown or broken link says it is not valid', async ({ page }) => {
  await mockDataApi(page);
  await page.goto('/invitacion?token=corto');

  await expect(page.getByText('Este link de invitación no es válido')).toBeVisible();
});
