import { expect, test } from '@playwright/test';
import { capture } from './support/screenshots';
import { blockSupabase, E2E_USER, mockDataApi, seedSession } from './support/supabase';

test.beforeEach(async ({ page }) => {
  await blockSupabase(page);
  await seedSession(page);
});

test('a signed-in user without a space creates it in the wizard and enters the app', async ({
  page,
}) => {
  const api = await mockDataApi(page);
  await page.goto('/');

  await expect(page).toHaveURL(/\/bienvenida\/espacio$/);
  await expect(page.getByRole('heading', { name: 'Tu espacio' })).toBeVisible();
  await expect(page.getByLabel('Moneda principal')).toContainText('Peso colombiano (COP)');
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await capture(page, 'bienvenida-espacio');

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Ponle un nombre al espacio.')).toBeVisible();

  await page.getByLabel('Nombre del espacio').fill('Hogar');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page).toHaveURL(/\/categorias$/);
  expect(api.createdSpace()).toEqual({
    space_name: 'Hogar',
    main_currency: 'COP',
    month_start_day: 1,
    week_start: 'monday',
  });
  await expect(page.getByText('Aún no hay categorías de gasto')).toBeVisible();
  await capture(page, 'categorias-vacias');
});

test('settings show the space and the session', async ({ page }) => {
  await mockDataApi(page, { withSpace: true });
  await page.goto('/configuracion');

  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
  await expect(page.getByLabel('Nombre del espacio')).toHaveValue('Hogar');
  await expect(page.getByText(`Sesión iniciada como ${E2E_USER.email}`)).toBeVisible();
  await capture(page, 'configuracion');
});
