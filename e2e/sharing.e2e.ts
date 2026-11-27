import { expect, test } from '@playwright/test';
import { HOUSEHOLD_FOR_SUMMARY, HOUSEHOLD_WITH_MOVEMENTS } from './support/catalog-fixture';
import { blockSupabase, MemberFixture, mockDataApi, seedSession } from './support/supabase';

// Sharing a space (F1f): Miembros, the wizard with an invitation, the space selector and what a
// second member changes in Transacciones, Resumen and the viewer's screens.

const LAURA: MemberFixture = {
  userId: '00000000-0000-4000-8000-0000000000a1',
  name: 'Laura',
  email: 'laura@example.com',
  role: 'editor',
};

const PENDING = [
  {
    id: 'invitation-1',
    email: 'mama@example.com',
    role: 'viewer',
    expires_at: '2026-12-01T12:00:00Z',
  },
  {
    id: 'invitation-2',
    email: 'hermano@example.com',
    role: 'editor',
    expires_at: '2026-11-20T12:00:00Z',
  },
];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-26T12:00:00'));
  await blockSupabase(page);
  await seedSession(page);
});

test('the owner sees the members and the pending invitations, and invites by email and by link', async ({
  page,
}) => {
  const api = await mockDataApi(page, {
    withSpace: true,
    catalog: HOUSEHOLD_WITH_MOVEMENTS,
    sharing: { members: [LAURA], invitations: PENDING, existingAccounts: ['ana@example.com'] },
  });
  await page.goto('/configuracion');
  await page.getByRole('link', { name: /Miembros e invitaciones/ }).click();

  await expect(page.getByRole('heading', { name: 'Miembros (2)' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'E2E (tú)' })).toContainText(
    'Propietario',
  );
  await expect(page.getByRole('listitem').filter({ hasText: 'Laura' })).toContainText('Editor');
  await expect(page.getByRole('listitem').filter({ hasText: 'mama@example.com' })).toContainText(
    'Vence el 1 de diciembre',
  );
  await expect(page.getByRole('listitem').filter({ hasText: 'hermano@example.com' })).toContainText(
    'Venció',
  );

  // A new account: the email goes out and the sheet closes.
  await page.getByRole('button', { name: 'Invitar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Correo' }).fill('Pareja@Example.com');
  await page.getByRole('radio', { name: 'Lector' }).click();
  await expect(page.getByText('Ve lo compartido, sin cambiar nada.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Invitar', exact: true }).click();
  await expect(page.getByText('Invitación enviada a pareja@example.com.')).toBeVisible();
  expect(api.rpcCalls('invite-member').at(-1)).toMatchObject({
    action: 'invite',
    email: 'Pareja@Example.com',
    role: 'viewer',
  });

  // An existing account gets no email: the sheet shows the link to copy.
  await page.getByRole('button', { name: 'Invitar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Correo' }).fill('ana@example.com');
  await page.getByRole('dialog').getByRole('button', { name: 'Invitar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ya tiene una cuenta' })).toBeVisible();
  await expect(page.getByTestId('invitation-link')).toContainText('/invitacion?token=');
  await page.getByRole('button', { name: 'Listo' }).click();

  // Resending an expired invitation sends a new email; revoking asks first.
  await page.getByRole('button', { name: 'Reenviar a hermano@example.com' }).click();
  await expect(page.getByText('Invitación reenviada a hermano@example.com.')).toBeVisible();
  await page.getByRole('button', { name: 'Revocar la invitación de mama@example.com' }).click();
  await page.getByRole('button', { name: 'Revocar', exact: true }).click();
  await expect(page.getByText('Invitación revocada.')).toBeVisible();
  expect(api.rpcCalls('revoke_invitation')).toEqual([{ target_invitation_id: 'invitation-1' }]);
});

test('the owner changes a role and removes a member', async ({ page }) => {
  const api = await mockDataApi(page, {
    withSpace: true,
    catalog: HOUSEHOLD_WITH_MOVEMENTS,
    sharing: { members: [LAURA] },
  });
  await page.goto('/configuracion/miembros');

  await page.getByRole('button', { name: /^Laura/ }).click();
  await page.getByRole('radio', { name: /Lector/ }).click();
  await expect(page.getByText('Laura ahora es lector.')).toBeVisible();
  expect(api.writes()).toContainEqual(
    expect.objectContaining({ method: 'PATCH', table: 'space_members', body: { role: 'viewer' } }),
  );

  await page.getByRole('button', { name: 'Quitar a Laura' }).click();
  await expect(page.getByText(/Las cuentas privadas quedan ocultas/)).toBeVisible();
  await page.getByRole('button', { name: 'Quitar', exact: true }).click();
  await expect(page.getByText('Laura ya no está en el espacio.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Miembros (1)' })).toBeVisible();
});

test('a member leaves the space; the last owner cannot', async ({ page }) => {
  await mockDataApi(page, {
    withSpace: true,
    catalog: HOUSEHOLD_WITH_MOVEMENTS,
    sharing: { role: 'editor', members: [{ ...LAURA, name: 'Juan', role: 'owner' }] },
  });
  await page.goto('/configuracion/miembros');

  // Only the owner invites and manages roles.
  await expect(page.getByRole('button', { name: 'Invitar', exact: true })).toHaveCount(0);
  await expect(page.getByText('Solo el propietario invita')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitar a Juan' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Salir de Hogar' }).click();
  await page.getByRole('button', { name: 'Salir', exact: true }).click();
  await expect(page.getByText('Saliste de Hogar.')).toBeVisible();
  await expect(page).toHaveURL(/\/bienvenida/);
});

test('the only owner cannot leave', async ({ page }) => {
  await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/configuracion/miembros');

  await expect(page.getByRole('button', { name: 'Salir de Hogar' })).toBeDisabled();
  await expect(page.getByText('Eres el único propietario')).toBeVisible();
});

test('without a space, a pending invitation is offered next to creating one', async ({ page }) => {
  const api = await mockDataApi(page, {
    catalog: HOUSEHOLD_WITH_MOVEMENTS,
    sharing: {
      role: 'editor',
      received: [
        {
          invitation_id: '00000000-0000-4000-8000-0000000001a2',
          space_id: '00000000-0000-4000-8000-00000000005e',
          space_name: 'Hogar',
          space_icon: 'home',
          space_color: 'green',
          inviter_name: 'Juan',
          role: 'editor',
          expires_at: '2026-12-03T12:00:00Z',
        },
      ],
    },
  });
  await page.goto('/');

  await expect(page).toHaveURL(/\/bienvenida\/espacio/);
  await expect(page.getByText('Juan te invitó a «Hogar»')).toBeVisible();
  await page.getByRole('button', { name: 'Aceptar invitación' }).click();

  await expect(page.getByText('Ya eres parte de Hogar.')).toBeVisible();
  await expect(page).toHaveURL(/\/categorias$/);
  expect(api.rpcCalls('accept_invitation')).toEqual([
    { target_invitation_id: '00000000-0000-4000-8000-0000000001a2' },
  ]);
});

test('with more than one space, the menu switches between them', async ({ page }) => {
  await mockDataApi(page, {
    withSpace: true,
    catalog: HOUSEHOLD_WITH_MOVEMENTS,
    sharing: {
      otherSpaces: [
        {
          id: '00000000-0000-4000-8000-00000000005f',
          name: 'Personal',
          icon: 'person',
          color: 'blue',
          role: 'owner',
        },
      ],
    },
  });
  await page.goto('/cuentas');

  // Spec §7: the active space is in the menu; the others unfold under it, with the role.
  await page.getByRole('button', { name: 'Abrir el menú' }).click();
  const menu = page.getByRole('dialog', { name: 'Menú' });
  await menu.getByRole('button', { name: 'Cambiar de espacio: Hogar, Propietario' }).click();
  await expect(menu.getByRole('button', { name: /^Personal/ })).toBeVisible();
  await menu.getByRole('button', { name: /^Personal/ }).click();

  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/\/categorias$/);
  await page.getByRole('button', { name: 'Abrir el menú' }).click();
  await expect(
    menu.getByRole('button', { name: 'Cambiar de espacio: Personal, Propietario' }),
  ).toBeVisible();
});

test('with two members, Resumen and Transacciones offer Persona', async ({ page }) => {
  await mockDataApi(page, {
    withSpace: true,
    catalog: HOUSEHOLD_FOR_SUMMARY,
    sharing: { members: [LAURA] },
  });
  await page.goto('/resumen');
  await expect(page.getByRole('tab', { name: 'Persona' })).toBeVisible();
  await page.getByRole('tab', { name: 'Persona' }).click();

  await page.goto('/transacciones');
  await expect(page.getByRole('button', { name: 'Persona' })).toBeVisible();
});

test('a viewer reads without editing', async ({ page }) => {
  await mockDataApi(page, {
    withSpace: true,
    catalog: HOUSEHOLD_WITH_MOVEMENTS,
    sharing: { role: 'viewer', members: [{ ...LAURA, name: 'Juan', role: 'owner' }] },
  });
  await page.goto('/transacciones');

  await expect(page.getByRole('region', { name: 'Movimientos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nuevo movimiento' })).toHaveCount(0);
});
