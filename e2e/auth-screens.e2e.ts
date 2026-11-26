import { expect, Page, test } from '@playwright/test';
import { capture } from './support/screenshots';
import { blockSupabase, SUPABASE_URL } from './support/supabase';

const RECOVERY_LINK_HASH = new URLSearchParams({
  access_token: 'e2e-access-token',
  refresh_token: 'e2e-refresh-token',
  expires_in: '3600',
  token_type: 'bearer',
  type: 'recovery',
}).toString();

const RECOVERY_USER = {
  id: '00000000-0000-4000-8000-000000000000',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'e2e@example.com',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};

async function expectCardCentered(page: Page): Promise<void> {
  const card = await page.locator('.auth-card').boundingBox();
  const viewport = page.viewportSize();
  expect(card).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (card && viewport && card.height < viewport.height) {
    expect(Math.abs(card.y + card.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
  }
}

test.beforeEach(async ({ page }) => {
  await blockSupabase(page);
});

test('"/" redirects to the login form', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/iniciar-sesion/);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByLabel('Correo')).toBeVisible();
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toBeVisible();
  await expectCardCentered(page);
  await capture(page, 'iniciar-sesion');
});

test('forgot password shows its form', async ({ page }) => {
  await page.goto('/recuperar-contrasena');

  await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();
  await expect(page.getByLabel('Correo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enviar enlace' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Volver a iniciar sesión' })).toBeVisible();
  await capture(page, 'recuperar-contrasena');
});

test('reset password shows its form when opened from a recovery link', async ({ page }) => {
  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) =>
    route.fulfill({ json: RECOVERY_USER }),
  );
  await page.goto(`/restablecer-contrasena#${RECOVERY_LINK_HASH}`);

  await expect(page.getByRole('heading', { name: 'Nueva contraseña' })).toBeVisible();
  await expect(page.getByLabel('Nueva contraseña')).toBeVisible();
  await expect(page.getByLabel('Confirmar contraseña')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar contraseña' })).toBeVisible();
  await capture(page, 'restablecer-contrasena');
});
