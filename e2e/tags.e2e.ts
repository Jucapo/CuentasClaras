import { expect, Page, test } from '@playwright/test';
import { HOUSEHOLD } from './support/catalog-fixture';
import { blockSupabase, mockDataApi, seedSession } from './support/supabase';

test.beforeEach(async ({ page }) => {
  await blockSupabase(page);
  await seedSession(page);
});

/** The open sheet (phones) or dialog (wider screens). */
function overlay(page: Page, isMobile: boolean) {
  return page.locator(isMobile ? '.mat-bottom-sheet-container' : 'mat-dialog-container');
}

test('tags are listed with their use and a new one is created in a sheet', async ({
  page,
  isMobile,
}) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/configuracion/etiquetas');

  await expect(page.getByRole('heading', { name: 'Etiquetas', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Fijos/ })).toContainText(
    'Por defecto en 1 categoría',
  );

  await page.getByRole('button', { name: 'Nueva etiqueta' }).click();
  const sheet = overlay(page, isMobile);
  await expect(sheet.getByRole('heading', { name: 'Nueva etiqueta' })).toBeVisible();
  await expect(sheet.getByLabel('Nombre')).toBeFocused();
  await sheet.getByLabel('Nombre').fill('Viajes');
  await sheet.getByRole('button', { name: 'Listo' }).click();

  await expect(sheet).toBeHidden();
  expect(api.writes().find((write) => write.table === 'tags')?.body).toMatchObject({
    name: 'Viajes',
    color: 'indigo',
  });
  await expect(page.getByRole('button', { name: /Viajes/ })).toBeVisible();
});

test('a tag is archived from its sheet', async ({ page, isMobile }) => {
  const api = await mockDataApi(page, { withSpace: true, catalog: HOUSEHOLD });
  await page.goto('/configuracion/etiquetas');

  await page.getByRole('button', { name: /Salud/ }).click();
  const sheet = overlay(page, isMobile);
  await expect(sheet.getByLabel('Nombre')).toHaveValue('Salud');
  await sheet.getByRole('button', { name: 'Archivar' }).click();

  await expect(sheet).toBeHidden();
  await expect
    .poll(() => api.writes().find((write) => write.table === 'tags'))
    .toMatchObject({ method: 'PATCH', query: expect.stringContaining('id=eq.tag-health') });
  await page.getByRole('button', { name: 'Archivadas (1)' }).click();
  await expect(page.getByRole('button', { name: /Salud/ })).toContainText('Archivada');
});
