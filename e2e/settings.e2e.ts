import { expect, test } from '@playwright/test';
import { HOUSEHOLD_WITH_MOVEMENTS } from './support/catalog-fixture';
import { capture } from './support/screenshots';
import { blockSupabase, mockDataApi, seedSession } from './support/supabase';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-26T12:00:00'));
  await blockSupabase(page);
  await seedSession(page);
});

test('Configuración saves the profile and the preferences, and opens on the home screen', async ({
  page,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD_WITH_MOVEMENTS });
  await page.goto('/configuracion');

  // The display name other members see (spec §7).
  const profile = page.getByRole('form', { name: 'Tu perfil' });
  await profile.getByRole('textbox', { name: 'Nombre visible' }).fill('Ana María');
  await profile.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Perfil guardado.')).toBeVisible();
  expect(api.writes()).toContainEqual(
    expect.objectContaining({ table: 'profiles', body: { display_name: 'Ana María' } }),
  );

  const preferences = page.getByRole('form', { name: 'Preferencias' });
  await preferences.getByRole('combobox', { name: 'Pantalla de inicio' }).click();
  await page.getByRole('option', { name: 'Presupuesto' }).click();
  await preferences.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Preferencias guardadas.')).toBeVisible();

  const space = page.getByRole('form', { name: 'Espacio' });
  await space.getByRole('combobox', { name: 'Periodo por defecto' }).click();
  await page.getByRole('option', { name: 'Año' }).click();
  await space.getByRole('switch', { name: 'Mostrar presupuestos' }).click();
  await capture(page, 'configuracion-completa');
  await space.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Espacio guardado.')).toBeVisible();
  expect(api.settings()).toMatchObject({ default_period: 'year', budgets_enabled: false });

  await page.goto('/');
  await expect(page).toHaveURL(/\/presupuesto$/);
});
