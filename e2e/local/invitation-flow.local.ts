import { expect, test } from '@playwright/test';
import { capture } from '../support/screenshots';
import {
  callInviteMemberFrom,
  createOwnerWithSpace,
  emailsTo,
  inviteTokenWorks,
  SEED_EXISTING_ACCOUNT,
  signInThroughUi,
  uniqueEmail,
  waitForInvitationLink,
} from './local-stack';

// Invitations against the real local stack (spec §3.3): invite-member, Auth's invite email in
// Mailpit and the accept page on iPhone WebKit. Needs `npm run db:start` and
// `npm run functions:serve`.

const OWNER_PASSWORD = 'clave-del-propietario';
const INVITEE_PASSWORD = 'clave-de-la-invitada';

test('a new account: email, resend before accepting, accept from the new link and sign in', async ({
  browser,
}) => {
  const ownerEmail = uniqueEmail('propietario');
  const invitee = uniqueEmail('pareja');
  await createOwnerWithSpace(ownerEmail, OWNER_PASSWORD);

  const owner = await (await browser.newContext()).newPage();
  await owner.goto('/iniciar-sesion');
  await signInThroughUi(owner, ownerEmail, OWNER_PASSWORD);
  await expect(owner).toHaveURL(/\/categorias$/);
  await owner.goto('/configuracion/miembros');
  await owner.getByRole('button', { name: 'Invitar', exact: true }).click();
  await owner.getByRole('textbox', { name: 'Correo' }).fill(invitee);
  await owner.getByRole('dialog').getByRole('button', { name: 'Invitar', exact: true }).click();
  await expect(owner.getByText(`Invitación enviada a ${invitee}.`)).toBeVisible();
  const firstLink = await waitForInvitationLink(invitee, 1);

  // Resending before the invitee accepts: Auth already has the user, unconfirmed, and sends the
  // email again instead of answering email_exists.
  await owner.getByRole('button', { name: `Reenviar a ${invitee}` }).click();
  await expect(owner.getByText(`Invitación reenviada a ${invitee}.`)).toBeVisible();
  const secondLink = await waitForInvitationLink(invitee, 2);
  expect(secondLink).not.toBe(firstLink);

  // The previous link stops working on both sides: the invitation token rotated and Auth issued a
  // new token hash.
  const firstUrl = new URL(firstLink);
  expect(await inviteTokenWorks(firstUrl.searchParams.get('token_hash') ?? '')).toBe(false);
  const stale = await (await browser.newContext()).newPage();
  await stale.goto(`${firstUrl.pathname}${firstUrl.search}`);
  await expect(stale.getByText('Este link de invitación no es válido')).toBeVisible();

  // The new link, in a browser without a session (Safari, not the installed app).
  const safari = await (await browser.newContext()).newPage();
  const secondUrl = new URL(secondLink);
  await safari.goto(`${secondUrl.pathname}${secondUrl.search}`);
  await expect(safari.getByText('te invitó a «Hogar»')).toBeVisible();
  await capture(safari, 'local-invitacion-cuenta-nueva');
  await safari.getByRole('textbox', { name: 'Tu nombre' }).fill('Laura');
  await safari.getByLabel('Contraseña', { exact: true }).fill(INVITEE_PASSWORD);
  await safari.getByLabel('Confirmar contraseña').fill(INVITEE_PASSWORD);
  await safari.getByRole('button', { name: 'Aceptar invitación' }).click();
  await expect(safari.getByRole('heading', { name: '¡Listo!' })).toBeVisible();
  await expect(safari.getByText('Agregar a inicio')).toBeVisible();
  await capture(safari, 'local-invitacion-lista');

  // The installed app has its own session: the new account signs in with its password.
  const app = await (await browser.newContext()).newPage();
  await app.goto('/iniciar-sesion');
  await signInThroughUi(app, invitee, INVITEE_PASSWORD);
  await expect(app).toHaveURL(/\/categorias$/);
  await app.goto('/configuracion/miembros');
  await expect(app.getByRole('heading', { name: 'Miembros (2)' })).toBeVisible();
  await expect(app.getByRole('listitem').filter({ hasText: 'Laura (tú)' })).toContainText('Editor');
  await capture(app, 'local-miembros-invitada');

  await owner.reload();
  await expect(owner.getByRole('heading', { name: 'Miembros (2)' })).toBeVisible();
  await expect(owner.getByText('No hay invitaciones pendientes.')).toBeVisible();
});

test('an existing account: no email, the link opens after signing in', async ({ browser }) => {
  const ownerEmail = uniqueEmail('propietario');
  await createOwnerWithSpace(ownerEmail, OWNER_PASSWORD);
  const emailsBefore = (await emailsTo(SEED_EXISTING_ACCOUNT.email)).length;

  const owner = await (await browser.newContext()).newPage();
  await owner.goto('/iniciar-sesion');
  await signInThroughUi(owner, ownerEmail, OWNER_PASSWORD);
  await expect(owner).toHaveURL(/\/categorias$/);
  await owner.goto('/configuracion/miembros');
  await owner.getByRole('button', { name: 'Invitar', exact: true }).click();
  await owner.getByRole('textbox', { name: 'Correo' }).fill(SEED_EXISTING_ACCOUNT.email);
  await owner.getByRole('radio', { name: 'Lector' }).click();
  await owner.getByRole('dialog').getByRole('button', { name: 'Invitar', exact: true }).click();
  await expect(owner.getByRole('heading', { name: 'Ya tiene una cuenta' })).toBeVisible();
  const link = new URL((await owner.getByTestId('invitation-link').textContent()) ?? '');
  expect((await emailsTo(SEED_EXISTING_ACCOUNT.email)).length).toBe(emailsBefore);

  const invitee = await (await browser.newContext()).newPage();
  await invitee.goto(`${link.pathname}${link.search}`);
  await invitee.getByRole('button', { name: 'Iniciar sesión' }).click();
  await signInThroughUi(invitee, SEED_EXISTING_ACCOUNT.email, SEED_EXISTING_ACCOUNT.password);
  await expect(invitee).toHaveURL(/\/invitacion\?token=/);
  await invitee.getByRole('button', { name: 'Aceptar invitación' }).click();
  await expect(invitee.getByRole('heading', { name: '¡Listo!' })).toBeVisible();
});

test('invite-member refuses browsers on other origins', async () => {
  expect(await callInviteMemberFrom('https://otro-sitio.example')).toBe(403);
});
